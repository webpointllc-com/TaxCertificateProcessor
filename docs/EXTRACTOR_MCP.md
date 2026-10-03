# Extractor validation — internal MCP server

One validation surface for Claude (Twin 2), Cursor (Twin 1) and scripts. Same county catalog (`data/counties.json`), same probe classifier (`scripts/probe-lib.js`), same Postgres as the web app. Code: `mcp/extractors-server.js` → `src/services/extractorValidation.js` + `src/db/extractorLocks.js`.

## Who can do what

| Actor | How | Read + probe | Propose lock | Approve / reject lock |
| --- | --- | --- | --- | --- |
| Claude | MCP server (`WEBPOINT_MCP_ROLE=claude`, default) or `CLAUDE_REVIEW_KEY` | yes | yes, only after a live probe says `collector_search` | **no** |
| Cursor | same MCP server | yes | yes | **no** |
| Bill | `/editor.html` → **Extractor locks** tab (`EDITOR_KEY` or `EDITOR_EMAILS`) | yes | yes | **yes** |

An approved lock takes effect for members immediately (runtime overlay in `urlFinder.lookupForApi`, reloaded from Postgres at boot and after every decision) and writes a new extractor version with `source = editor_lock`.

## Tools

| Tool | Does | Writes? |
| --- | --- | --- |
| `extractor_stats` | Coverage: total, verified, by probe status, editor-locked, DeepShake queue, proposals | no |
| `extractor_lookup` | One county: entity, URL, verified + source, last probe, dump candidate | no |
| `extractor_list` | Page by `status` / `state` / `verified` (`has_more`, `next_offset`) | no |
| `extractor_validate` | Live probe one county or candidate URL: verdict, DR columns seen, Cloudflare, `lock_eligible` | no |
| `extractor_validate_batch` | Live probe up to 25 keys, 4 at a time, with a verdict tally | no |
| `extractor_discover` | From the stored page and dump candidate, follow pay/vendor links and treasurer pages (2 hops), probe each link, return the best collector page | no |
| `extractor_discover_batch` | Discover for up to 10 keys, 3 at a time | no |
| `extractor_propose_lock` | Probe, then queue the URL for Bill. Refuses non-collector pages unless `force_review` + note | proposal only |
| `extractor_lock_queue` | Proposals by status | no |

## Run it

```bash
npm run mcp:extractors                       # stdio; memory mode without DATABASE_URL
DATABASE_URL=postgres://... npm run mcp:extractors   # proposals land in production review queue
```

Claude Desktop / Cursor config entry (Mac, clone outside iCloud):

```json
"webpoint-extractors": {
  "command": "node",
  "args": ["/Users/billmccreary/repos/tcp-own-llm-push/mcp/extractors-server.js"],
  "env": { "WEBPOINT_MCP_ROLE": "claude", "DATABASE_URL": "<Render external DB URL, never commit>" }
}
```

## Working loop (how the 2,192 unverified counties get done)

1. `extractor_stats` → pick a lane, e.g. `extractor_list {status: "unknown_live", state: "TX"}`.
2. `extractor_validate_batch` on 25 keys at a time.
3. `collector_search` + not Cloudflare → `extractor_propose_lock`.
3b. Homepage / assessor / dead → `extractor_discover_batch` (10 at a time), then propose each `best.final_url`.
4. Cloudflare / no form / timeout → DeepShake queue (user Chrome session), not a lock.
5. Bill clears **Extractor locks** in `/editor.html`. Each approval goes live at once.
6. One 1000TK line per batch: counts proposed / locked / rejected.

Network note: probes need open egress. Run the server on the Mac or on Render, not inside a locked-down sandbox.

## 2026-10-03 baseline (read-only passes from the Mac)

- TX + FL stored URLs, 140 unverified: 0 collector (68 homepage, 46 assessor, 20 dead, 6 unknown).
- 2k-dump candidates for 529 unverified counties in TX GA WI NE OH VA IN MN MO NC: 0 collector (330 dead, 142 homepage, 42 unknown, 15 assessor; 70 need DeepShake).
- Conclusion: re-probing known URLs is exhausted. Discovery is the path for the remaining 2,192.
