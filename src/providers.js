import { state, getUsage, getActiveSystemPrompt } from './state.js'
import { streamOpenAI } from './streaming.js'

export const PROVIDERS = {
  groq: {
    name: 'Groq',
    initials: 'G',
    avatarColor: '#374151',
    model: 'llama-3.3-70b-versatile',
    dailyLimit: 500,
    chatEndpoint: 'https://api.groq.com/openai/v1/chat/completions',
    healthEndpoint: 'https://api.groq.com/openai/v1/models',
    format: 'openai',
    supportsStreaming: true
  },
  gemini: {
    name: 'Gemini',
    initials: 'Ge',
    avatarColor: '#7c3aed',
    model: 'gemini-2.0-flash',
    dailyLimit: 250,
    chatEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}',
    healthEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models?key={apiKey}',
    format: 'gemini',
    supportsStreaming: false
  },
  mistral: {
    name: 'Mistral',
    initials: 'M',
    avatarColor: '#ea580c',
    model: 'mistral-small-latest',
    dailyLimit: 200,
    chatEndpoint: 'https://api.mistral.ai/v1/chat/completions',
    healthEndpoint: 'https://api.mistral.ai/v1/models',
    format: 'openai',
    supportsStreaming: true
  },
  openrouter: {
    name: 'OpenRouter',
    initials: 'OR',
    avatarColor: '#2563eb',
    model: 'mistralai/mistral-7b-instruct:free',
    dailyLimit: 200,
    chatEndpoint: 'https://openrouter.ai/api/v1/chat/completions',
    healthEndpoint: 'https://openrouter.ai/api/v1/models',
    format: 'openai',
    supportsStreaming: true
  },
  huggingface: {
    name: 'HuggingFace',
    initials: 'HF',
    avatarColor: '#d97706',
    model: 'mistralai/Mistral-7B-Instruct-v0.3',
    dailyLimit: 1000,
    chatEndpoint: 'https://api-inference.huggingface.co/models/{model}',
    healthEndpoint: null,
    format: 'huggingface',
    supportsStreaming: false
  }
}

export const DEFAULT_FALLBACK_ORDER = [
  'groq', 'gemini', 'mistral', 'openrouter', 'huggingface'
]

export function getAllProviders() {
  const custom = {}
  state.customProviders.forEach(c => {
    custom[c.id] = {
      name: c.name,
      initials: c.name.slice(0, 2).toUpperCase(),
      avatarColor: '#6b7280',
      model: c.model,
      dailyLimit: c.dailyLimit,
      chatEndpoint: c.baseUrl.replace(/\/$/, '') + '/chat/completions',
      healthEndpoint: c.baseUrl.replace(/\/$/, '') + '/models',
      format: 'openai',
      supportsStreaming: true,
      isCustom: true,
      apiKeyOverride: c.apiKey
    }
  })
  return { ...PROVIDERS, ...custom }
}

export function getProviderOrder() {
  const custom = state.customProviders.map(c => c.id)
  const base = state.providerOrder.length > 0
    ? state.providerOrder
    : DEFAULT_FALLBACK_ORDER
  return [
    ...base,
    ...custom.filter(id => !base.includes(id))
  ]
}

export function getApiKey(providerId) {
  const all = getAllProviders()
  const p = all[providerId]
  if (!p) return null
  return p.isCustom ? p.apiKeyOverride : state.apiKeys[providerId]
}

export async function callProvider(providerId, messages, apiKey, onChunk) {
  const all = getAllProviders()
  const p = all[providerId]
  if (!p) throw new Error('Provider not found: ' + providerId)
  
  const activePrompt = getActiveSystemPrompt()

  if (p.format === 'gemini') {
    return callGemini(p, messages, apiKey, activePrompt)
  } else if (p.format === 'huggingface') {
    return callHuggingFace(p, messages, apiKey, activePrompt)
  } else {
    // OpenAI compatible
    return callOpenAI(providerId, p, messages, apiKey, activePrompt, onChunk)
  }
}

async function callOpenAI(providerId, p, messages, apiKey, activePrompt, onChunk) {
  const url = p.chatEndpoint
  const msgs = activePrompt
    ? [{ role: 'system', content: activePrompt.content }, ...messages]
    : messages

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + apiKey
  }

  if (providerId === 'openrouter') {
    headers['HTTP-Referer'] = window.location.href
    headers['X-Title'] = 'Switchboard'
  }

  const body = {
    model: p.model,
    messages: msgs,
    temperature: 0.7,
    stream: onChunk && state.streaming && p.supportsStreaming ? true : false
  }

  if (onChunk && state.streaming && p.supportsStreaming) {
    return streamOpenAI(url, headers, body, onChunk)
  }

  const data = await fetchJson(url, headers, body)
  const text = data.choices?.[0]?.message?.content || ''
  const tokens = data.usage?.total_tokens || Math.ceil(text.length / 4)

  return {
    text,
    tokens,
    headers: extractHeaders({})
  }
}

async function callGemini(p, messages, apiKey, activePrompt) {
  const url = p.chatEndpoint
    .replace('{model}', p.model)
    .replace('{apiKey}', apiKey)

  const headers = { 'Content-Type': 'application/json' }

  const body = {
    systemInstruction: activePrompt
      ? { parts: [{ text: activePrompt.content }] }
      : undefined,
    contents: (() => {
      const filtered = messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        }))

      const merged = []
      for (const msg of filtered) {
        const last = merged[merged.length - 1]
        if (last && last.role === msg.role) {
          last.parts[0].text += '\n' + msg.parts[0].text
        } else {
          merged.push({
            ...msg,
            parts: [{ ...msg.parts[0] }]
          })
        }
      }
      return merged
    })(),
    generationConfig: { temperature: 0.7 }
  }

  const data = await fetchJson(url, headers, body)
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  const tokens = data.usageMetadata?.totalTokenCount || Math.ceil(text.length / 4)

  return {
    text,
    tokens,
    headers: {}
  }
}

async function callHuggingFace(p, messages, apiKey, activePrompt) {
  const url = p.chatEndpoint.replace('{model}', p.model)

  const lastUserMsg = messages
    .filter(m => m.role === 'user')
    .pop()?.content || ''

  const prefix = activePrompt
    ? activePrompt.content + '\n\n'
    : ''

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + apiKey
  }

  const body = {
    inputs: prefix + lastUserMsg,
    parameters: { max_new_tokens: 1024 }
  }

  const data = await fetchJson(url, headers, body)
  let raw = Array.isArray(data)
    ? data[0].generated_text
    : data.generated_text

  const fullPrefix = prefix + lastUserMsg
  const text = raw.startsWith(fullPrefix)
    ? raw.slice(fullPrefix.length).trim()
    : raw

  return {
    text,
    tokens: Math.ceil(text.length / 4),
    headers: {}
  }
}

// HELPER FUNCTIONS

export async function fetchJson(url, headers, body) {
  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(), 15000
  )

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    })
    clearTimeout(timeout)

    if (!resp.ok) {
      const err = await resp.text().catch(() => resp.statusText)
      throw new Error(resp.status + ': ' + err.slice(0, 120))
    }

    return resp.json()
  } finally {
    clearTimeout(timeout)
  }
}

function extractHeaders(resp) {
  const result = {}
  if (resp.headers) {
    resp.headers.forEach((v, k) => {
      if (['content-type', 'x-ratelimit-remaining', 'server', 'cf-ray'].includes(k)) {
        result[k] = v
      }
    })
  }
  return result
}
