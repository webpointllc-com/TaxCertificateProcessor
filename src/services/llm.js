'use strict';

const { OpenAI } = require('openai');

// Three providers, one ordered chain.
//   webpoint  = our own open-weight model (base + LoRA adapter) served by vLLM
//               on RunPod serverless. OpenAI-compatible, so it uses the same client as Groq.
//   groq      = rented workhorse (Llama 3.3 70B). Fallback while our endpoint is cold or down.
//   anthropic = heavy fallback for strict JSON repair work.
// If nothing is configured the app stays on the locked SPUL database ('spul-db').

const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';

function webpointModel() {
  return process.env.WEBPOINT_MODEL || 'webpoint';
}

// Short default timeout on purpose: a cold serverless worker can take a minute to load.
// We fall back to Groq for that request instead of making the user wait; the worker keeps warming.
function webpointTimeoutMs() {
  const n = Number(process.env.WEBPOINT_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : 20000;
}

function webpointEnabled() {
  return Boolean(process.env.WEBPOINT_LLM_URL && process.env.WEBPOINT_LLM_KEY);
}

function groqEnabled() {
  return Boolean(process.env.GROQ_API_KEY);
}

function anthropicEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const ENABLED = {
  webpoint: webpointEnabled,
  groq: groqEnabled,
  anthropic: anthropicEnabled
};

// Providers that speak the OpenAI chat API (and can stream through it).
const OPENAI_COMPATIBLE = new Set(['webpoint', 'groq']);

function providerChain({ heavy } = {}) {
  const forced = String(process.env.MODEL_PROVIDER || 'auto').toLowerCase();
  if (forced === 'none') return [];
  let order;
  if (ENABLED[forced]) {
    order = [forced, ...['webpoint', 'groq', 'anthropic'].filter((p) => p !== forced)];
  } else if (heavy) {
    order = ['anthropic', 'webpoint', 'groq'];
  } else {
    order = ['webpoint', 'groq', 'anthropic'];
  }
  return order.filter((p) => ENABLED[p]());
}

function pickProvider(opts = {}) {
  return providerChain(opts)[0] || 'none';
}

function modelFor(provider) {
  if (provider === 'webpoint') return webpointModel();
  if (provider === 'groq') return GROQ_MODEL;
  if (provider === 'anthropic') return ANTHROPIC_MODEL;
  return 'spul-db';
}

function groqClient() {
  if (!groqEnabled()) return null;
  return new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1' });
}

function webpointClient() {
  if (!webpointEnabled()) return null;
  return new OpenAI({
    apiKey: process.env.WEBPOINT_LLM_KEY,
    baseURL: process.env.WEBPOINT_LLM_URL.replace(/\/+$/, ''),
    timeout: webpointTimeoutMs(),
    maxRetries: 0
  });
}

function openaiClientFor(provider) {
  return provider === 'webpoint' ? webpointClient() : groqClient();
}

function status() {
  const provider = pickProvider();
  return {
    provider,
    webpoint: webpointEnabled(),
    groq: groqEnabled(),
    anthropic: anthropicEnabled(),
    own_model: webpointModel(),
    workhorse: GROQ_MODEL,
    heavy: ANTHROPIC_MODEL,
    chain: providerChain(),
    model: modelFor(provider)
  };
}

function splitSystem(messages) {
  const system = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n');
  const rest = messages.filter((m) => m.role !== 'system');
  return { system, rest };
}

async function completeFromOpenAICompatible(provider, { messages, temperature, max_tokens }) {
  const client = openaiClientFor(provider);
  const model = modelFor(provider);
  const completion = await client.chat.completions.create({ model, temperature, max_tokens, messages });
  return {
    ok: true,
    provider,
    model,
    text: completion.choices?.[0]?.message?.content || ''
  };
}

async function completeFromAnthropic({ messages, temperature, max_tokens }) {
  const { system, rest } = splitSystem(messages);
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens,
      temperature,
      system: system || undefined,
      messages: rest.map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }))
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error?.message || data.error?.type || `anthropic ${res.status}`);
  }
  const text = Array.isArray(data.content) ? data.content.map((p) => p.text || '').join('') : '';
  return { ok: true, provider: 'anthropic', model: ANTHROPIC_MODEL, text };
}

async function complete({ messages, temperature = 0.1, max_tokens = 400, heavy = false } = {}) {
  const chain = providerChain({ heavy });
  if (!chain.length) return { ok: false, provider: 'none', text: null, model: 'spul-db' };
  let lastErr = null;
  let lastProvider = 'none';
  for (const provider of chain) {
    try {
      if (OPENAI_COMPATIBLE.has(provider)) {
        return await completeFromOpenAICompatible(provider, { messages, temperature, max_tokens });
      }
      return await completeFromAnthropic({ messages, temperature, max_tokens });
    } catch (err) {
      console.error('llm', provider, err.message);
      lastErr = err;
      lastProvider = provider;
    }
  }
  return { ok: false, provider: lastProvider, text: null, model: 'spul-db', error: lastErr && lastErr.message };
}

function streamEnabled() {
  return providerChain().some((p) => OPENAI_COMPATIBLE.has(p));
}

// Opens a streaming completion on the first provider in the chain that accepts it.
// Returns { provider, model, stream } or null when no streaming provider is configured.
// Failover happens at open time only; once tokens flow we stay on that provider.
async function stream({ messages, temperature = 0.1, max_tokens = 700 } = {}) {
  const chain = providerChain().filter((p) => OPENAI_COMPATIBLE.has(p));
  let lastErr = null;
  for (const provider of chain) {
    try {
      const model = modelFor(provider);
      const s = await openaiClientFor(provider).chat.completions.create({
        model,
        temperature,
        max_tokens,
        stream: true,
        messages
      });
      return { provider, model, stream: s };
    } catch (err) {
      console.error('llm stream', provider, err.message);
      lastErr = err;
    }
  }
  if (lastErr) throw lastErr;
  return null;
}

// Back-compat for older callers: Groq only.
async function streamGroq({ messages, temperature = 0.1, max_tokens = 700 }) {
  const client = groqClient();
  if (!client) return null;
  return client.chat.completions.create({
    model: GROQ_MODEL,
    temperature,
    max_tokens,
    stream: true,
    messages
  });
}

module.exports = {
  GROQ_MODEL,
  ANTHROPIC_MODEL,
  webpointModel,
  webpointEnabled,
  groqEnabled,
  anthropicEnabled,
  providerChain,
  pickProvider,
  groqClient,
  webpointClient,
  status,
  complete,
  streamEnabled,
  stream,
  streamGroq
};
