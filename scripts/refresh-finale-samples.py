#!/usr/bin/env python3
"""Rebuild finale/samples.json from the xlsx workbooks in finale/."""
import datetime
import json
import os
import re
import zipfile
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FINALE = os.path.join(ROOT, "finale")
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
DATE_HEADERS = {
    "As Of",
    "Inst 1 Date",
    "Inst 2 Date",
    "Inst 3 Date",
    "Inst 4 Date",
    "Redemption Expires",
    "Redemption 1 Expires",
    "Redemption 2 Expires",
    "Redemption 3 Expires",
}
MONEY_HEADERS = {
    "Bill Amount",
    "Balance Due",
    "Inst 1 Amt",
    "Inst 1 Bal",
    "Inst 2 Amt",
    "Inst 2 Bal",
    "Inst 3 Amt",
    "Inst 3 Bal",
    "Inst 4 Amt",
    "Inst 4 Bal",
    "Bill Redemption",
    "Parcel Redemption 1",
    "Parcel Redemption 2",
    "Parcel Redemption 3",
    "Total Assessed Value",
    "Improvement Value",
    "Land Value",
}
FILES = {
    "OH-Hamilton": "OH-Hamilton-DR-ProductionResults09042026.xlsx",
    "CT-HartfordCity": "CT-HartfordCity-DR-ProductionResults09042026.xlsx",
}


def load_shared(z):
    if "xl/sharedStrings.xml" not in z.namelist():
        return []
    root = ET.fromstring(z.read("xl/sharedStrings.xml"))
    strings = []
    for si in root.findall("m:si", NS):
        texts = [t.text or "" for t in si.findall(".//m:t", NS)]
        strings.append("".join(texts))
    return strings


def col_row(cell_ref):
    m = re.match(r"([A-Z]+)(\d+)", cell_ref or "")
    if not m:
        return None, None
    col, row = m.group(1), int(m.group(2))
    n = 0
    for ch in col:
        n = n * 26 + (ord(ch) - 64)
    return n, row


def excel_date(n):
    try:
        v = float(n)
    except Exception:
        return n
    if v > 20000 and v < 80000 and abs(v - round(v)) < 1e-9:
        d = datetime.date(1899, 12, 30) + datetime.timedelta(days=int(round(v)))
        return d.isoformat()
    return n


def coerce(header, val):
    if val in ("", None):
        return None
    if header in DATE_HEADERS:
        return excel_date(val)
    if str(val).lower() in ("true", "false"):
        return str(val).lower() == "true"
    if header in MONEY_HEADERS:
        try:
            return float(val)
        except Exception:
            return val
    if header == "Bill Year":
        try:
            return int(float(val))
        except Exception:
            return val
    return val


def read_all(path):
    z = zipfile.ZipFile(path)
    shared = load_shared(z)
    xml = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
    grid = {}
    maxc = maxr = 0
    for c in xml.findall(".//m:c", NS):
        ref = c.attrib.get("r")
        col, row = col_row(ref)
        if not col or not row:
            continue
        t = c.attrib.get("t")
        v = c.find("m:v", NS)
        val = v.text if v is not None else ""
        if t == "s" and val != "":
            try:
                val = shared[int(val)]
            except Exception:
                pass
        grid.setdefault(row, {})[col] = val
        maxc = max(maxc, col)
        maxr = max(maxr, row)
    header = [str(grid.get(1, {}).get(c, "") or "").strip() for c in range(1, maxc + 1)]
    rows = []
    for r in range(2, maxr + 1):
        rec = {}
        empty = True
        for i, h in enumerate(header, 1):
            if not h:
                continue
            val = coerce(h, grid.get(r, {}).get(i, ""))
            rec[h] = val
            if val not in ("", None):
                empty = False
        if not empty:
            rows.append(rec)
    return header, rows


def main():
    out = {
        "product": "DR Production Results",
        "note": "Canonical output document for a parcel in a county/state.",
        "files": {},
        "rows": [],
    }
    header = None
    for agency, name in FILES.items():
        path = os.path.join(FINALE, name)
        if not os.path.exists(path):
            continue
        header, rows = read_all(path)
        out["files"][agency] = {"xlsx": name, "rows": len(rows), "header": header}
        for rec in rows:
            rec["_source"] = name
            out["rows"].append(rec)
    samples_path = os.path.join(FINALE, "samples.json")
    existing = {}
    if os.path.exists(samples_path):
        existing = json.load(open(samples_path))
    kept = [
        r
        for r in existing.get("rows", [])
        if r.get("_source") == "operator_screenshot_2026-09-29"
        or (r.get("Agency Name") == "IL-Sangamon" and not r.get("_source", "").endswith(".xlsx"))
    ]
    out["rows"].extend(kept)
    if header:
        sang = [r for r in out["rows"] if r.get("Agency Name") == "IL-Sangamon"]
        out["files"]["IL-Sangamon"] = {
            "xlsx": None,
            "rows": len(sang),
            "header": header,
            "note": "Screenshot row until the Sangamon xlsx is dropped into finale/.",
        }
    with open(samples_path, "w") as f:
        json.dump(out, f, indent=2)
        f.write("\n")
    print(json.dumps({"ok": True, "rows": len(out["rows"]), "files": list(out["files"])}))


if __name__ == "__main__":
    main()
