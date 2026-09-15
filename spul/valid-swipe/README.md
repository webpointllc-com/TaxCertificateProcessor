# S-PUL Valid — Tinder for tax URLs

Mobile-first personal validation UI for the **1675** county|URL grid.

Bill sits on iPhone, sees each tax-collector search page in an iframe (or opens it if the site blocks embeds), taps **✓ validate** or **𐄂 not-valid** (or swipes right/left). No decision timer. Progress + answers stay in **IndexedDB** / localStorage. **end session** (top right) downloads a color-coded HTML report — each session batch keeps its text color.

## Open on phone / Mac

Serve the folder (required so `urls.js` loads):

```bash
cd spul/valid-swipe
python3 -m http.server 3850
```

Then open `http://<your-mac-lan-ip>:3850/` on the iPhone (same Wi‑Fi), or `http://127.0.0.1:3850/` on the Mac.

Or from repo root:

```bash
cd spul/valid-swipe && python3 -m http.server 3850
```

## Controls

| Control | Action |
|--------|--------|
| ✓ validate (blue pill) / swipe right | Mark URL valid for this county |
| 𐄂 not-valid (red pill) / swipe left | Mark not-valid |
| end session (top right, Poppins 10 grey) | Download report / new session color / keep going |

## Report

Downloaded HTML table columns: `#`, County, ST, Verdict, URL, Session, When.  
Row **text color** = session color so batches are differentiable across downloads.

## Data

- `urls.js` / `urls.json` generated from `docs/SPUL_VALIDATED_COUNTY_URL_GRID.txt`
- Re-generate: parse grid → write `urls.json` + `urls.js` (see repo scripts / prior node one-liner)

## Note on iframes

Many county sites send `X-Frame-Options` / CSP and won’t render inside an iframe. The UI offers **Open search page**; you still tap Yes/No after looking. That is expected — the log still captures your personal call.
