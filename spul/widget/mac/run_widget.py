#!/usr/bin/env python3
"""
S-PUL Continuity Wall — Mac/Python launcher + optional git watcher.

Run on Bill's MacBook (not Cursor cloud VM):

  python3 spul/widget/mac/run_widget.py
  python3 spul/widget/mac/run_widget.py --watch

Starts the Node wall server on 127.0.0.1:3847, opens the browser,
and optionally drafts wall posts when new local commits appear.
"""
from __future__ import annotations

import argparse
import json
import os
import signal
import subprocess
import sys
import time
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path

HOST = os.environ.get("WIDGET_HOST", "127.0.0.1")
PORT = int(os.environ.get("WIDGET_PORT", "3847"))
BASE = f"http://{HOST}:{PORT}"


def widget_paths() -> tuple[Path, Path, Path]:
    mac = Path(__file__).resolve().parent
    widget = mac.parent
    spul = widget.parent
    repo = spul.parent
    return widget, spul, repo


def wait_health(timeout: float = 5.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(f"{BASE}/api/health", timeout=0.5) as r:
                if r.status == 200:
                    return True
        except (urllib.error.URLError, TimeoutError, OSError):
            time.sleep(0.2)
    return False


def post_wall(payload: dict) -> None:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE}/api/wall",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=5) as r:
        r.read()


def git_head(repo: Path) -> str:
    try:
        out = subprocess.check_output(
            ["git", "-C", str(repo), "rev-parse", "HEAD"],
            stderr=subprocess.DEVNULL,
            text=True,
        )
        return out.strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return ""


def git_log_one(repo: Path, sha: str) -> tuple[str, str]:
    try:
        subject = subprocess.check_output(
            ["git", "-C", str(repo), "log", "-1", "--pretty=%s", sha],
            text=True,
        ).strip()
        body = subprocess.check_output(
            ["git", "-C", str(repo), "log", "-1", "--pretty=%b", sha],
            text=True,
        ).strip()
        return subject, body
    except subprocess.CalledProcessError:
        return sha[:7], ""


def watch_commits(repo: Path, stop_flag: list[bool]) -> None:
    last = git_head(repo)
    print(f"Watcher: tracking commits in {repo} (HEAD {last[:7] or 'n/a'})")
    while not stop_flag[0]:
        time.sleep(4)
        head = git_head(repo)
        if not head or head == last:
            continue
        subject, body = git_log_one(repo, head)
        try:
            post_wall(
                {
                    "author": "cursor",
                    "type": "change",
                    "title": f"Git commit {head[:7]} — {subject}"[:200],
                    "body": body or subject,
                    "outcome": "Auto-drafted by local Mac watcher (run_widget.py --watch).",
                    "links": [
                        {
                            "label": f"commit {head[:7]}",
                            "url": f"https://github.com/webpointllc-com/TaxCertificateProcessor/commit/{head}",
                        }
                    ],
                }
            )
            print(f"Watcher: posted wall entry for {head[:7]}")
            last = head
        except Exception as e:  # noqa: BLE001 — keep watcher alive
            print(f"Watcher: post failed ({e})")


def main() -> int:
    parser = argparse.ArgumentParser(description="S-PUL Continuity Wall Mac launcher")
    parser.add_argument("--watch", action="store_true", help="Also watch git commits and auto-draft posts")
    parser.add_argument("--watch-only", action="store_true", help="Only run watcher (server already up)")
    parser.add_argument("--repo", type=str, default="", help="Repo root override")
    parser.add_argument("--no-open", action="store_true", help="Do not open browser")
    args = parser.parse_args()

    widget, spul, repo = widget_paths()
    if args.repo:
        repo = Path(args.repo).resolve()

    if sys.platform != "darwin":
        print(f"WARN: platform={sys.platform} — Bill should run this on macOS.")

    stop = [False]

    def _stop(*_a: object) -> None:
        stop[0] = True

    signal.signal(signal.SIGINT, _stop)
    signal.signal(signal.SIGTERM, _stop)

    proc = None
    if not args.watch_only:
        env = os.environ.copy()
        env["WIDGET_HOST"] = HOST
        env["WIDGET_PORT"] = str(PORT)
        proc = subprocess.Popen(
            ["node", str(widget / "server.js")],
            cwd=str(spul),
            env=env,
        )
        if not wait_health():
            print("ERROR: wall server did not become healthy")
            if proc:
                proc.terminate()
            return 1
        print(f"S-PUL Continuity Wall → {BASE}/")
        print(f"Wall file → {widget / 'wall' / 'posts.jsonl'}")
        if not args.no_open:
            webbrowser.open(f"{BASE}/")

    if args.watch or args.watch_only:
        watch_commits(repo, stop)
    else:
        print("Ctrl+C to stop. Tip: add --watch to auto-draft posts from new commits.")
        while not stop[0]:
            if proc and proc.poll() is not None:
                return proc.returncode or 0
            time.sleep(0.4)

    if proc and proc.poll() is None:
        proc.terminate()
        try:
            proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            proc.kill()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
