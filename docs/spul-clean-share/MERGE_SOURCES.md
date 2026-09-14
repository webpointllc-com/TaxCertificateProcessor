# Merge sources — Adam clean-share (2026-09-14)

What this branch actually absorbed vs what remains Mac-only / unreachable from the cloud agent.

**Branch:** `s-pul-front_end-Betaadam-clean-share-39e4`  
**Out of scope:** `kata_deploy/` not expanded; DEP Highlighter untouched.

---

## Merged into this share pack (reachable)

| Source | What landed | Where |
| --- | --- | --- |
| `TaxCertificateProcessor` `spul/` (PR #4 lineage) | Canonical product tree, URL lock, UI, validators, 1675 CSV | `spul/` + keep table in [AUDIT_MEMO.md](./AUDIT_MEMO.md) |
| Live `https://webpoint-spul-beta.onrender.com` (read-only) | Pipeline / UI keep-drop decisions when GitHub commit unreachable | [AUDIT_MEMO.md](./AUDIT_MEMO.md) §C, [BEST_COMPONENTS.md](./BEST_COMPONENTS.md) |
| `search-spul-test` (public / accessible) | `spulTruth` + deploy patterns already reflected in `spul/` | keep notes in audit |
| Existing T7 / DeepShake **docs already in-repo** | Ops pointers only (no volume contents) | `docs/AUTODEPLOY_VARIABLE/T7_*`, `DEEPSHAKE_STATUS.md` |
| This pack’s onboarding docs | Adam day-1 + tree + AWS pointer | this folder + `docs/aws/LIGHTSAIL_MINIMAL.md` |

---

## Still Mac-only / not mergeable from this VM

| Source | Probe (re-check) | Gap |
| --- | --- | --- |
| Samsung T7 (`/Volumes/T7` on Bill’s Mac) | **Unreachable** — no `/Volumes` on Linux cloud | Cannot merge DeepShake trees, auto-deploy notes, or workplace clones from the drive. Bill: `cursor worker start` on Mac with T7 mounted, or paste/copy paths into repo. |
| Claude Desktop / `cursor_memory` **CARBON** greps | **Unreachable** — no Claude Desktop / Mac `cursor_memory` paths here | No CARBON hits to merge. Bill: paste grep hits into chat or a `docs/spul-clean-share/from-mac/` note if anything should enter the pack. |
| GitHub `webpointllc-com/webpoint-spul-beta@5ef1a1cc20f31e99db17b9837827f62e7cc7c3b9` | **404** again (`gh api` repo + commit Not Found) | Architecture not fetchable. **Kept** prior live-beta audit notes in [AUDIT_MEMO.md](./AUDIT_MEMO.md) instead of inventing commit contents. |

---

## What Bill can unblock next

1. Mount T7 + start a Mac Cursor worker, **or** copy selected folders (no Highlighter sources) under a share path.  
2. Paste CARBON / `cursor_memory` hits if they change keep/delete decisions.  
3. Grant this token read access to `webpoint-spul-beta`, **or** paste the commit tree / architecture notes.
