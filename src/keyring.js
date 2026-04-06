import { state, persist } from './state.js'

export function normalizeProviderKeys(value, options = {}) {
  const includeEmpty = options.includeEmpty === true

  if (Array.isArray(value)) {
    const normalized = value.map(key => String(key ?? '').trim())
    return includeEmpty
      ? normalized
      : normalized.filter(Boolean)
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed) {
      return [trimmed]
    }

    return includeEmpty ? [''] : []
  }

  return []
}

export function normalizeApiKeysMap(apiKeys = {}) {
  const normalized = {}

  Object.entries(apiKeys || {}).forEach(([providerId, value]) => {
    normalized[providerId] = normalizeProviderKeys(value)
  })

  return normalized
}

export function getProviderKeys(providerId, options = {}) {
  return normalizeProviderKeys(state.apiKeys[providerId], options)
}

export function getConfiguredKeyCount(providerId) {
  return getProviderKeys(providerId).length
}

export function getKeyCooldownId(providerId, keyIndex) {
  const apiKey = typeof keyIndex === 'number'
    ? getProviderKeys(providerId, { includeEmpty: true })[keyIndex]
    : keyIndex

  if (!apiKey) {
    return null
  }

  return `${providerId}:${apiKey}`
}

export function getKeyCooldown(providerId, keyIndex) {
  pruneExpiredCooldowns()
  const cooldownId = getKeyCooldownId(providerId, keyIndex)
  return cooldownId ? (state.keyCooldowns[cooldownId] || 0) : 0
}

export function setKeyCooldown(providerId, keyIndex, expiresAt) {
  const cooldownId = getKeyCooldownId(providerId, keyIndex)
  if (!cooldownId) {
    return
  }

  state.keyCooldowns[cooldownId] = expiresAt
  persist()
}

export function clearKeyCooldown(providerId, keyIndex) {
  const cooldownId = getKeyCooldownId(providerId, keyIndex)
  if (cooldownId && cooldownId in (state.keyCooldowns || {})) {
    delete state.keyCooldowns[cooldownId]
    persist()
  }
}

export function isKeyCoolingDown(providerId, keyIndex) {
  return getKeyCooldown(providerId, keyIndex) > Date.now()
}

export function pruneExpiredCooldowns() {
  let changed = false
  const now = Date.now()

  Object.entries(state.keyCooldowns || {}).forEach(([cooldownId, expiresAt]) => {
    const isLegacySlotCooldown = !cooldownId.includes(':')
    if (isLegacySlotCooldown || !expiresAt || expiresAt <= now) {
      delete state.keyCooldowns[cooldownId]
      changed = true
    }
  })

  if (changed) {
    persist()
  }
}

export function setProviderKeys(providerId, keys) {
  state.apiKeys[providerId] = normalizeProviderKeys(keys)

  const keyCount = state.apiKeys[providerId].length
  const currentIndex = state.keyRotation[providerId] || 0

  state.keyRotation[providerId] = keyCount > 0
    ? currentIndex % keyCount
    : 0

  persist()
}

export function updateProviderKey(providerId, keyIndex, value) {
  const keys = getProviderKeys(providerId, { includeEmpty: true })
  const nextValue = String(value ?? '').trim()
  const previousValue = keys[keyIndex] || ''

  keys[keyIndex] = nextValue
  setProviderKeys(providerId, keys)

  if (nextValue && nextValue !== previousValue) {
    clearKeyCooldown(providerId, keyIndex)
  }
}

export function addProviderKey(providerId) {
  const keys = getProviderKeys(providerId, { includeEmpty: true })
  keys.push('')
  state.apiKeys[providerId] = keys
  persist()
}

export function removeProviderKey(providerId, keyIndex) {
  const keys = getProviderKeys(providerId)
  keys.splice(keyIndex, 1)
  setProviderKeys(providerId, keys)
}

export function getNextAvailableKey(providerId, options = {}) {
  pruneExpiredCooldowns()

  const keys = getProviderKeys(providerId)
  if (!keys.length) {
    return null
  }

  const advance = options.advance !== false
  const startIndex = state.keyRotation[providerId] || 0

  for (let offset = 0; offset < keys.length; offset += 1) {
    const keyIndex = (startIndex + offset) % keys.length
    const apiKey = keys[keyIndex]

    if (!apiKey || isKeyCoolingDown(providerId, keyIndex)) {
      continue
    }

    if (advance) {
      state.keyRotation[providerId] = (keyIndex + 1) % keys.length
      persist()
    }

    return {
      apiKey,
      keyIndex
    }
  }

  return null
}

export function getNextKey(providerId) {
  return getNextAvailableKey(providerId)
}

export function describeProviderKey(providerName, keyIndex) {
  return `${providerName} key #${keyIndex + 1}`
}
