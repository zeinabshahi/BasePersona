// lib/llmProvider.ts
type ChatArgs = {
  system?: string;
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  temperature?: number;
  timeoutMs?: number;
  json?: boolean; // اگر true باشد از response_format: { type: "json_object" } استفاده می‌کنیم
};

type ChatOut =
  | { ok: true; provider: 'openrouter' | 'openai'; text: string; raw?: any }
  | { ok: false; provider: 'openrouter' | 'openai'; error: string; status?: number; body?: any };

function abortableFetch(input: RequestInfo, init: RequestInit & { timeoutMs?: number }) {
  const { timeoutMs, ...rest } = init as any;
  if (!timeoutMs) return fetch(input, rest);
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  return fetch(input, { ...rest, signal: ctrl.signal }).finally(() => clearTimeout(id));
}

/* ---------- OpenRouter ---------- */
async function chatWithOpenRouter(args: ChatArgs): Promise<ChatOut> {
  const env = process.env as Record<string, string | undefined>;
  const {
    OPENROUTER_API_KEY,
    OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1',
    OPENROUTER_SITE_URL = 'http://localhost:3000',
    OPENROUTER_APP_NAME = 'Rankora',
    LLM_OPENROUTER_MODEL = 'openai/gpt-4o-mini',
    LLM_TEMPERATURE = '0.6',
    LLM_TIMEOUT_MS = '25000',
  } = env;

  if (!OPENROUTER_API_KEY) {
    return { ok: false, provider: 'openrouter', error: 'missing OPENROUTER_API_KEY' };
  }

  const url = `${OPENROUTER_BASE_URL.replace(/\/+$/, '')}/chat/completions`;
  const body: any = {
    model: LLM_OPENROUTER_MODEL,
    temperature: args.temperature ?? Number(LLM_TEMPERATURE),
    messages: [
      ...(args.system ? [{ role: 'system', content: args.system }] : []),
      ...args.messages,
    ],
  };
  if (args.json) body.response_format = { type: 'json_object' };

  const r = await abortableFetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': OPENROUTER_SITE_URL,
      'X-Title': OPENROUTER_APP_NAME,
    },
    body: JSON.stringify(body),
    timeoutMs: args.timeoutMs ?? Number(LLM_TIMEOUT_MS),
  });

  const ct = r.headers.get('content-type') || '';
  const isJson = ct.includes('application/json');
  const json = isJson ? await r.json().catch(() => ({})) : undefined;

  if (!r.ok) {
    return { ok: false, provider: 'openrouter', error: (json as any)?.error?.message || `openrouter_${r.status}`, status: r.status, body: json };
  }

  const text = (json as any)?.choices?.[0]?.message?.content ?? '';
  return { ok: true, provider: 'openrouter', text, raw: json };
}

/* ---------- OpenAI (اختیاری/فالبک) ---------- */
async function chatWithOpenAI(args: ChatArgs): Promise<ChatOut> {
  const env = process.env as Record<string, string | undefined>;
  const {
    LLM_OPENAI_API_KEY,
    LLM_TEMPERATURE = '0.6',
    LLM_TIMEOUT_MS = '25000',
  } = env;

  if (!LLM_OPENAI_API_KEY) {
    return { ok: false, provider: 'openai', error: 'missing LLM_OPENAI_API_KEY' };
  }

  const url = 'https://api.openai.com/v1/chat/completions';
  const body: any = {
    model: 'gpt-4o-mini',
    temperature: args.temperature ?? Number(LLM_TEMPERATURE),
    messages: [
      ...(args.system ? [{ role: 'system', content: args.system }] : []),
      ...args.messages,
    ],
  };
  if (args.json) body.response_format = { type: 'json_object' };

  const r = await abortableFetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LLM_OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    timeoutMs: args.timeoutMs ?? Number(LLM_TIMEOUT_MS),
  });

  const json = await r.json().catch(() => ({}));
  if (!r.ok) {
    return { ok: false, provider: 'openai', error: json?.error?.message || `openai_${r.status}`, status: r.status, body: json };
  }

  const text = json?.choices?.[0]?.message?.content ?? '';
  return { ok: true, provider: 'openai', text, raw: json };
}

/* ---------- Router ---------- */
export async function chatComplete(args: ChatArgs): Promise<ChatOut> {
  const provider = (process.env.LLM_PROVIDER || 'openrouter').toLowerCase();
  if (provider === 'openrouter') return await chatWithOpenRouter(args);
  if (provider === 'openai') return await chatWithOpenAI(args);
  return { ok: false, provider: 'openrouter', error: `unknown LLM_PROVIDER=${provider}` };
}
