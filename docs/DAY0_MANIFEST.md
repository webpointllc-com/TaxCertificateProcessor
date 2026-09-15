# Day 0 manifest — S-PUL

**What this is:** Search Page URL Locator. Type a place → registry-locked official tax search URL + confidence, or an honest miss. Never invents URLs.

**Product home:** `spul/` inside [TaxCertificateProcessor](https://github.com/webpointllc-com/TaxCertificateProcessor)  
**Not a separate repo.** `webpointllc-com/webpoint-spul-beta` → GitHub **404** (dead). Do not recreate it for Day 0.

## Reviewer opens today

| Priority | Link |
| --- | --- |
| **Primary** | [PR #8](https://github.com/webpointllc-com/TaxCertificateProcessor/pull/8) — searchpages / best embed (`s-pul-front_end-Betasearchpages-best-55de`) |
| Parent pack | [PR #7](https://github.com/webpointllc-com/TaxCertificateProcessor/pull/7) — Adam clean-share |
| Invite Adam | [settings/access](https://github.com/webpointllc-com/TaxCertificateProcessor/settings/access) |

## Boot (local)

```bash
git checkout s-pul-front_end-Betasearchpages-best-55de
cd spul
cp .env.example .env   # PORT=3000; GROQ_API_KEY optional
npm install
npm start
```

| Check | URL |
| --- | --- |
| Health | `http://localhost:3000/api/health` → `ok` |
| UI | `http://localhost:3000/` |
| Embed | `http://localhost:3000/?embed=1` |

**Env:** `PORT` (default 3000), `HOST` (default `0.0.0.0`). `GROQ_API_KEY` optional (nicer guide narration only). No secrets required to review search.

## In / out

| In | Out |
| --- | --- |
| `spul/` app + `data/` (1675 validated-true URLs) | Root `index.html` (“I Just Farted” — ignore) |
| Registry-locked `/api/search`, `/api/guide` | Invented URLs / live beta Three.js as product |
| Embed docs for Squarespace `/searchpages` | AWS deploy work in this Day 0 pass |
| Offline extractors contract | DEP Highlighter · `kata_deploy` · Stripe |

## Collaborator log (Continuity Wall)

There is **no MCP telepathy bridge.** Collaboration trail = **git history + PR discussion + the Continuity Wall** (blog-style posts Bill can actually look at).

| Surface | Path |
| --- | --- |
| **Continuity Wall (canonical)** | [`spul/widget/wall/posts.jsonl`](../spul/widget/wall/posts.jsonl) |
| Wall UI (Mac) | `bash spul/widget/mac/open-widget.sh` → http://127.0.0.1:3847/ |
| AI contract (required posting rules) | [`spul/widget/README.md`](../spul/widget/README.md) |
| Twin sync (Cursor ↔ Claude Desktop) | [`spul/widget/TWIN_SYNC.md`](../spul/widget/TWIN_SYNC.md) |
| Legacy memory mirror | [`spul/widget/PROJECT_MEMORY.json`](../spul/widget/PROJECT_MEMORY.json) |

**Rule:** after any S-PUL change, post to the wall with a GitHub or local ref. Claude Desktop is the only other AI on the wall besides Cursor.

Onboarding narrative: [`docs/spul-clean-share/ADAM_ONBOARDING.md`](./spul-clean-share/ADAM_ONBOARDING.md).

## Already on disk (pointers)

- App README: [`spul/README.md`](../spul/README.md)
- Product pointer: [`SPUL.md`](../SPUL.md)
- Continuity Wall + Mac launcher: [`spul/widget/`](../spul/widget/)
- Embed: [`docs/SEARCHPAGES_EMBED.md`](./SEARCHPAGES_EMBED.md)
- Clean-share pack: [`docs/spul-clean-share/`](./spul-clean-share/)
- Historical Render proto: root `render.yaml` (not production)

## Missing blanks (honest)

- Root `README.md` still describes the old fart demo — use `SPUL.md` / this file / `spul/README.md` instead.
- No Dockerfile; production host path is documented sketch only (`docs/aws/LIGHTSAIL_MINIMAL.md`).
- Live public URL for `/searchpages` may still be cold Render proto — local boot is the Day 0 proof.
