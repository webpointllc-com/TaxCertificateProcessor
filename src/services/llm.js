'use strict';

const { OpenAI } = require('openai');

const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';

function groqEnabled() {
  return Boolean(process.env.GROQ_API_KEY);
}

function anthropicEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function pickProvider({ heavy } = {}) {
  const forced = String(process.env.MODEL_PROVIDER || 'auto').toLowerCase();
  if (forced === 'none') return 'none';
  if (forced === 'groq') {
    if (groqEnabled()) return 'groq';
    if (anthropicEnabled()) return 'anthropic';
    return 'none';
  }
  if (forced === 'anthropic') {
    if (anthropicEnabled()) return 'anthropic';
    if (groqEnabled()) return 'groq';
    return 'none';
  }
  if (heavy && anthropicEnabled()) return 'anthropic';
  if (groqEnabled()) return 'groq';
  if (anthropicEnabled()) return 'anthropic';
  return 'none';
}

function groqClient() {
  if (!groqEnabled()) return null;
  return new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' });
}

function status() {
  const provider = pickProvider();
  return {
    provider,
    groq: groqEnabled(),
    anthropic: anthropicEnabled(),
    workhorse: GROQ_MODEL,
    heavy: ANTHROPIC_MODEL,
    model: provider === 'groq' ? GROQ_MODEL : provider === 'anthropic' ? ANTHROPIC_MODEL : 'spul-db'
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

async function completeFromGroq({ messages, temperature, max_tokens }) {
  const client = groqClient();
  const completion = await client.chat.completions.create({
    model: GROQ_MODEL,
    temperature,
    max_tokens,
    messages
  });
  return {
    ok: true,
    provider: 'groq',
    model: GROQ_MODEL,
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

async function complete({ messages, temperature = 0.1, max_tokens = 400, heavy = false }, tried = new Set()) {
  const provider = pickProvider({ heavy });
  if (provider === 'none' || tried.has(provider)) {
    return { ok: false, provider: 'none', text: null, model: 'spul-db' };
  }
  tried.add(provider);
  try {
    if (provider === 'groq') {
      return await completeFromGroq({ messages, temperature, max_tokens });
    }
    return await completeFromAnthropic({ messages, temperature, max_tokens });
  } catch (err) {
    console.error('llm', provider, err.message);
    const fallback = provider === 'groq' ? (anthropicEnabled() ? 'anthropic' : null) : groqEnabled() ? 'groq' : null;
    if (fallback && !tried.has(fallback)) {
      return complete({ messages, temperature, max_tokens, heavy: fallback === 'anthropic' }, tried);
    }
    return { ok: false, provider, text: null, model: 'spul-db', error: err.message };
  }
}

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
  groqEnabled,
  anthropicEnabled,
  pickProvider,
  groqClient,
  status,
  complete,
  streamGroq
};
