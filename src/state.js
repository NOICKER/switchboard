// STATE MANAGEMENT
const listeners = new Set()
export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function notify() {
  listeners.forEach(fn => fn())
}

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
  usageAnalytics: null,
  authUser: null,
  backendAvailable: true,
  sidebarOpen: true,
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
  save('providerOverride', state.providerOverride)
  save('totalTokens', state.totalTokens)
  save('customProviders', sanitizeCustomProviders(state.customProviders))
  save('providerOrder', state.providerOrder)
  save('poolMode', state.poolMode)
  save('streaming', state.streaming)
  save('sidebarOpen', state.sidebarOpen)
  save('apiKeys', state.apiKeys)

  if (typeof window !== 'undefined' && window.app?.queueWorkspaceSync) {
    window.app.queueWorkspaceSync()
  }
  notify()
}

export function loadState() {
  state.chats = []
  state.apiKeys = load('apiKeys', {})
  state.keyRotation = {}
  state.keyCooldowns = {}
  state.keyStatus = {}
  state.systemPrompts = defaultSystemPrompts()
  state.activePromptId = state.systemPrompts[0]?.id || null
  state.logs = []
  state.providerOverride = load('providerOverride', null)
  state.totalTokens = load('totalTokens', 0)
  state.customProviders = sanitizeCustomProviders(load('customProviders', []))
  state.providerOrder = load('providerOrder', [])
  state.poolMode = load('poolMode', false)
  state.streaming = load('streaming', true)
  state.usage = { date: '', providers: {} }
  state.usageAnalytics = null
  state.authUser = null
  state.backendAvailable = true
  state.sidebarOpen = typeof window !== 'undefined' && window.innerWidth < 1280
    ? false
    : load('sidebarOpen', true)
}

function sanitizeCustomProviders(customProviders) {
  return (customProviders || []).map(provider => ({
    id: provider.id,
    name: provider.name,
    baseUrl: provider.baseUrl,
    model: provider.model,
    adapterType: provider.adapterType || 'openai',
    dailyLimit: provider.dailyLimit
  }))
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
  return state.usage
}

export function incrementUsage(providerId) {
  state.usage.providers[providerId] =
    (state.usage.providers[providerId] || 0) + 1
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
  notify()
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
  notify()
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
  notify()
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
}

export function clearLogs() {
  state.logs = []
}

// SESSION & BACKEND HYDRATION
import {
  ensureBackendReachable,
  fetchCurrentUser,
  fetchKeysFromBackend,
  fetchLogsFromBackend,
  fetchUsageFromBackend,
  fetchWorkspaceFromBackend,
  isBackendOfflineError,
  syncWorkspaceToBackend
} from './backend-api.js'

let workspaceSyncTimer = null

export async function refreshSessionState() {
  try {
    await ensureBackendReachable()
    state.backendAvailable = true
  } catch (error) {
    state.backendAvailable = false
    hydrateLocalFallbackState()
    notify()
    return
  }

  await Promise.all([
    hydrateAuthFromBackend(),
    hydrateKeysFromBackend(),
    hydrateWorkspaceFromBackend(),
    refreshTelemetry()
  ])
  notify()
}

async function hydrateAuthFromBackend() {
  try {
    state.authUser = await fetchCurrentUser()
  } catch (error) {
    state.authUser = null
    if (!isBackendOfflineError(error)) {
      console.warn('Failed to hydrate auth user', error)
    }
  }
}

async function hydrateKeysFromBackend() {
  try {
    state.apiKeys = await fetchKeysFromBackend()
  } catch (error) {
    state.apiKeys = {}
    if (!isBackendOfflineError(error)) {
      console.warn('Failed to hydrate backend keys', error)
    }
  }
}

async function hydrateWorkspaceFromBackend() {
  try {
    const workspace = await fetchWorkspaceFromBackend()
    if (workspace) {
      state.chats = workspace.chats || []
      state.systemPrompts = workspace.prompts?.length
        ? workspace.prompts
        : defaultSystemPrompts()
      state.activePromptId = workspace.activePromptId || state.systemPrompts[0]?.id || null
      state.currentChatId = workspace.currentChatId || state.chats[0]?.id || null
      return
    }
  } catch (error) {
    if (!isBackendOfflineError(error)) {
      console.warn('Failed to hydrate workspace', error)
    }
  }

  state.chats = state.chats || []
  state.systemPrompts = state.systemPrompts?.length ? state.systemPrompts : defaultSystemPrompts()
  state.activePromptId = state.activePromptId || state.systemPrompts[0]?.id || null
  state.currentChatId = state.currentChatId || state.chats[0]?.id || null

  try {
    await syncWorkspaceToBackend()
  } catch (error) {
    if (!isBackendOfflineError(error)) {
      console.warn('Failed to seed workspace', error)
    }
  }
}

export async function refreshTelemetry() {
  try {
    const [logs, usageAnalytics] = await Promise.all([
      fetchLogsFromBackend(),
      fetchUsageFromBackend()
    ])

    state.logs = logs
    state.usageAnalytics = usageAnalytics
    state.usage = usageAnalytics?.dailyUsage || { date: '', providers: {} }
  } catch (error) {
    if (!isBackendOfflineError(error)) {
      console.warn('Failed to refresh backend telemetry', error)
    }
  }
}

function hydrateLocalFallbackState() {
  state.authUser = null
  state.apiKeys = load('apiKeys', {})
  state.logs = []
  state.usage = { date: '', providers: {} }
  state.usageAnalytics = null
  state.chats = state.chats?.length ? state.chats : []
  state.systemPrompts = state.systemPrompts?.length ? state.systemPrompts : defaultSystemPrompts()
  state.activePromptId = state.activePromptId || state.systemPrompts[0]?.id || null
  state.currentChatId = state.currentChatId || state.chats[0]?.id || null
}

export function queueWorkspaceSync() {
  clearTimeout(workspaceSyncTimer)
  workspaceSyncTimer = setTimeout(async () => {
    try {
      await syncWorkspaceToBackend()
    } catch (error) {
      console.warn('Failed to sync workspace', error)
    }
  }, 150)
}
