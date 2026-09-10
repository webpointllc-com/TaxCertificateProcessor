# S-PUL — what the boss looks at, what we pay, how we sell it

**Date:** 2026-09-10  
**For:** Bill → boss review  
**Product:** S-PUL generative search only — return the jurisdiction URL + confidence, or say we do not have one.  
**Not in this build:** Central Intelligence orchestrator, voice-first, RAG-over-everything.

This is a reversal of the 2026-08-10 “lead with CI” workbook. It is a yes, not a pause.

---

## 1. URLs to open first (live, right now)

Open these in order. Status was checked 2026-09-10 from this environment.

| # | What | URL | What you will see |
| --- | --- | --- | --- |
| 1 | **Account-of-record domain** | https://taxcert.ai | HTTP 301 → `https://webpointllc.com/` (Squarespace). Domain is live. It is **not** an S-PUL app yet. |
| 2 | Same, www | https://www.taxcert.ai | Same redirect. DNS is Squarespace (`ext-sq.squarespace.com` / `198.185.159.x` / `198.49.23.x`). |
| 3 | **Current marketing site** | https://webpointllc.com | HTTP 200, Squarespace. This is the public face today. |
| 4 | www alias | https://www.webpointllc.com | 301 → `https://webpointllc.com/` |
| 5 | **webpoint.com (do not assume this is us)** | https://webpoint.com | Different IP (`217.19.248.132`), nginx. Fetch of `/` returned 404. Treat as **not** the S-PUL product until ownership is proven in the registrar. |
| 6 | **Kamatera login (must confirm tonight)** | https://console.kamatera.com | Sign in as **ci@taxcert.ai**. Confirm: account active, server running, **actual invoice amount**. The ~$55/mo figure is **unverified** (matches public 4 vCPU / 8GB Type B list price; last logged 2026-08-05, not re-checked against billing). |
| 7 | Render dashboard | https://dashboard.render.com | See what is still billed. Prototype onrender hostnames below are **dead**. |
| 8 | Google OAuth project (create under taxcert.ai) | https://console.cloud.google.com/apis/credentials | $0. This is the only Google surface we need: OAuth client ID + secret. Not Identity Platform. Not Firebase user hosting. |
| 9 | Stripe (billing — open account, $0 until a customer pays) | https://dashboard.stripe.com | Create the account under **taxcert.ai**. This is how we charge B2B membership. |
| 10 | S-PUL code (the answering registry) | https://github.com/webpointllc-com/search-spul-test | Node/Express + county URL files. Last push 2026-05-18. Groq is in this prototype — **drop Groq for the owned product**. |
| 11 | Draft fusion PR — **wrong direction for this build** | https://github.com/webpointllc-com/TaxCertificateProcessor/pull/2 | Still assumes **pay Render + Render Postgres + Groq RAG + Squarespace members**. Do not apply that Blueprint. |
| 12 | Groq (prototype only — do not keep) | https://console.groq.com | Third-party inference. Conflicts with the 2026-09-07 “no third-party managed services” rule. Registry lookup does not need it. |

### Render hostnames that are dead (do not send the boss here as “the app”)

| Hostname | Status 2026-09-10 |
| --- | --- |
| https://search-spul-test.onrender.com | `404` `x-render-routing: no-server` |
| https://webpoint-spul-beta.onrender.com | `404` `no-server` |
| https://webpoint-mobile.onrender.com | `404` `no-server` |
| https://webpoint-shipyard.onrender.com | `404` `no-server` |

The 2026-08-10 manifesto said `webpoint-spul-beta` used to sit behind webpointllc.com. **That is not true today.** webpointllc.com is Squarespace only. The onrender prototypes are gone or never applied.

**Kamatera dashboard:** still no session here. Bill opens https://console.kamatera.com as ci@taxcert.ai.

**Render (2026-09-10 retry):** Gate received; not stored. This cloud agent **cannot** complete Render’s interactive OAuth (desktop Cursor only). Dashboard email/password login failed for `billjr@webpointllc.com` and `ci@taxcert.ai`. The account looks like **Google sign-in**, not a Render-native password. Public onrender hostnames above remain `404 no-server`.

To authorize this agent later, Bill logs into Render himself, then either:
- Cursor Desktop → complete the Render MCP OAuth prompt, or
- Dashboard → Account Settings → API Keys → create a key (`rnd_…`) and put it in the **environment secret** `RENDER_API_KEY` (never git).

---

## 2. Clean yes / no (do not carry last August forward)

| Decision | Answer | Meaning |
| --- | --- | --- |
| Central Intelligence orchestrator | **OUT. Not paused.** | No Path A, no cross-tenant learning, no orchestrator, no RAG index. Sheet 4 of the 2026-08-10 workbook is not in this build. |
| Voice-first | **OUT. Entirely.** | No voiceprint login, no TTS, no orb. Google OAuth is identity. |
| One Postgres, ours | **YES** | One database on the Kamatera box. Not a second “feedback database.” Not Render Postgres. |
| Account / domain of record | **taxcert.ai** | Avoids the unresolved Workplace Technologies vs Webpoint ownership question. Email of record: **ci@taxcert.ai**. |
| Move off Render | **YES — no carve-out needed if Kamatera is live** | 09-07 rule stands. Prototype onrender URLs are already dead. Do not re-apply PR #2’s Render Blueprint. |
| How we charge customers | **Stripe subscriptions on the org, not Squarespace Members** | B2B account access. Google login is identity; Stripe is money. |

---

## 3. What we sell

Not a consumer “member area.” Not a Squarespace Members paywall.

**We sell a company account** that can hold several Google-login seats.

Historical buyers (from `WPT Production Log 03012018.xlsx`): CoreLogic, Lereta, Lument, NTS, UPF — production **files**, not software seats. S-PUL is a different product: **access to the jurisdiction search**, billed as membership.

### Recommended packaging

| Plan | Who | What they get | How it is billed |
| --- | --- | --- | --- |
| **Pilot** | Us + 1 design-partner firm | Owner seat + a few users, search + thumbs/correction | $0 or a token fee so Stripe is proven |
| **Firm** | Title / tax-cert shop | N seats, monthly search quota, feedback that we can use to fix URLs | Stripe subscription on the **org** |
| **Enterprise** | Repeat production clients | Same + more seats / quota; invoicing via Stripe if they will not put a card on file | Still Stripe; we do **not** build a custom billing engine |

**Do not** put membership behind Squarespace Members. Squarespace would then own the login wall. That is the opposite of “we are in charge of accounts.”

Google OAuth is **not** the product. It only answers “who is this person.” Our `orgs` + `users` tables answer “which paying company, which role, are they allowed to search.”

---

## 4. What we have to pay to keep this ours and sellable

Figures are public list prices or last-logged notes. **Kamatera invoice is unverified until console.kamatera.com is opened as ci@taxcert.ai.**

### A. Must-pay (keep the lights on, we own it)

| Item | Who we pay | URL to manage it | Est. cost | Own the data? |
| --- | --- | --- | --- | --- |
| **Kamatera VPS** (4 vCPU / 8GB, Docker, TaxCert.ai today) | Kamatera | https://console.kamatera.com | **~$40–$55/mo** (public 4c/8GB; $55 = Type B 80GB listing). **Confirm on the invoice.** | Yes — our VM, our Docker, our Postgres |
| **taxcert.ai domain** | Registrar (DNS currently Squarespace) | Squarespace domains / nic.ai WHOIS | **~$80–$140/year** typical for `.ai` | Yes if the registrant is us |
| **webpointllc.com domain** | Same Squarespace DNS | Squarespace | ~$12–$25/year typical `.com` | Marketing site; not the S-PUL account of record |
| **Squarespace site** (marketing only) | Squarespace | https://account.squarespace.com | **~$16–$39/mo** annual plans (Basic–Plus, 2026 public list). Keep for the brochure. **Do not** use Members for S-PUL accounts. | Marketing pages only |
| **Email ci@taxcert.ai** | Already in use | Google Workspace if that is how the mailbox is hosted | Google Workspace **~$6–$12/user/mo** if billed; **confirm in Google Admin** | Mailbox we control |

### B. $0 until a customer pays — still required to *sell*

| Item | URL | Cost to stand up | Rule |
| --- | --- | --- | --- |
| **Google OAuth client** | https://console.cloud.google.com/apis/credentials | **$0** | Handshake only. We store users in **our** Postgres. Do not buy Identity Platform / Firebase Auth as the user store. |
| **Stripe account + Billing** | https://dashboard.stripe.com | **$0** until first charge. Then US cards **2.9% + $0.30** plus Stripe Billing **0.7%** of subscription volume (2026 public list). | Standard for B2B SaaS. Do not write a custom card vault. |
| **TLS** | Let’s Encrypt on the Kamatera box | **$0** | nginx/Caddy on our VM. |
| **GitHub** (code) | https://github.com/webpointllc-com | **$0** on public repos | Keep secrets out of git. |

### C. Do **not** add (conflicts with 09-07, or already dead)

| Item | Why not |
| --- | --- |
| **Render web + Render Postgres** | PR #2 priced this as Starter **$7/mo** + Basic-256mb Postgres **$6/mo** (~$13/mo). That is a **third-party managed database**. 09-07 forbids it. The four onrender URLs above are already `no-server`. |
| **Groq** | Prototype used Llama 3.3 70B. Free tier is 1,000 req/day. Paid is per-token. S-PUL answering is the **registry**, not a hosted LLM. |
| **Squarespace Members** | Puts account access on Squarespace’s membership system. We would not own the accounts. |
| **Voice / ElevenLabs / GPU model host** | Out of scope. |
| **Pinecone / Algolia / OpenAI embeddings** | RAG is out. |

### D. Optional but recommended once money is real

| Item | Why | Est. |
| --- | --- | --- |
| **Kamatera daily backup** or offsite `pg_dump` | Owning the server means owning restores. Untested backups are not backups. | Kamatera backup add-on or a cheap second disk / object copy |
| **Second Kamatera instance** | Isolate S-PUL from TaxCert.ai if the current 4c/8GB box is already loaded. Same account, new bill line. | Another **~$19–$55/mo** depending on size |
| **Uptime check** | First outage should not be a customer phone call | Self-hosted; do not buy a third-party status SaaS unless boss carves an exception |

### Honest monthly floor (owned stack)

If Kamatera is already paid for TaxCert.ai and S-PUL **shares that box**:

- **Incremental new cash: ~$0–$20/mo** (backups) + domain/Squarespace you already pay.
- **Stripe: $0 until first paying org.**

If the box cannot take another Docker stack, add a sibling VPS on the **same ci@taxcert.ai account** (~$40–$55/mo). Still no Render.

**Do not tell the boss Kamatera is a sunk $55 until someone opens the invoice.**

---

## 5. Account model (B2B, one Postgres)

Google supplies: Google user id (`sub`), email, name.  
We mint: our own session token (same pattern as RTT `session_tokens.py` — **store the hash in Postgres**, not an in-memory dict).

```
orgs
  id, name, billing_email, stripe_customer_id, stripe_subscription_id,
  plan, status, created_at

users
  id, org_id, google_sub, email, name, role (owner|admin|user), created_at

sessions
  id, user_id, token_hash, expires_at, created_at

jurisdictions          -- the S-PUL registry (URL truth)
  key, state, county, search_url, verified, confidence_notes, ...

search_results
  id, org_id, user_id, query, jurisdiction_key, url, confidence,
  no_result_reason, created_at

feedback
  id, org_id, user_id, search_result_id,
  vote (up|down), correction_url, free_text, allow_contact, created_at
```

**Every table that holds customer activity has `org_id`.** One company’s searches never leak into another’s. Feedback is keyed to the user **and** the search/result.

User permission: the app asks **Allow** before we store identity, write feedback, or contact them. No silent capture.

### Registry size (do not quote “875” as the live number)

| Source | Count | Date |
| --- | --- | --- |
| ExtractorUrls dump (`ExtractorUrls.txt`) | **2,085 extractors**, **1,281 unique URLs**, 1,064 hosts | 2026-09-09 |
| search-spul-test `data/counties.json` | Import commit: **1,760 counties** | 2026-05-18 |
| Fusion PR #2 notes | ~2,923 WPT sheet counties | 2026-09-08 |

The answering engine is this registry. If there is no verified URL: **say so**. Do not invent one. Do not fall back to Google.

---

## 6. What to build next (order)

1. **Boss confirms taxcert.ai** as account of record (email + Google Cloud project + Stripe + Kamatera all under that).
2. **Bill opens Kamatera** as ci@taxcert.ai: screenshot invoice + Docker list. If TaxCert.ai already occupies the box, decide same-box vs sibling VPS.
3. Stand up **Postgres in Docker** on that box. Migrate nothing from Render unless dashboard #7 shows a live database with data (this agent could not see one).
4. Wire **Google OAuth → sessions table → orgs/users**.
5. Point **app.taxcert.ai** (or `search.taxcert.ai`) at the Kamatera IP. Stop using taxcert.ai as a 301 to the brochure.
6. Stripe products: Firm plan subscription. Webhook updates `orgs.status`.
7. Feedback UI: thumbs, correction URL, free text, Allow-to-contact. Writes only to our `feedback` table.
8. **Do not** merge PR #2 as the production architecture.

---

## 7. Pitch sentence for the boss

> We own **taxcert.ai**, we operate the server under **ci@taxcert.ai** (Kamatera, confirm the invoice), customers sign in with Google, **we** keep users / searches / feedback in **our** Postgres, S-PUL answers from **our** URL registry with a confidence score or an honest miss, and Stripe bills the **company** for account access. No Central Intelligence, no voice, no Render database, no Squarespace membership wall.

---

## 8. What this agent could not verify (say this out loud)

- Kamatera account active? Exact $55? Docker still running TaxCert.ai? **Need console.kamatera.com as ci@taxcert.ai.**
- Render leftover bill after the 2026-08-09 declined-card note: still **not listed**. Dashboard login from this agent failed (Google OAuth). Bill opens https://dashboard.render.com on his machine, then creates an API key if we need a service inventory.
- Google Workspace billing for ci@taxcert.ai.
- The Excel sandbox workbook at  
  `/Users/billmccreary/Library/Containers/com.microsoft.Excel/.../Claude-by-Anthropic-for-Excel (version 2).xlsb`  
  is on Bill’s Mac, not in this cloud workspace. Not read. Not written.
- DeepShake is a local Mac extractor. It does not check billing. Not run from here.

Checked instead: public DNS/HTTP for the domains above, GitHub repos, the 2026-08-10 architecture workbook, ExtractorUrls.txt, WPT Production Log, and the 2026-09-08 fusion PR.
