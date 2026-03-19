import { state, addLog, incrementUsage } from './state.js'
import { getProviderOrder, getApiKey, callProvider, getAllProviders } from './providers.js'
import { isHealthy } from './health.js'

export async function routeMessage(messages, onChunk) {
  if (!messages || messages.length === 0) {
    throw new Error('No messages to route')
  }

  const all = state.poolMode ? await routePool(messages, onChunk) : await routeSequential(messages, onChunk)
  return all
}

async function routeSequential(messages, onChunk) {
  const order = getProviderOrder()
  const errors = []

  for (const providerId of order) {
    const apiKey = getApiKey(providerId)
    if (!apiKey) continue

    const healthy = await isHealthy(providerId)
    if (!healthy) {
      errors.push({ providerId, error: 'Provider unavailable' })
      continue
    }

    const startMs = Date.now()
    try {
      const result = await callProvider(providerId, messages, apiKey, onChunk)
      const latency = Date.now() - startMs
      const providerLabel = getAllProviders()[providerId]?.name || providerId

      addLog({
        timestamp: new Date().toISOString(),
        providerId,
        model: getAllProviders()[providerId]?.model || providerId,
        latency,
        tokens: result.tokens,
        status: 'ok',
        messages
      })

      incrementUsage(providerId)

      return { ...result, providerId, providerLabel, latency }
    } catch (e) {
      const latency = Date.now() - startMs
      addLog({
        timestamp: new Date().toISOString(),
        providerId,
        model: getAllProviders()[providerId]?.model || providerId,
        latency,
        tokens: 0,
        status: 'error',
        errorMessage: e.message.slice(0, 200),
        messages
      })
      errors.push({ providerId, error: e.message })
    }
  }

  if (errors.length === 0) {
    throw new Error('No API keys configured')
  }
  throw new Error('All providers failed: ' + errors.map(e => e.providerId + ' (' + e.error.slice(0, 30) + ')').join(', '))
}

async function routePool(messages, onChunk) {
  const order = getProviderOrder()
  const races = []

  for (const providerId of order) {
    const apiKey = getApiKey(providerId)
    if (!apiKey) continue

    const healthy = await isHealthy(providerId)
    if (!healthy) continue

    races.push(
      (async () => {
        const startMs = Date.now()
        try {
          const result = await callProvider(providerId, messages, apiKey, onChunk)
          const latency = Date.now() - startMs
          const providerLabel = getAllProviders()[providerId]?.name || providerId

          addLog({
            timestamp: new Date().toISOString(),
            providerId,
            model: getAllProviders()[providerId]?.model || providerId,
            latency,
            tokens: result.tokens,
            status: 'ok',
            messages
          })

          return {
            ...result,
            providerId,
            providerLabel,
            latency,
            isWinner: true
          }
        } catch (e) {
          const latency = Date.now() - startMs
          addLog({
            timestamp: new Date().toISOString(),
            providerId,
            model: getAllProviders()[providerId]?.model || providerId,
            latency,
            tokens: 0,
            status: 'raced',
            errorMessage: e.message.slice(0, 100),
            messages
          })
          throw new Error(providerId + ': ' + e.message)
        }
      })()
    )
  }

  if (races.length === 0) {
    throw new Error('No healthy providers available')
  }

  const winner = await Promise.any(races)
  incrementUsage(winner.providerId)
  return winner
}
