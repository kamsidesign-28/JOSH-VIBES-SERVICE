import { config } from './config.js';
import { fallbackAnswer } from './utils.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function extractOpenAI(data) {
  return data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || '';
}

function extractGemini(data) {
  return data?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '';
}

async function fetchJson(url, options, timeoutMs) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
  const raw = await response.text();
  let data;
  try { data = JSON.parse(raw); } catch { data = raw; }
  if (!response.ok) {
    const detail = typeof data === 'string' ? data.slice(0, 160) : data?.error?.message || `HTTP ${response.status}`;
    throw new Error(detail);
  }
  return data;
}

function hasCredentials(name) {
  if (name === 'openai') return Boolean(config.openai.apiKey);
  if (name === 'gemini') return Boolean(config.gemini.apiKey);
  if (name === 'yenusai') return config.yenusai.enabled;
  if (name === 'azbrygpt') return config.azbrygpt.enabled;
  if (name === 'azbryclaude') return config.azbryclaude.enabled;
  return false;
}

async function callProvider(name, messages) {
  if (name === 'openai') {
    const data = await fetchJson(`${config.openai.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${config.openai.apiKey}` },
      body: JSON.stringify({ model: config.openai.model, messages, temperature: 0.65, max_tokens: 700 })
    }, config.aiTimeoutMs);
    const result = extractOpenAI(data);
    if (!result) throw new Error('OpenAI returned an empty response.');
    return result;
  }

  if (name === 'gemini') {
    const system = messages.find((message) => message.role === 'system')?.content || '';
    const contents = messages.filter((message) => message.role !== 'system').map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content }]
    }));
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.gemini.model)}:generateContent?key=${encodeURIComponent(config.gemini.apiKey)}`;
    const data = await fetchJson(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents, generationConfig: { temperature: 0.65, maxOutputTokens: 700 } })
    }, config.aiTimeoutMs);
    const result = extractGemini(data);
    if (!result) throw new Error('Gemini returned an empty response.');
    return result;
  }

  if (name === 'yenusai') {
    const headers = { accept: '*/*', 'content-type': 'application/json', 'x-powered-by': 'JOSH-VIBES' };
    if (config.yenusai.projectId) headers['x-createxyz-project-id'] = config.yenusai.projectId;
    if (config.yenusai.apiKey) headers.authorization = `Bearer ${config.yenusai.apiKey}`;
    const data = await fetchJson(`${config.yenusai.baseUrl}${config.yenusai.endpoint}`, {
      method: 'POST', headers, body: JSON.stringify({ messages, stream: false })
    }, config.aiTimeoutMs);
    const result = extractGemini(data) || data?.result || data?.response || (typeof data === 'string' ? data : '');
    if (!result) throw new Error('YenusAI returned an empty response.');
    return result;
  }

  if (name === 'azbrygpt' || name === 'azbryclaude') {
    const prompt = messages.map((message) => `${String(message.role).toUpperCase()}: ${message.content}`).join('\n\n');
    const provider = name === 'azbrygpt' ? config.azbrygpt : config.azbryclaude;
    const queryKey = name === 'azbrygpt' ? 'q' : 'prompt';
    const data = await fetchJson(`${provider.baseUrl}${provider.endpoint}?${new URLSearchParams({ [queryKey]: prompt })}`, {
      method: 'GET', headers: { accept: '*/*', 'x-powered-by': 'JOSH-VIBES' }
    }, config.aiTimeoutMs);
    const result = typeof data === 'string' ? data : data?.response || data?.result || data?.completion || data?.message || '';
    if (!result) throw new Error(`${name} returned an empty response.`);
    return result;
  }

  throw new Error(`Unsupported provider: ${name}`);
}

export class JoshVibesAI {
  constructor(knowledge) {
    this.knowledge = knowledge;
    this.lastProvider = null;
  }

  async chat({ messages, userText, systemPrompt }) {
    const finalMessages = systemPrompt ? [{ role: 'system', content: systemPrompt }, ...messages] : messages;
    let lastError = null;
    for (const provider of config.aiProviderOrder) {
      if (!hasCredentials(provider)) continue;
      for (let attempt = 1; attempt <= Math.max(1, config.aiRetries); attempt += 1) {
        try {
          const result = await callProvider(provider, finalMessages);
          this.lastProvider = provider;
          return { status: 'success', result, provider };
        } catch (error) {
          lastError = error;
          if (attempt < config.aiRetries) await sleep(500 * attempt);
        }
      }
    }
    return {
      status: 'fallback',
      result: fallbackAnswer(userText, this.knowledge),
      provider: 'deterministic-fallback',
      error: lastError ? 'Configured AI providers were unavailable.' : 'No AI provider credentials are configured.'
    };
  }

  async healthCheck() {
    const providers = config.aiProviderOrder.map((name) => ({ name, configured: hasCredentials(name), status: hasCredentials(name) ? 'configured' : 'not-configured' }));
    return { brand: 'JOSH-VIBES', providers, lastProvider: this.lastProvider };
  }
}
