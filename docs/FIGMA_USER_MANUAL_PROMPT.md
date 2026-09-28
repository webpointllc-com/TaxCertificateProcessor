# Claude.ai → Figma prompt

Paste the block below into Claude.ai with the Figma integration enabled. Do not add repo, agent, or implementation notes. This prompt is for a **polished WebPoint user manual** artboard set.

---

```
You are a senior brand designer working in Figma for WebPoint LLC (webpointllc.com).

GOAL
Create a complete, export-ready USER MANUAL for the WebPoint Tax Certificate Processor — the paid-members tool embedded on webpointllc.com. Audience: title, tax-service, and mortgage professionals. Tone: Integrate. Automate. Deliver. Clean, confident, short. Not developer docs.

USE FIGMA
Create a new Figma file named “WebPoint — Tax Certificate Processor User Manual”. Build real frames, auto-layout, components, and styles. Do not stop at a written description. After the frames are done, export:

• PDF: one combined landscape PDF (all desktop frames in order)
• PNG: one 2x PNG per frame, named wp-manual-<frame-slug>.png

ARTBOARD SIZE (CRITICAL)
Desktop frames: exactly 1280 × 800 px. This is the product canvas.

Mobile: do NOT create a stacked / hamburger / single-column mobile redesign. “100% scalable” means the UI looks the EXACT SAME (identical proportional layout) on a phone as on a desktop. Mobile frames are the 1280×800 composition scaled to fit a phone-width iframe whose box is width 100% and padding-top 62.5% (800/1280).

Create a second page “Mobile iframe (scaled, not reflowed)” with the same nine frames placed inside a device/iframe mock (e.g. 390×244 content area or any phone width with 62.5% aspect). Scale the desktop artboard uniformly. Do not restack columns. Do not convert the product nav into a vertical list.

BRAND — match live webpointllc.com + this product
Wordmark: WEBPOINT LLC (all caps, wide tracking).
Tagline: Integrate. Automate. Deliver.
Font: DM Sans (400/500/600/700). URLs and hosts: DM Mono.
Hero titles: 135° gradient #3EC4FF → #FFFFFF at 55% → #3EC4FF, clipped to text.
Mark: 36px rounded square, radial gradient #9AE2FF → #1B6FE0 → #0B2C70, cyan glow.

Color tokens (use as Figma color styles):
• bg            #050B20
• panel         rgba(8, 18, 48, 0.92)
• panel-border  rgba(70, 130, 210, 0.28)
• fill          rgba(255, 255, 255, 0.06)
• text          #D7ECFF
• muted         #7EA0C8
• blue          #3EC4FF
• blue-deep     #1A7AD4
• glow          rgba(62, 196, 255, 0.28)
• ok            #3DDC8A
• warn          #F0C14B
• danger        #FF6B7A
• canvas wash   radial #288CFF ~18% opacity upper-left, #1450B4 ~16% lower-right, on #050B20

Chrome:
• Page padding 18×20. Gap 12. Cards radius 16 (inner 12). Buttons radius 12.
• Full 1px borders on every card, pill, and panel. Glass panels. Cyan glow on the active product and primary CTA.
• Primary button: linear gradient #3EC4FF → #1A7AD4, text #041226, glow.
• Pills: 999 radius, fill + full border.

FORBIDDEN (Bill / WebPoint UI law)
• NEVER thin single-line left-side container borders or accent stripes.
• No vertical connector rails, no border-left accent bars, no 1–3px ::before/::after left lines.
• Use full borders, spacing, background fills, chevrons, or glow instead.
• Do not invent collector URLs. Chippewa tax-search lock is exactly:
  https://pp-chippewa-co-wi-fb.app.landnav.com/login/index/
• Do not show internal tools, repos, keys, or “Passport”.

PRODUCT TRUTH (labels must match the live tool)
Header: WEBPOINT LLC / Tax Certificate Processor
Products (four equal nav cards, never stacked):
• TCS — Tax certificates → panel title “Tax Certification System” — Collector-current certificate drafts. First county: Chippewa, Wisconsin.
• TPA — Portfolio analysis → “Targeted Portfolio Analysis” — Batch parcel tax status for the same closing.
• RDS — Recorded documents → “Recorded Document Search” — County recorded-document portal with parcel context.
• S-PUL — Search page locator → “Search Page URL Locator” — Locked official tax-search URLs.
Form fields: File number (Closing file #), Client (Title / tax service), County (Chippewa), State (WI), Closing date, Owner (optional) Last, First.
Parcels: Parcel ID, Owner last, first, Address. Caption “max 10 — LandNav / WebPoint demo cap”. Button “Add parcel” / “Max 10 parcels”.
Primary: “Process batch”. Secondary: “Open collector portal”.
Certificate card: “{parcel} · {tax status} · as of {date}” plus narrative plus link “Open collector / search page”.
Ask panel title: “Search Spul” — “Type a county. The locked collector URL appears first. RAG explains after — never invented links.” Hero search placeholder: “Chippewa County WI”. Button “Search”. Chat placeholder: “Ask how to search or pay…”. Button “Ask”. Result: “Open official tax search page” + host + confidence pill verified | pattern_matched | not_found.
Chippewa portal: Guest Sign In. Local municipal treasurer collects current Dec/Jan installments; county treasurer collects postponed/delinquent.

NINE DESKTOP FRAMES (1280×800) — use this exact order and these frame names:

1. Cover
   WEBPOINT LLC wordmark, tagline Integrate. Automate. Deliver., title “Collector-current tax certificates, on the members page.” Four glass product cards (TCS/TPA/RDS/S-PUL). Right side: vertical flow diagram — Paid members page → Tax Certificate Processor → Official collector portal (LandNav Guest Sign In). Chevrons between full-border rounded cards. No left rails.

2. Members access
   Title “How to open it”. Four numbered step cards (sign in on webpointllc.com → processor in the members frame → pick TCS/TPA/RDS/S-PUL → Open collector portal). Right: diagram proving desktop 1280×800 equals the phone iframe (same two-column workspace scaled). Callout: padding-top 62.5%. Header pill “User guide”.

3. TCS flow
   Recreate the live TCS screen (do not restack). TCS nav active. Panel title Tax Certification System. Sample file #, Chippewa / WI, one parcel row, Process batch + Open collector portal. Right: S-PUL panel. Overlay numbered badges 1–4 on pick product, enter file, add parcels, Process batch. Caption: collector-current certificate drafts.

4. TPA flow
   Same chrome; TPA active. Title Targeted Portfolio Analysis. Show 4–6 parcel rows for one closing file. Caption: batch parcel tax status for the same closing.

5. RDS flow
   RDS active. Title Recorded Document Search. Certificate/result pointer to county recorded-document portal. Chippewa RDS is the county Online Real Estate Search (do not invent a different host). Keep parcel context visible on the order.

6. S-PUL
   S-PUL active. Title Search Page URL Locator. Right panel featured: locked URL card, VERIFIED pill (full-border, not a left stripe), link “Open official tax search page”, host pp-chippewa-co-wi-fb.app.landnav.com, note Guest Sign In. Diagram: lock + “Official page only — never invented”.

7. Batch of 10
   Visual of ten equal parcel tiles (5×2) inside a glass panel, CTA “Process batch · max 10”. Note: LandNav Chippewa payment cap = WebPoint demo cap. “Add parcel” disabled state labeled “Max 10 parcels”. Split the order if more than ten.

8. Certificate result
   After Process batch. One or two cert cards:
   12-345-6-789 · unknown · as of [today]
   Narrative: TCS draft … Confirm amounts on the official portal before closing.
   Link: Open collector / search page → the Chippewa LandNav login URL above.
   Status line example: Order abc123ef · issued · Chippewa County WI Treasurer — LandNav public portal.

9. FAQ
   Glass Q&A cards (full border, numbered badges or chevrons — no left accent bars):
   • As-of date = draft generation date; verify on the portal; rerun the batch for an update.
   • Chippewa Guest Sign In is correct on the locked LandNav page.
   • Local municipal treasurer vs county treasurer (current installments vs postponed/delinquent).
   • Updates = new batch, new as-of, same file number when possible.
   • “verified” = URL locked from WebPoint’s jurisdiction list, not a guessed link. pattern_matched needs confirmation. not_found = no locked URL; do not invent.
   • Support: Request Access on webpointllc.com or your WebPoint representative. Confirm every certificate on the official search page.

LAYOUT SYSTEM
Top bar (brand + pills) → four or five equal module cards → two-column workspace (order panel ~1.45, ask/diagram panel ~0.9). This composition is sacred. Repeat it on every frame so the manual feels like the product.

DIAGRAM RULES
Inline, geometric, WebPoint: rounded 14–16px cards, 1px full stroke, cyan glow on the active node, downward/right chevrons (filled triangles) between nodes. No connector rails along the left edge. No sketchy arrows. Dark navy fills, glass, gradient CTAs.

EXPORT
When frames are complete:
1. Export each desktop frame PNG @2x.
2. Export the mobile-iframe page PNG @2x (optional contact sheet).
3. Export a single landscape PDF of the nine desktop frames for the website.
4. Reply with the Figma file link and a checklist that every frame is 1280×800, mobile is scaled-not-reflowed, Chippewa URL is the LandNav lock, and there are zero left accent stripes.
```
