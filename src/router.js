import { state, addLog, incrementUsage } from './state.js'
import { getProviderOrder, getApiKey, callProvider, getAllProviders } from './providers.js'
import { isHealthy } from './health.js'
import { showToast } from './components/toast.js'
import { describeProviderKey, getConfiguredKeyCount, getNextAvailableKey, setKeyCooldown } from './keyring.js'

const RATE_LIMIT_COOLDOWN_MS = 15 * 60 * 1000

export async function routeMessage(messages, onChunk) {
  if (!messages || messages.length === 0) {
    throw new Error('No messages to route')
  }

  const all = state.poolMode ? await routePool(messages, onChunk) : await routeSequential(messages, onChunk)
  return all
}

async function routeSequential(messages, onChunk) {
  const order = state.providerOverride
    ? [state.providerOverride,
      ...getProviderOrder().filter(
        id => id !== state.providerOverride
      )]
    : getProviderOrder()
  const errors = []

  for (const providerId of order) {
    const configuredKeyCount = getConfiguredKeyCount(providerId)
    if (!configuredKeyCount) continue

    const previewKey = getNextAvailableKey(providerId, { advance: false })
    if (!previewKey?.apiKey) {
      errors.push({ providerId, error: 'All keys cooling down' })
      continue
    }

    const healthy = await isHealthy(providerId)
    if (!healthy) {
      errors.push({ providerId, error: 'Provider unavailable' })
      continue
    }

    for (let attempt = 0; attempt < configuredKeyCount; attempt += 1) {
      const keyMeta = getNextAvailableKey(providerId)
      if (!keyMeta?.apiKey) {
        break
      }

      const startMs = Date.now()
      try {
        const result = await callProvider(providerId, messages, keyMeta.apiKey, onChunk)
        const latency = Date.now() - startMs
        const providerLabel = getAllProviders()[providerId]?.name || providerId

        addLog({
          timestamp: new Date().toISOString(),
          providerId,
          model: getAllProviders()[providerId]?.model || providerId,
          latency,
          tokens: result.tokens,
          status: 'ok',
          messages,
          payload: { keyIndex: keyMeta.keyIndex }
        })

        incrementUsage(providerId)

        return { ...result, providerId, providerLabel, latency, keyIndex: keyMeta.keyIndex }
      } catch (e) {
        const latency = Date.now() - startMs

        if (e.statusCode === 429) {
          setKeyCooldown(providerId, keyMeta.keyIndex, Date.now() + RATE_LIMIT_COOLDOWN_MS)
          addLog({
            timestamp: new Date().toISOString(),
            providerId,
            model: getAllProviders()[providerId]?.model || providerId,
            latency,
            tokens: 0,
            status: 'rate_limited',
            errorMessage: e.message.slice(0, 200),
            messages,
            payload: { keyIndex: keyMeta.keyIndex }
          })

          const target = findNextTarget(order, providerId)
          if (target) {
            showToast(
              `${describeProviderKey(getAllProviders()[providerId]?.name || providerId, keyMeta.keyIndex)} rate limited - switching to ${describeProviderKey(target.providerName, target.keyIndex)}`,
              'warning',
              4000
            )
          }

          continue
        }

        addLog({
          timestamp: new Date().toISOString(),
          providerId,
          model: getAllProviders()[providerId]?.model || providerId,
          latency,
          tokens: 0,
          status: 'error',
          errorMessage: e.message.slice(0, 200),
          messages,
          payload: { keyIndex: keyMeta.keyIndex }
        })
        errors.push({ providerId, error: e.message })
        break
      }
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
          const result = await callProvider(providerId, messages, apiKey, null)
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

  let winner
  try {
    winner = await Promise.any(races)
  } catch (e) {
    if (e instanceof AggregateError) {
      const msgs = e.errors.map(err => err.message)
        .join(', ')
      throw new Error(
        'All providers failed in pool mode: ' + msgs
      )
    }
    throw e
  }
  incrementUsage(winner.providerId)
  return winner
}

function findNextTarget(order, currentProviderId) {
  const currentIndex = order.indexOf(currentProviderId)
  const allProviders = getAllProviders()

  const sameProviderTarget = getNextAvailableKey(currentProviderId, { advance: false })
  if (sameProviderTarget?.apiKey) {
    return {
      providerId: currentProviderId,
      providerName: allProviders[currentProviderId]?.name || currentProviderId,
      keyIndex: sameProviderTarget.keyIndex
    }
  }

  for (let index = currentIndex + 1; index < order.length; index += 1) {
    const providerId = order[index]
    const nextKey = getNextAvailableKey(providerId, { advance: false })
    if (!nextKey?.apiKey) continue

    return {
      providerId,
      providerName: allProviders[providerId]?.name || providerId,
      keyIndex: nextKey.keyIndex
    }
  }

  return null
}
