import './styles/main.css'
import './styles/layout.css'
import './styles/components.css'
import './styles/chat.css'
import './styles/settings.css'
import './styles/prompts.css'
import './styles/logs.css'
import './styles/usage.css'
import './styles/toast.css'

import { state, defaultSystemPrompts, loadState } from './state.js'
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
import { renderSidebar, attachSidebarHandlers } from './components/sidebar.js'
import { renderTopnav, attachTopnavHandlers } from './components/topnav.js'
import { attachKeyboardShortcuts } from './components/shortcuts.js'

import { renderChatView, attachChatHandlers, clearResponseCopyMap } from './views/chat.js'
import { renderSettingsView, attachSettingsHandlers } from './views/settings.js'
import { renderPromptsView, attachPromptsHandlers } from './views/prompts.js'
import { renderLogsView, attachLogsHandlers } from './views/logs.js'
import { renderUsageView, attachUsageHandlers } from './views/usage.js'

let workspaceSyncTimer = null

window.app = {
  state,
  renderApp,
  refreshTelemetry,
  refreshSessionState,
  queueWorkspaceSync
}

export function renderApp() {
  const root = document.getElementById('app')
  if (!root) {
    console.error('Root #app element not found')
    return
  }

  clearResponseCopyMap()

  root.innerHTML = `
    ${renderTopnav()}
    <div class="app-body">
      ${renderSidebar()}
      <main class="app-main">
        ${renderCurrentView()}
      </main>
    </div>
  `

  attachTopnavHandlers()
  attachSidebarHandlers()
  attachCurrentViewHandlers()
}

function renderCurrentView() {
  switch (state.currentView) {
    case 'chat':
      return renderChatView()
    case 'settings':
      return renderSettingsView()
    case 'prompts':
      return renderPromptsView()
    case 'logs':
      return renderLogsView()
    case 'usage':
      return renderUsageView()
    default:
      return renderChatView()
  }
}

function attachCurrentViewHandlers() {
  switch (state.currentView) {
    case 'chat':
      attachChatHandlers()
      break
    case 'settings':
      attachSettingsHandlers()
      break
    case 'prompts':
      attachPromptsHandlers()
      break
    case 'logs':
      attachLogsHandlers()
      break
    case 'usage':
      attachUsageHandlers()
      break
  }
}

document.addEventListener('DOMContentLoaded', () => {
  bootstrapApp()

  let storageDebounce
  window.addEventListener('storage', () => {
    clearTimeout(storageDebounce)
    storageDebounce = setTimeout(async () => {
      loadState()
      await refreshSessionState()
      renderApp()
    }, 150)
  })
})

async function bootstrapApp() {
  loadState()
  await refreshSessionState()
  renderApp()
  attachKeyboardShortcuts()
}

export async function refreshSessionState() {
  try {
    await ensureBackendReachable()
    state.backendAvailable = true
  } catch (error) {
    state.backendAvailable = false
    hydrateLocalFallbackState()
    return
  }

  await Promise.all([
    hydrateAuthFromBackend(),
    hydrateKeysFromBackend(),
    hydrateWorkspaceFromBackend(),
    refreshTelemetry()
  ])
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
  state.apiKeys = {}
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
