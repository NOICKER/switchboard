import { state } from './state.js'
import { getProviderOrder, callProvider, getAllProviders } from './providers.js'
import { isHealthy } from './health.js'
import { showToast } from './components/toast.js'
import { getConfiguredKeyCount } from './keyring.js'

export async function routeMessage(messages, onChunk) {
  if (!messages || messages.length === 0) {
    throw new Error('No messages to route')
  }

  return state.poolMode
    ? routePool(messages)
    : routeSequential(messages, onChunk)
}

async function routeSequential(messages, onChunk) {
  const order = state.providerOverride
    ? [state.providerOverride, ...getProviderOrder().filter(id => id !== state.providerOverride)]
    : getProviderOrder()
  const errors = []
  let rateLimitedCount = 0

  for (const providerId of order) {
    if (!getConfiguredKeyCount(providerId)) {
      continue
    }

    const healthy = await isHealthy(providerId)
    if (!healthy) {
      errors.push({ providerId, error: 'Provider unavailable' })
      continue
    }

    const startMs = Date.now()

    try {
      const result = await callProvider(providerId, messages, null, onChunk)
      const latency = Date.now() - startMs
      const providerLabel = getAllProviders()[providerId]?.name || providerId

      return { ...result, providerId, providerLabel, latency }
    } catch (error) {
      const latency = Date.now() - startMs

      if (error.statusCode === 429) {
        rateLimitedCount += 1

        const nextProviderId = findNextConfiguredProvider(order, providerId)
        if (nextProviderId) {
          const currentName = getAllProviders()[providerId]?.name || providerId
          const nextName = getAllProviders()[nextProviderId]?.name || nextProviderId
          showToast(`${currentName} is rate limited - switching to ${nextName}`, 'warning', 4000)
        }

        continue
      }

      errors.push({ providerId, error: error.message })
    }
  }

  if (rateLimitedCount > 0 && errors.length === 0) {
    throw new Error('All configured keys are currently rate limited or cooling down')
  }

  if (errors.length === 0) {
    throw new Error('No API keys configured')
  }

  throw new Error('All providers failed: ' + errors.map(error => `${error.providerId} (${error.error.slice(0, 30)})`).join(', '))
}

async function routePool(messages) {
  const order = getProviderOrder()
  const races = []

  for (const providerId of order) {
    if (!getConfiguredKeyCount(providerId)) {
      continue
    }

    const healthy = await isHealthy(providerId)
    if (!healthy) {
      continue
    }

    races.push(
      (async () => {
        const startMs = Date.now()

        try {
          const result = await callProvider(providerId, messages, null, null)
          const latency = Date.now() - startMs
          const providerLabel = getAllProviders()[providerId]?.name || providerId

          return {
            ...result,
            providerId,
            providerLabel,
            latency,
            isWinner: true
          }
        } catch (error) {
          const latency = Date.now() - startMs

          throw new Error(providerId + ': ' + error.message)
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
  } catch (error) {
    if (error instanceof AggregateError) {
      const messages = error.errors.map(entry => entry.message).join(', ')
      throw new Error('All providers failed in pool mode: ' + messages)
    }

    throw error
  }
  return winner
}

function findNextConfiguredProvider(order, currentProviderId) {
  const currentIndex = order.indexOf(currentProviderId)

  for (let index = currentIndex + 1; index < order.length; index += 1) {
    const providerId = order[index]
    if (getConfiguredKeyCount(providerId) > 0) {
      return providerId
    }
  }

  return null
}
