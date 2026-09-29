#!/usr/bin/env python3
"""Seed vendor extractors from live Searching HTML captures. No secrets."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PLAY = ROOT / "data" / "extractor_playbooks.json"
LOCKS = ROOT / "data" / "spul_searching_operator_locks.json"
GOLDEN = ROOT / "data" / "golden_overrides.json"
COUNTIES = ROOT / "data" / "counties.json"

data = json.loads(PLAY.read_text())
data["_meta"]["searching_html"] = (
    "public/County_Names_Urls_BillValidated.html from "
    "s-pul-front_end-Betavalid-tinder-55de. Live vendor HTML captured 2026-09-29."
)

data["_vendors"] = {
    "eclix": {
        "vendor": "eclix",
        "collector": "Kentucky County Clerk — ECCLIX (ecclix.com)",
        "search_url": "https://ecclix.com/ecclix/login.aspx",
        "how_found": "Live GET 2026-09-29 ecclix.com/ecclix/login.aspx 200 title County Clerk's Office. form#aspnetForm. Fields ctl00_Content_UserName, ctl00_Content_Password1, Log In.",
        "layout": {
            "spa": False,
            "search_by": ["owner", "parcel"],
            "fields": [
                {"role": "username", "label": "User name", "xpath": "//input[@id='ctl00_Content_UserName']"},
                {"role": "password", "label": "Password", "xpath": "//input[@id='ctl00_Content_Password1']"},
                {"role": "submit", "label": "Log In", "xpath": "//input[@name='ctl00$Content$cmdLogin']"},
            ],
        },
        "method": {
            "search_by": ["owner", "parcel"],
            "steps": [
                "Open the locked ECCLIX URL (ecclix.com). Never eclix.com (parked).",
                "County Clerk's Office login is the public landing. After that session, search taxes by owner or parcel on ECCLIX.",
                "Do not send the user to the county .gov homepage.",
            ],
            "notes": "Captured HTML 2026-09-29 ASP.NET login.",
        },
    },
    "properlytaxes": {
        "vendor": "properlytaxes",
        "collector": "PVDNet / Properly Taxes",
        "search_url": "https://view.properlytaxes.com/",
        "how_found": "Live GET 2026-09-29 view.properlytaxes.com 200 title PVDNet Web Portal. SPA. view.propertytaxes.com NXDOMAIN.",
        "layout": {"spa": True, "search_by": ["parcel", "owner", "address"], "fields": []},
        "method": {
            "search_by": ["parcel", "owner", "address"],
            "steps": [
                "Open the locked view.properlytaxes.com URL (PVDNet). Never view.propertytaxes.com.",
                "Search the tax bill on that portal after it renders.",
            ],
            "notes": "SPA captured 2026-09-29.",
        },
    },
    "csi_ky": {
        "vendor": "csi_ky",
        "collector": "CSI Kentucky current tax search",
        "search_url": "http://ptax1.csiky.com/oldham_current/",
        "how_found": "Live GET 2026-09-29 ptax1.csiky.com/oldham_current/ 200. ptax.oldham.celky.com NXDOMAIN.",
        "layout": {"spa": True, "search_by": ["parcel", "owner"], "fields": []},
        "method": {
            "search_by": ["parcel", "owner"],
            "steps": [
                "Open the locked CSI current-tax URL (ptax1.csiky.com).",
                "Never ptax.oldham.celky.com.",
            ],
            "notes": "Captured 2026-09-29.",
        },
    },
    "snstaxpayments": {
        "vendor": "snstaxpayments",
        "collector": "Louisiana parish sheriff — I3 Verticals SNS tax payments",
        "search_url": "https://snstaxpayments.com/",
        "how_found": "Live GET 2026-09-29 snstaxpayments.com 200 parish index (/allen, /beauregard, /bossiersheriff). sntaxpayments.com is a placeholder.",
        "layout": {"spa": False, "search_by": ["parcel", "owner"], "fields": []},
        "method": {
            "search_by": ["parcel", "owner"],
            "steps": [
                "Open the locked snstaxpayments.com parish path, not sntaxpayments.com.",
                "Search or pay on that I3 Verticals sheriff portal.",
            ],
            "notes": "Captured HTML 2026-09-29 parish index.",
        },
    },
    "parish_sheriff": {
        "vendor": "parish_sheriff",
        "collector": "Parish sheriff property tax search",
        "search_url": "https://www.bossiersheriff.com/property-details/",
        "how_found": "Live GET 2026-09-29 bossiersheriff.com/property-details 200 title Bossier Parish LA.",
        "layout": {"spa": True, "search_by": ["parcel", "owner", "address"], "fields": []},
        "method": {
            "search_by": ["parcel", "owner", "address"],
            "steps": [
                "Open the locked sheriff property-details URL.",
                "Do not use the parish government homepage.",
            ],
            "notes": "Captured 2026-09-29.",
        },
    },
}

lock_doc = json.loads(LOCKS.read_text())
locks = lock_doc["locks"]
locks["LA-AllenParish"]["searchURL"] = "https://snstaxpayments.com/allen"
locks["LA-BeauregardParish"]["searchURL"] = "https://snstaxpayments.com/beauregard"
LOCKS.write_text(json.dumps(lock_doc, indent=2) + "\n")

for key, lock in locks.items():
    tmpl = data["_vendors"].get(lock.get("vendor") or "")
    if not tmpl:
        continue
    data[key] = {
        "county": lock["county"],
        "state": lock["state"],
        "collector": lock.get("entity") or tmpl["collector"],
        "search_url": lock["searchURL"],
        "vendor": lock.get("vendor"),
        "how_found": lock.get("howFound") or tmpl["how_found"],
        "layout": tmpl["layout"],
        "method": {
            "search_by": tmpl["method"]["search_by"],
            "steps": [f"Open {lock['searchURL']} (Searching / Bill Validated HTML)."]
            + tmpl["method"]["steps"][1:],
            "notes": tmpl["method"]["notes"],
        },
    }

PLAY.write_text(json.dumps(data, indent=2) + "\n")

golden = json.loads(GOLDEN.read_text())
for key, lock in locks.items():
    if key in golden:
        golden[key]["searchURL"] = lock["searchURL"]
        if lock.get("entityNote"):
            golden[key]["entityNote"] = lock["entityNote"]
GOLDEN.write_text(json.dumps(golden, indent=2) + "\n")

counties = json.loads(COUNTIES.read_text())
by = {(c.get("state"), c.get("county")): c for c in counties}
for lock in locks.values():
    row = by.get((lock["state"], lock["county"]))
    if not row:
        continue
    row["searchURL"] = lock["searchURL"]
    row["vendor"] = lock.get("vendor") or row.get("vendor")
    row["verified"] = True
    row["coverageStatus"] = "verified"
    row["probeStatus"] = "collector_search"
    row["importSource"] = "golden_override"
COUNTIES.write_text(json.dumps(counties, indent=2) + "\n")
print("seeded", len(locks), "county extractors")
