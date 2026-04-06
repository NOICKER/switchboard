import { state, getActiveSystemPrompt } from './state.js'
import { requestBackendChat } from './backend-api.js'
import { getProviderKeys } from './keyring.js'

export const PROVIDERS = {
  groq: {
    name: 'Groq',
    initials: 'G',
    avatarColor: '#374151',
    model: 'llama-3.3-70b-versatile',
    dailyLimit: 500,
    format: 'openai',
    supportsStreaming: true
  },
  gemini: {
    name: 'Gemini',
    initials: 'Ge',
    avatarColor: '#7c3aed',
    model: 'gemini-2.0-flash',
    dailyLimit: 250,
    format: 'gemini',
    supportsStreaming: true
  },
  mistral: {
    name: 'Mistral',
    initials: 'M',
    avatarColor: '#ea580c',
    model: 'mistral-small-latest',
    dailyLimit: 200,
    format: 'openai',
    supportsStreaming: true
  },
  openrouter: {
    name: 'OpenRouter',
    initials: 'OR',
    avatarColor: '#2563eb',
    model: 'mistralai/mistral-7b-instruct:free',
    dailyLimit: 200,
    format: 'openai',
    supportsStreaming: true
  },
  huggingface: {
    name: 'HuggingFace',
    initials: 'HF',
    avatarColor: '#d97706',
    model: 'mistralai/Mistral-7B-Instruct-v0.3',
    dailyLimit: 1000,
    format: 'huggingface',
    supportsStreaming: false
  }
}

export const DEFAULT_FALLBACK_ORDER = [
  'groq', 'gemini', 'mistral', 'openrouter', 'huggingface'
]

export function getAllProviders() {
  const custom = {}
  state.customProviders.forEach(provider => {
    custom[provider.id] = {
      name: provider.name,
      initials: provider.name.slice(0, 2).toUpperCase(),
      avatarColor: '#6b7280',
      model: provider.model,
      dailyLimit: provider.dailyLimit,
      format: provider.adapterType || 'openai',
      supportsStreaming: provider.adapterType !== 'anthropic',
      isCustom: true,
      baseUrl: provider.baseUrl,
      adapterType: provider.adapterType || 'openai'
    }
  })

  return { ...PROVIDERS, ...custom }
}

export function getProviderOrder() {
  const custom = state.customProviders.map(provider => provider.id)
  const base = state.providerOrder.length > 0
    ? state.providerOrder
    : DEFAULT_FALLBACK_ORDER

  return [
    ...base,
    ...custom.filter(id => !base.includes(id))
  ]
}

export function getApiKey(providerId) {
  const allProviders = getAllProviders()
  const provider = allProviders[providerId]
  if (!provider) return null

  const keys = getProviderKeys(providerId)
  if (keys.length > 0) {
    return keys[0]
  }

  return null
}

export async function callProvider(providerId, messages, apiKey, onChunk) {
  const allProviders = getAllProviders()
  const provider = allProviders[providerId]
  if (!provider) {
    throw new Error(`Provider not found: ${providerId}`)
  }

  const activePrompt = getActiveSystemPrompt()
  const payloadMessages = activePrompt
    ? [{ role: 'system', content: activePrompt.content }, ...messages]
    : messages

  return requestBackendChat({
    providerId,
    provider,
    apiKey: apiKey || null,
    messages: payloadMessages,
    model: provider.model,
    stream: Boolean(onChunk && state.streaming && provider.supportsStreaming),
    onChunk
  })
}
