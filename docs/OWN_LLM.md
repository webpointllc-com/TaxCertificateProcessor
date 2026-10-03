# WebPoint own model

Our own open-weight model, served on our own GPU endpoint, getting better every week from sessions where the member clicked **Allow learning**.

## How it fits together

```
member asks ──► web app (Render) ──► WebPoint model (RunPod serverless vLLM: base + LoRA adapter)
                     │                    │ cold or down?
                     │                    └──► Groq fallback (user never waits on our cold start)
                     │
                     └─ learn_consent = true? ──► training_examples (Postgres)
                                                        │ weekly
                     export-training.js ◄───────────────┘   (re-checks consent, masks PII)
                            │
                     train_lora.py on a rented GPU (QLoRA, ~1 hr)
                            │
                     eval_gate.py: new adapter vs current on held-out data
                            │ PASS only
                     upload adapter, bump WEBPOINT_MODEL
```

Two learning speeds:

| Speed | What learns | Where |
| --- | --- | --- |
| Instant | Extractor for that tax collecting entity | `/api/extractors/heal` → extractor vN (already shipped) |
| Weekly | The model itself | `training_examples` → LoRA adapter vN (this branch) |

## What this branch adds (`feature/own-llm`)

| File | What |
| --- | --- |
| `src/services/llm.js` | `webpoint` provider, ordered fallback chain (webpoint → groq → anthropic), streaming on any OpenAI-compatible provider, 20 s timeout on ours so a cold worker falls back instead of stalling |
| `src/db/training.js` | Consent-gated capture, thumbs rating, export joined on **current** consent, `forgetAccount()` |
| `src/db/schema.sql` | `training_examples` table |
| `src/server.js` | Captures search, chat and heal answers for consenting members. `POST /v1/training/rate`. `training_example_id` on responses. Health shows training counts |
| `scripts/export-training.js` | JSONL export, PII masking, stable 95/5 train/eval split, manifest with hashes |
| `training/train_lora.py` | QLoRA fine-tune. Refuses to run under 200 examples |
| `training/eval_gate.py` | Ship gate. Fails if the new adapter invents more URLs or dollar amounts, or drifts from references |
| `tests/own-llm.test.js` | 19 tests: chain, fallback, streaming, every consent rule, export masking |

Merging changes nothing in production. `MODEL_PROVIDER` stays `groq` until the switch-day steps below.

## Consent rules (enforced in code, covered by tests)

1. Nothing is captured for anonymous users or accounts with `learn_consent = false`.
2. Export re-checks consent at export time. Turning learning off removes that account from every future training run.
3. Thumbs-down answers never train the model.
4. `training.forgetAccount(id)` deletes every row. **The Delete my data endpoint must call it.**
5. Emails, phone numbers and SSN-shaped strings are masked before data leaves the database.
6. `training/data/` and `training/adapters/` are git-ignored. Member data never goes into the repo.

## Base model

`Qwen/Qwen3.5-9B` (verified on Hugging Face 2026-10-02). Override with `BASE_MODEL`. Fits one 24 GB GPU in bf16 for serving and in 4-bit for training. Confirm the license file on the model card before launch.

## Switch day (Bill pays, in this order)

Each step is reversible. Nothing here costs money until step 2.

1. Merge `feature/own-llm`. Tests green. Production behavior unchanged.
2. **RunPod**: add credit (start with $25). Create a serverless endpoint:
   - Image: `runpod/worker-v1-vllm:<latest release>`
   - GPU: 24 GB class. Max workers 1. Idle timeout 5 s. Active workers 0 (scale to zero).
   - Env: `MODEL_NAME=Qwen/Qwen3.5-9B`, `MAX_MODEL_LEN=8192`, `ENABLE_LORA=true` (adapters come later; see worker-vllm README for the `LORA_MODULES` format).
3. **Render dashboard**: set `WEBPOINT_LLM_URL=https://api.runpod.ai/v2/<ENDPOINT_ID>/openai/v1`, `WEBPOINT_LLM_KEY=<RunPod API key>`, `WEBPOINT_MODEL=Qwen/Qwen3.5-9B` (base model until the first adapter exists).
4. Hit `/v1/health`: `llm.webpoint` must be `true`.
5. Change `MODEL_PROVIDER` to `webpoint`. Groq stays configured as the fallback.
6. Demo day: set Active workers to 1 for the demo window so the first answer is instant, then back to 0.

## Weekly learning run

```bash
DATABASE_URL=... node scripts/export-training.js --out training/data
# on a rented 24 GB GPU pod:
pip install -r training/requirements.txt
python training/train_lora.py --data training/data --out training/adapters/webpoint-v2
# upload the adapter, register it with the endpoint as webpoint-v2, then:
python training/eval_gate.py --url $WEBPOINT_LLM_URL --key $WEBPOINT_LLM_KEY \
  --current webpoint-v1 --candidate webpoint-v2 --data training/data/eval.jsonl
# PASS -> set WEBPOINT_MODEL=webpoint-v2 on Render. FAIL -> keep v1.
```

The first adapter needs about 200 consented examples. Until then the base model serves and learning happens at the extractor layer.

## Budget (as-needed, ~$75/mo ceiling)

| Piece | Cost |
| --- | --- |
| Render web Starter (already paid) | $7 |
| Render Postgres (already paid) | $7 |
| RunPod serverless, 24 GB, per second only while answering | ~$0.69/hr of answering; ~$40 cap |
| Weekly training pod, ~1 hr | ~$1–3 per run |
| Groq fallback | free tier |

A dedicated always-on GPU (from ~€184/mo) only makes sense past ~10 busy hours a day.

## Not done yet

- Thumbs up / down buttons in `public/app.js` that call `/v1/training/rate` with `training_example_id`.
- Delete my data endpoint calling `training.forgetAccount()`.
- Retention setting (90 days / 1 year) applied to `training_examples`.
- Confirm current vLLM supports Qwen3.5 on the chosen worker image (test with one request on switch day).
- Adapter storage location (Hugging Face private repo or RunPod network volume).
