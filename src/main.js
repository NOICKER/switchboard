import './styles/main.css'
import './styles/layout.css'
import './styles/components.css'
import './styles/chat.css'
import './styles/settings.css'
import './styles/prompts.css'
import './styles/logs.css'
import './styles/usage.css'
import './styles/toast.css'

import { state, persist, loadState } from './state.js'
import { renderSidebar, attachSidebarHandlers } from './components/sidebar.js'
import { renderTopnav, attachTopnavHandlers } from './components/topnav.js'
import { attachKeyboardShortcuts } from './components/shortcuts.js'

import { renderChatView, attachChatHandlers } from './views/chat.js'
import { renderSettingsView, attachSettingsHandlers } from './views/settings.js'
import { renderPromptsView, attachPromptsHandlers } from './views/prompts.js'
import { renderLogsView, attachLogsHandlers } from './views/logs.js'
import { renderUsageView, attachUsageHandlers } from './views/usage.js'

// Export app to global scope for other modules to use
window.app = {
  state,
  renderApp
}

export function renderApp() {
  const root = document.getElementById('app')
  if (!root) {
    console.error('Root #app element not found')
    return
  }

  // Render main layout
  const mainHtml = `
    ${renderTopnav()}
    <div class="app-body">
      ${renderSidebar()}
      <main class="app-main">
        ${renderCurrentView()}
      </main>
    </div>
  `

  root.innerHTML = mainHtml

  // Attach all handlers
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

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  loadState()
  renderApp()
  attachKeyboardShortcuts()

  // Re-render on state changes from other tabs
  window.addEventListener('storage', () => {
    loadState()
    renderApp()
  })
})
