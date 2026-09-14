# Adam onboarding — S-PUL (5 bullets)

**Canonical repo:** https://github.com/webpointllc-com/TaxCertificateProcessor  
**App directory:** `spul/`  
**Do not start from:** root `index.html` (unrelated), live `webpoint-spul-beta` UI, or DEP Highlighter.

1. **Clone & run locally**  
   `git clone … && cd TaxCertificateProcessor/spul && cp .env.example .env && npm install && npm start` → open `http://localhost:3000`. Confirm `GET /api/health` returns `ok`.

2. **Learn the product law**  
   S-PUL returns a **registry-locked** jurisdiction Search/Base URL + confidence, or an honest miss. It does **not** invent domains. Read `services/spulTruth.js` and `docs/prototype-best-practice/QUERY_SHAPES.md`.

3. **Know the data**  
   Runtime: `data/search-index.json`. Evidence: `data/validated-true-urls.csv` (**1675** true as of 2026-09-13). Full list: `docs/SPUL_DESCRIPTION_AND_VALIDATED_URLS.txt`. Offline revalidate: `npm run health:hybrid` / `health:remainder` (slow; not required day 1).

4. **Deploy target is AWS, not Render**  
   Follow `docs/aws/LIGHTSAIL_MINIMAL.md` (Lightsail or single EC2 + Caddy). Bind `0.0.0.0:$PORT`. Secrets only in host env / SSM — never git. Render free is historical demo only.

5. **Extractor / DeepShake boundary**  
   Live API stays dumb+honest. Browser automation / DeepShake / URL healing runs **offline** per `spul/extractors/README.md`. Do **not** edit `webpoint-dep-highlighter`. Ignore `kata_deploy/` symlink farms on Bill’s Desktop — use this tree instead.

### Day-1 checklist

- [ ] Search: `Travis County TX`, `San Diego`, `Chicago`  
- [ ] Honest miss for nonsense query  
- [ ] No real API keys in any committed file  
- [ ] Read `docs/spul-clean-share/AUDIT_MEMO.md` keep/delete table once  

### Contacts / URLs

| What | Where |
| --- | --- |
| Code | this repo → `spul/` |
| Day 0 manifest | [`docs/DAY0_MANIFEST.md`](../DAY0_MANIFEST.md) |
| Reviewer PR (open today) | https://github.com/webpointllc-com/TaxCertificateProcessor/pull/8 |
| Clean-share parent | https://github.com/webpointllc-com/TaxCertificateProcessor/pull/7 |
| Invite collaborator | https://github.com/webpointllc-com/TaxCertificateProcessor/settings/access |
| Demo only (do not treat as product) | https://webpoint-spul-beta.onrender.com (repo 404; ignore) |
| Marketing | https://webpointllc.com · account domain https://taxcert.ai |
