// STATE MANAGEMENT
export const state = {
  currentView: 'chat',
  currentChatId: null,
  sending: false,
  poolMode: false,
  providerOverride: null,
  streaming: true,
  expandedLogId: null,
  logFilter: 'all',
  currentEditingPromptId: null,
  chats: [],
  apiKeys: {},
  keyRotation: {},
  keyCooldowns: {},
  keyStatus: {},
  systemPrompts: [],
  activePromptId: null,
  logs: [],
  customProviders: [],
  providerOrder: [],
  usage: { date: '', providers: {} },
  totalTokens: 0
}

// PERSISTENCE
export function save(key, val) {
  try {
    localStorage.setItem('sb_' + key, JSON.stringify(val))
  } catch (e) {}
}

export function load(key, def) {
  try {
    const v = localStorage.getItem('sb_' + key)
    return v !== null ? JSON.parse(v) : def
  } catch (e) {
    return def
  }
}

export function persist() {
  save('chats', state.chats)
  save('apiKeys', state.apiKeys)
  save('keyRotation', state.keyRotation)
  save('keyCooldowns', state.keyCooldowns)
  save('keyStatus', state.keyStatus)
  save('systemPrompts', state.systemPrompts)
  save('activePromptId', state.activePromptId)
  save('logs', state.logs)
  save('providerOverride', state.providerOverride)
  save('totalTokens', state.totalTokens)
  save('customProviders', state.customProviders)
  save('providerOrder', state.providerOrder)
  save('poolMode', state.poolMode)
  save('streaming', state.streaming)
  save('usage', state.usage)
}

export function loadState() {
  state.chats = load('chats', [])
  state.apiKeys = normalizeStoredApiKeys(load('apiKeys', {}))
  state.keyRotation = load('keyRotation', {})
  state.keyCooldowns = load('keyCooldowns', {})
  state.keyStatus = load('keyStatus', {})
  state.systemPrompts = load('systemPrompts', defaultSystemPrompts())
  state.activePromptId = load('activePromptId', 
    state.systemPrompts[0]?.id || null)
  state.logs = load('logs', [])
  state.providerOverride = load('providerOverride', null)
  state.totalTokens = load('totalTokens', 0)
  state.customProviders = load('customProviders', [])
  state.providerOrder = load('providerOrder', [])
  state.poolMode = load('poolMode', false)
  state.streaming = load('streaming', true)
  state.usage = load('usage', { date: '', providers: {} })
  
  if (state.chats.length > 0) {
    state.currentChatId = state.chats[0].id
  }
}

function normalizeStoredApiKeys(apiKeys) {
  const normalized = {}

  Object.entries(apiKeys || {}).forEach(([providerId, value]) => {
    if (Array.isArray(value)) {
      normalized[providerId] = value
        .map(key => String(key ?? '').trim())
        .filter(Boolean)
      return
    }

    if (typeof value === 'string') {
      const trimmed = value.trim()
      normalized[providerId] = trimmed ? [trimmed] : []
      return
    }

    normalized[providerId] = []
  })

  return normalized
}

// ID GENERATION
export function uid() {
  return Math.random().toString(36).slice(2, 10)
}

// UTILS
export function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function defaultSystemPrompts() {
  return [
    {
      id: uid(),
      name: 'Default Assistant',
      content: 'You are a helpful, knowledgeable, and concise AI assistant. Provide accurate and well-structured responses.'
    },
    {
      id: uid(),
      name: 'Code Reviewer',
      content: `You are an expert software engineer and code reviewer. Your task is to review the provided code snippets or pull requests.

Focus on:
1. Performance bottlenecks
2. Security vulnerabilities
3. Readability and maintainability
4. Adherence to idiomatic patterns for the given language

When providing feedback:
- Be direct and constructive.
- Provide code examples for suggested improvements.
- If the code is good, explicitly state what is done well.
- Format all code suggestions using markdown code blocks with the appropriate language tag.

Do not write introductory or concluding pleasantries. Output only the review.`
    },
    {
      id: uid(),
      name: 'Copywriter',
      content: 'You are a professional copywriter specializing in clear, compelling, and conversion-focused writing. Craft engaging copy that speaks directly to the target audience.'
    },
    {
      id: uid(),
      name: 'JSON Formatter',
      content: 'You are a JSON formatting assistant. When given any data or request, output only valid, well-formatted JSON. Never include explanations or markdown fences unless explicitly asked.'
    }
  ]
}

// USAGE TRACKING
export function checkUsageReset() {
  const today = new Date().toISOString().split('T')[0]
  if (state.usage.date !== today) {
    state.usage = { date: today, providers: {} }
    save('usage', state.usage)
  }
}

export function incrementUsage(providerId) {
  checkUsageReset()
  state.usage.providers[providerId] = 
    (state.usage.providers[providerId] || 0) + 1
  save('usage', state.usage)
}

export function getUsage(providerId) {
  checkUsageReset()
  return state.usage.providers[providerId] || 0
}

// CHAT MANAGEMENT
export function newChat() {
  const id = uid()
  state.chats.unshift({
    id,
    title: 'New Chat',
    messages: [],
    createdAt: Date.now(),
    tokens: 0
  })
  state.currentChatId = id
  persist()
  return id
}

export function getCurrentChat() {
  return state.chats.find(c => c.id === state.currentChatId)
}

export function deleteChat(id) {
  state.chats = state.chats.filter(c => c.id !== id)
  if (state.currentChatId === id) {
    state.currentChatId = state.chats[0]?.id || null
  }
  persist()
}

// PROMPTS MANAGEMENT
export function getActiveSystemPrompt() {
  return state.systemPrompts.find(
    p => p.id === state.activePromptId
  )
}

export function setActivePrompt(id) {
  state.activePromptId = id
  persist()
}

export function getPrompt(id) {
  return state.systemPrompts.find(p => p.id === id)
}

// LOGS
export function addLog(entry) {
  state.logs.unshift({
    id: uid(),
    time: new Date().toISOString(),
    providerId: entry.providerId,
    model: entry.model,
    latency: entry.latency,
    tokens: entry.tokens,
    status: entry.status,
    error: entry.error || entry.errorMessage || null,
    payload: entry.payload || entry.messages || {},
    responseHeaders: entry.responseHeaders || {}
  })
  if (state.logs.length > 500) {
    state.logs = state.logs.slice(0, 500)
  }
  save('logs', state.logs)
}

export function clearLogs() {
  state.logs = []
  persist()
}
