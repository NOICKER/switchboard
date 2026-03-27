import { state } from './state.js'
import { PROVIDERS, getApiKey } from './providers.js'
import { getNextAvailableKey } from './keyring.js'

const healthCache = new Map() // { providerId: { healthy: bool, timestamp: ms } }
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export async function isHealthy(providerId) {
  const apiKey = getNextAvailableKey(providerId, { advance: false })?.apiKey || getApiKey(providerId)
  if (!apiKey) return false

  const cached = healthCache.get(providerId)
  const now = Date.now()

  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    return cached.healthy
  }

  try {
    const p = PROVIDERS[providerId]
    if (!p?.healthEndpoint) return true // Skip health check for providers without endpoint

    const healthy = await checkProviderHealth(providerId, p, apiKey)
    healthCache.set(providerId, { healthy, timestamp: now })
    return healthy
  } catch (e) {
    healthCache.set(providerId, { healthy: false, timestamp: now })
    return false
  }
}

export function clearHealthCache() {
  healthCache.clear()
}

export function getLastHealthStatus(providerId) {
  return healthCache.get(providerId)
}

// INTERNAL

async function checkProviderHealth(providerId, provider, apiKey) {
  if (providerId === 'gemini') {
    return checkGeminiHealth(provider, apiKey)
  } else if (providerId === 'huggingface') {
    // HuggingFace doesn't have a free health endpoint
    return true
  } else {
    // OpenAI-compatible
    return checkOpenAIHealth(provider, apiKey, providerId)
  }
}

async function checkOpenAIHealth(provider, apiKey, providerId) {
  const url = provider.healthEndpoint
  const headers = {
    'Authorization': 'Bearer ' + apiKey,
    'Content-Type': 'application/json'
  }

  if (providerId === 'openrouter') {
    headers['HTTP-Referer'] = window.location.href
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  try {
    const resp = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal
    })
    clearTimeout(timeout)
    return resp.ok
  } catch (e) {
    clearTimeout(timeout)
    return false
  }
}

async function checkGeminiHealth(provider, apiKey) {
  const url = provider.healthEndpoint
    .replace('{apiKey}', apiKey)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  try {
    const resp = await fetch(url, {
      method: 'GET',
      signal: controller.signal
    })
    clearTimeout(timeout)
    return resp.ok
  } catch (e) {
    clearTimeout(timeout)
    return false
  }
}
