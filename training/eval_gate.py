#!/usr/bin/env python3
"""Ship gate: a new adapter goes live only if it beats the current one on held-out data.

Both models are called through the same OpenAI-compatible endpoint (vLLM serves several
LoRA adapters on one base), so the comparison is apples to apples.

    python training/eval_gate.py \
        --url https://api.runpod.ai/v2/<ENDPOINT_ID>/openai/v1 --key $RUNPOD_API_KEY \
        --current webpoint-v1 --candidate webpoint-v2 --data training/data/eval.jsonl

Scores, in order of importance (WebPoint rules, not generic benchmarks):
  1. invented_url_rate     answers containing a URL that was not in the prompt   (must not go up)
  2. invented_money_rate   answers containing a $ amount that was not in the prompt (must not go up)
  3. f1                    word overlap with the reference answer                  (must not drop > 0.01)

Exit 0 = PASS, promote the candidate. Exit 1 = FAIL, keep the current adapter.
Stdlib only, so it runs anywhere with Python 3.9+.
"""

import argparse
import json
import re
import sys
import urllib.request
from collections import Counter

URL_RE = re.compile(r"https?://[^\s)\]>\"']+", re.I)
MONEY_RE = re.compile(r"\$\s?\d[\d,]*(?:\.\d{2})?")


def norm_url(u):
    return u.rstrip(".,;:").rstrip("/").lower()


def invented(pattern, reply, prompt, normalize=lambda x: x):
    allowed = {normalize(m) for m in pattern.findall(prompt)}
    return any(normalize(m) not in allowed for m in pattern.findall(reply))


def f1(pred, ref):
    p = re.findall(r"\w+", pred.lower())
    r = re.findall(r"\w+", ref.lower())
    if not p or not r:
        return 0.0
    common = sum((Counter(p) & Counter(r)).values())
    if common == 0:
        return 0.0
    prec, rec = common / len(p), common / len(r)
    return 2 * prec * rec / (prec + rec)


def score(replies, examples):
    n = len(examples)
    url_bad = money_bad = 0
    f1_sum = 0.0
    for reply, ex in zip(replies, examples):
        prompt = "\n".join(m["content"] for m in ex["prompt"])
        if invented(URL_RE, reply, prompt, norm_url):
            url_bad += 1
        if invented(MONEY_RE, reply, prompt, lambda s: s.replace(" ", "")):
            money_bad += 1
        f1_sum += f1(reply, ex["reference"])
    return {
        "n": n,
        "invented_url_rate": url_bad / n if n else 0.0,
        "invented_money_rate": money_bad / n if n else 0.0,
        "f1": f1_sum / n if n else 0.0,
    }


def decide(current, candidate, f1_tolerance=0.01):
    reasons = []
    if candidate["invented_url_rate"] > current["invented_url_rate"]:
        reasons.append("invents more URLs")
    if candidate["invented_money_rate"] > current["invented_money_rate"]:
        reasons.append("invents more dollar amounts")
    if candidate["f1"] < current["f1"] - f1_tolerance:
        reasons.append("answers drifted further from the references")
    return (not reasons), reasons


def load_eval(path):
    out = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            msgs = json.loads(line)["messages"]
            if msgs and msgs[-1]["role"] == "assistant":
                out.append({"prompt": msgs[:-1], "reference": msgs[-1]["content"]})
    return out


def ask(url, key, model, messages, timeout=120):
    body = json.dumps({"model": model, "messages": messages, "temperature": 0, "max_tokens": 400}).encode()
    req = urllib.request.Request(
        url.rstrip("/") + "/chat/completions",
        data=body,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = json.loads(resp.read())
    return data["choices"][0]["message"]["content"] or ""


def self_test():
    prompt = [{"role": "user", "content": "Locked URL: https://a.gov/tax/ total $1,200.00"}]
    ex = [{"prompt": prompt, "reference": "Use https://a.gov/tax for the $1,200.00 bill"}]
    good = score(["Use https://a.gov/tax for the $1,200.00 bill."], ex)
    bad = score(["Try https://fake.com/tax, about $900"], ex)
    assert good["invented_url_rate"] == 0 and good["invented_money_rate"] == 0, good
    assert bad["invented_url_rate"] == 1 and bad["invented_money_rate"] == 1, bad
    assert good["f1"] > bad["f1"]
    ok, _ = decide(bad, good)
    assert ok
    ok, reasons = decide(good, bad)
    assert not ok and len(reasons) == 3, reasons
    print("eval_gate self-test PASS")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--self-test", action="store_true")
    p.add_argument("--url")
    p.add_argument("--key")
    p.add_argument("--current")
    p.add_argument("--candidate")
    p.add_argument("--data", default="training/data/eval.jsonl")
    p.add_argument("--min-eval", type=int, default=30)
    args = p.parse_args()
    if args.self_test:
        self_test()
        return 0
    for name in ("url", "key", "current", "candidate"):
        if not getattr(args, name):
            p.error(f"--{name} is required")
    examples = load_eval(args.data)
    if len(examples) < args.min_eval:
        print(f"FAIL: only {len(examples)} eval examples (need {args.min_eval}). Not enough data to trust a result.")
        return 1
    results = {}
    for label, model in (("current", args.current), ("candidate", args.candidate)):
        replies = [ask(args.url, args.key, model, ex["prompt"]) for ex in examples]
        results[label] = score(replies, examples)
    ok, reasons = decide(results["current"], results["candidate"])
    print(json.dumps({"current": results["current"], "candidate": results["candidate"],
                      "verdict": "PASS" if ok else "FAIL", "reasons": reasons}, indent=2))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
