import { testProviderViaBackend } from './backend-api.js'
import { getAllProviders } from './providers.js'
import { getProviderKeys } from './keyring.js'

const healthCache = new Map() // { providerId: { healthy: bool, timestamp: ms } }
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export async function isHealthy(providerId) {
  const apiKey = getProviderKeys(providerId)[0]
  if (!apiKey) return false

  const cached = healthCache.get(providerId)
  const now = Date.now()

  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    return cached.healthy
  }

  try {
    const provider = getAllProviders()[providerId]
    if (!provider) return false

    const healthy = await checkProviderHealth(providerId, provider)
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

async function checkProviderHealth(providerId, provider) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  try {
    const result = await testProviderViaBackend({
      providerId,
      provider,
      apiKey: null,
      signal: controller.signal
    })
    clearTimeout(timeout)
    return result?.ok === true
  } catch (e) {
    clearTimeout(timeout)
    return false
  }
}
