import { state, newChat, deleteChat } from '../state.js'

const NAV_ITEMS = [
  { id: 'chat', label: 'Chat', description: 'Route prompts', icon: chatIcon() },
  { id: 'settings', label: 'Provider Settings', description: 'Keys and routing', icon: settingsIcon() },
  { id: 'prompts', label: 'System Prompts', description: 'Context presets', icon: promptsIcon() },
  { id: 'logs', label: 'Logs', description: 'Telemetry', icon: logsIcon() },
  { id: 'usage', label: 'Usage', description: 'Analytics', icon: usageIcon() }
]

export function renderSidebar() {
  return `
    <aside class="sidebar" id="app-sidebar">
      <div class="sidebar-brand">
        <div class="brand-mark" aria-hidden="true">
          ${brandIcon()}
        </div>
        <div class="brand-copy">
          <h1>Switchboard</h1>
          <p>Local-first AI router</p>
        </div>
      </div>

      <div class="sidebar-actions">
        <button id="new-chat-btn" class="sidebar-primary-btn" type="button">
          <span class="sidebar-primary-btn__icon" aria-hidden="true">${plusIcon()}</span>
          <span>New Chat</span>
        </button>
      </div>

      <nav class="sidebar-nav" aria-label="Primary">
        <section class="sidebar-section">
          <div class="sidebar-section-label">Workspace</div>
          <ul class="sidebar-list">
            ${NAV_ITEMS.map(renderNavItem).join('')}
          </ul>
        </section>

        <section class="sidebar-section sidebar-section--history">
          <div class="sidebar-section-header">
            <span class="sidebar-section-label">Recent Chats</span>
            <span class="sidebar-section-count">${state.chats?.length || 0}</span>
          </div>
          <ul class="chat-history" id="chat-history">
            ${renderChatHistory()}
          </ul>
        </section>
      </nav>

      <div class="sidebar-footer">
        <span class="system-dot" aria-hidden="true"></span>
        <span>System online</span>
      </div>
    </aside>
  `
}

export function attachSidebarHandlers() {
  const navLinks = document.querySelectorAll('.nav-link')
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      const view = link.dataset.view
      state.currentView = view
      window.app?.renderApp?.()
    })
  })

  const newChatBtn = document.getElementById('new-chat-btn')
  if (newChatBtn) {
    newChatBtn.addEventListener('click', evt => {
      evt.stopPropagation()
      newChat()
      state.currentView = 'chat'
      window.app?.renderApp?.()
    })
  }

  attachChatHistoryHandlers(document)
}

export function attachChatHistoryHandlers(root = document) {
  const chatItems = root.querySelectorAll('.chat-item')
  chatItems.forEach(item => {
    item.addEventListener('click', () => {
      const id = item.dataset.chatId
      state.currentChatId = id
      state.currentView = 'chat'
      window.app?.renderApp?.()
    })
  })

  const deleteButtons = root.querySelectorAll('.delete-chat-btn')
  deleteButtons.forEach(btn => {
    btn.addEventListener('click', evt => {
      evt.stopPropagation()
      const id = btn.dataset.chatId
      if (confirm('Delete this chat?')) {
        deleteChat(id)
        window.app?.renderApp?.()
      }
    })
  })
}

function renderNavItem(item) {
  const active = state.currentView === item.id
  return `
    <li class="nav-item ${active ? 'active' : ''}">
      <button class="nav-link" type="button" data-view="${item.id}">
        <span class="nav-icon" aria-hidden="true">${item.icon}</span>
        <span class="nav-copy">
          <span class="nav-label">${item.label}</span>
          <span class="nav-description">${item.description}</span>
        </span>
      </button>
    </li>
  `
}

export function renderChatHistory() {
  const currentId = state.currentChatId
  const chats = state.chats || []

  if (!chats.length) {
    return `
      <li class="chat-empty-state">
        <div class="chat-empty-card">
          <strong>No chats yet</strong>
          <span>Start a new conversation to build local history.</span>
        </div>
      </li>
    `
  }

  return chats.map(chat => {
    const preview = getChatPreview(chat)
    const isActive = chat.id === currentId

    return `
      <li class="chat-item ${isActive ? 'active' : ''}" data-chat-id="${chat.id}">
        <div class="chat-item-content">
          <div class="chat-preview">${escapeHtml(preview)}</div>
          <div class="chat-time">${formatTime(chat.createdAt)}</div>
        </div>
        <button
          class="delete-chat-btn btn-icon btn-icon--subtle"
          data-chat-id="${chat.id}"
          title="Delete chat"
          type="button"
        >
          ${closeIcon()}
        </button>
      </li>
    `
  }).join('')
}

function getChatPreview(chat) {
  const firstMessage = chat.messages?.find(message => message.role === 'user')?.content?.trim()
  if (!firstMessage) {
    return 'New chat'
  }

  if (firstMessage.length <= 54) {
    return firstMessage
  }

  return `${firstMessage.slice(0, 51)}...`
}

function formatTime(timestamp) {
  const date = new Date(timestamp)
  const now = new Date()

  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const diff = now.getTime() - date.getTime()
  if (diff < 24 * 60 * 60 * 1000 * 2) {
    return 'Yesterday'
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }

  return (text || '').replace(/[&<>"']/g, char => map[char])
}

function brandIcon() {
  return `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
      <path d="M8 3h8v8h-8z"></path>
      <path d="M3 13h8v8H3z"></path>
      <path d="M13 13h8v8h-8z"></path>
    </svg>
  `
}

function plusIcon() {
  return `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
      <path d="M12 5v14"></path>
      <path d="M5 12h14"></path>
    </svg>
  `
}

function closeIcon() {
  return `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
      <path d="M18 6 6 18"></path>
      <path d="m6 6 12 12"></path>
    </svg>
  `
}

function chatIcon() {
  return `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
      <path d="M7 18h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v14z"></path>
      <path d="M7 18 4 21V7a3 3 0 0 1 3-3"></path>
    </svg>
  `
}

function settingsIcon() {
  return `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
      <path d="M11 4h2l.6 2.2a6.9 6.9 0 0 1 1.7.7l2-1.1 1.4 1.4-1.1 2a6.9 6.9 0 0 1 .7 1.7L20 12v2l-2.2.6a6.9 6.9 0 0 1-.7 1.7l1.1 2-1.4 1.4-2-1.1a6.9 6.9 0 0 1-1.7.7L13 20h-2l-.6-2.2a6.9 6.9 0 0 1-1.7-.7l-2 1.1-1.4-1.4 1.1-2a6.9 6.9 0 0 1-.7-1.7L4 14v-2l2.2-.6a6.9 6.9 0 0 1 .7-1.7l-1.1-2 1.4-1.4 2 1.1a6.9 6.9 0 0 1 1.7-.7L11 4z"></path>
      <circle cx="12" cy="12" r="2.6"></circle>
    </svg>
  `
}

function promptsIcon() {
  return `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
      <path d="M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"></path>
      <path d="M9 8h6"></path>
      <path d="M9 12h6"></path>
      <path d="M9 16h4"></path>
    </svg>
  `
}

function logsIcon() {
  return `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
      <path d="M4 5h16"></path>
      <path d="M4 12h16"></path>
      <path d="M4 19h16"></path>
      <path d="M8 5v14"></path>
    </svg>
  `
}

function usageIcon() {
  return `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
      <path d="M4 19h16"></path>
      <path d="M7 16V9"></path>
      <path d="M12 16V5"></path>
      <path d="M17 16v-3"></path>
    </svg>
  `
}
