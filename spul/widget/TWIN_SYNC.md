# Twin sync — Cursor ↔ Claude Desktop

Honest bridge only. **No MCP telepathy.** The Continuity Wall is the shared meeting place for Bill, Cursor, and Claude Desktop (the only other AI on the wall).

## One-liner

**Both AIs read `spul/widget/wall/posts.jsonl` and post there; Bill watches the UI; “Copy twin pack” pastes latest wall + Day 0 context into the other AI.**

## Who does what

| Actor | Role |
| --- | --- |
| **Bill** | Opens Mac launcher, watches the wall, posts when he decides something. Does not re-explain work already on the wall. |
| **Cursor agent** | Reads wall + Day 0 at start; after S-PUL changes, POSTs with GitHub/local refs (`author: cursor`). |
| **Claude Desktop** | Same wall file / API (`author: claude-desktop`). Handles Mac-side paths (iCloud EF_EE, local scripts) Cursor cloud cannot see. |

## Copy-paste twin pack

In the wall UI: **Copy twin pack** → paste into the other AI’s chat.

Or:

```bash
curl -sS http://127.0.0.1:3847/api/twin-pack
```

Pack includes: Day 0 branch/PR/stats, wall path, AI contract pointer, last ~12 posts.

## Repo patterns reviewed (honest pick)

| Pattern | Where | Verdict for twin coord |
| --- | --- | --- |
| Continuity memory JSON | `spul/widget/PROJECT_MEMORY.json` | Kept as legacy mirror; **wall JSONL supersedes** as canonical trail |
| Day 0 “no MCP twin bridge” note | `docs/DAY0_MANIFEST.md` | Still true — paste + shared file remains the bridge |
| DeepShake / extractors | `spul/extractors/`, Mac hunt scripts | Offline URL quality — **not** a twin channel |
| CARBON / `cursor_memory` | Mac-only (unreachable in cloud) | Unreachable here; do not invent; paste hits into wall if needed |
| Clean-share merge notes | `docs/spul-clean-share/MERGE_SOURCES.md` | Documents Mac gaps — wall posts should cite those gaps instead of re-asking |

**Best way:** chronological wall posts with refs + twin pack paste. That is the organized middle without endless reiteration.

## Ritual (keep short)

1. Start → read wall (filter your author if noisy) + `docs/DAY0_MANIFEST.md`.
2. Work → change `spul/` (registry-locked; no invented URLs).
3. Finish → post change with outcome + links.
4. Hand off → Copy twin pack into the other AI once; point at the new post id/title — do not re-dump the whole project.

## EF_EE example (Bill → Claude)

Bill should not have to repeat:

> Go to `…/EF_EE_PORT`, read `EF_EE_CHECKPOINT_LOG.jsonl`, visualize the **2026-09-10** datapoint, post missed recent changes on the wall.

Claude Desktop on Mac:

```bash
bash spul/widget/mac/open-widget.sh   # if not already up
bash spul/widget/mac/import-ef-ee-checkpoint.sh 2026-09-10
```

Then POST any missed recent changes as normal wall entries. Cursor picks them up from `posts.jsonl` / the UI.
