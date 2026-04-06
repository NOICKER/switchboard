import { state, persist } from '../state.js'
import { loginWithBackend, logoutFromBackend, signupWithBackend } from '../backend-api.js'

export function renderTopnav() {
  return `
    <nav class="topnav" id="app-topnav">
      <div class="topnav-left">
        <button id="toggle-sidebar" class="btn-icon topnav-toggle" title="Toggle sidebar" type="button">
          ${menuIcon()}
        </button>

        <div class="topnav-brand">
          <span class="topnav-brand-mark" aria-hidden="true">${brandIcon()}</span>
          <span class="topnav-brand-copy">
            <strong>Switchboard</strong>
            <small>${getCurrentViewLabel()}</small>
          </span>
        </div>
      </div>

      <div class="topnav-right">
        ${state.backendAvailable
          ? `<button id="account-btn" class="btn-secondary topnav-account-btn" type="button">
              ${state.authUser ? `@${escapeHtml(state.authUser.username)}` : 'Sign in'}
            </button>`
          : '<span class="topnav-status topnav-status--offline">Backend offline</span>'}
        <button id="show-help" class="btn-icon btn-icon--subtle" title="Help and shortcuts" type="button">
          ${helpIcon()}
        </button>
      </div>
    </nav>
  `
}

export function attachTopnavHandlers() {
  const sidebarToggle = document.getElementById('toggle-sidebar')
  const helpBtn = document.getElementById('show-help')
  const accountBtn = document.getElementById('account-btn')

  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
      const sidebar = document.getElementById('app-sidebar')
      if (sidebar) {
        sidebar.classList.toggle('hidden')
        state.sidebarOpen = !sidebar.classList.contains('hidden')
        persist()
      }
    })
  }

  if (helpBtn) {
    helpBtn.addEventListener('click', () => {
      showHelpModal()
    })
  }

  if (accountBtn) {
    accountBtn.addEventListener('click', () => {
      showAccountModal()
    })
  }
}

function showHelpModal() {
  const modal = document.createElement('div')
  modal.className = 'modal-overlay'
  modal.innerHTML = `
    <div class="modal-card modal-card--help" role="dialog" aria-modal="true" aria-labelledby="help-title">
      <div class="modal-header">
        <div>
          <h2 id="help-title">Help and Keyboard Shortcuts</h2>
          <p>Requests route through your backend session, and signed-in users can sync chats and prompts across devices.</p>
        </div>
        <button class="btn-icon btn-icon--subtle close-modal" type="button" title="Close help">
          ${closeIcon()}
        </button>
      </div>

      <div class="modal-body">
        <section class="shortcut-section">
          <h3>Keyboard Shortcuts</h3>
          <dl class="shortcuts-list">
            <div>
              <dt><kbd>Cmd/Ctrl</kbd> + <kbd>K</kbd></dt>
              <dd>Focus the chat input</dd>
            </div>
            <div>
              <dt><kbd>Cmd/Ctrl</kbd> + <kbd>Enter</kbd></dt>
              <dd>Send a message</dd>
            </div>
            <div>
              <dt><kbd>Cmd/Ctrl</kbd> + <kbd>N</kbd></dt>
              <dd>Start a new chat</dd>
            </div>
            <div>
              <dt><kbd>Cmd/Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd></dt>
              <dd>Toggle pool mode</dd>
            </div>
            <div>
              <dt><kbd>Shift</kbd> + <kbd>Enter</kbd></dt>
              <dd>Insert a new line</dd>
            </div>
          </dl>
        </section>

        <section class="shortcut-section">
          <h3>Quick Tips</h3>
          <ul class="tips-list">
            <li>Use Provider Settings to reorder fallback priority.</li>
            <li>Signed-in workspaces keep chats and prompts in sync through the backend.</li>
            <li>Custom providers can use OpenAI, Anthropic, or Gemini-style adapters.</li>
            <li>Logs and usage analytics are now backend-backed.</li>
          </ul>
        </section>
      </div>

      <div class="modal-footer">
        <button class="btn-primary close-modal" type="button">Done</button>
      </div>
    </div>
  `

  document.body.appendChild(modal)
  wireCloseButtons(modal)
}

function showAccountModal() {
  const modal = document.createElement('div')
  modal.className = 'modal-overlay'
  modal.innerHTML = state.authUser
    ? `
      <div class="modal-card modal-card--auth" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <div class="modal-header">
          <div>
            <h2 id="auth-title">Account</h2>
            <p>Signed in as @${escapeHtml(state.authUser.username)}. Chats and prompts now follow your account.</p>
          </div>
          <button class="btn-icon btn-icon--subtle close-modal" type="button" title="Close account">
            ${closeIcon()}
          </button>
        </div>
        <div class="modal-body">
          <div class="empty-panel">
            <strong>Workspace sync enabled</strong>
            <span>Your prompts and chat history are backed by the server for this account.</span>
          </div>
        </div>
        <div class="modal-footer">
          <button id="logout-btn" class="btn-secondary" type="button">Log out</button>
          <button class="btn-primary close-modal" type="button">Done</button>
        </div>
      </div>
    `
    : `
      <div class="modal-card modal-card--auth" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <div class="modal-header">
          <div>
            <h2 id="auth-title">Account</h2>
            <p>Create an account or sign in to sync chats and prompts across devices.</p>
          </div>
          <button class="btn-icon btn-icon--subtle close-modal" type="button" title="Close account">
            ${closeIcon()}
          </button>
        </div>
        <form id="auth-form" class="modal-body auth-form">
          <label class="form-group">
            <span>Username</span>
            <input id="auth-username" type="text" autocomplete="username" required />
          </label>
          <label class="form-group">
            <span>Password</span>
            <input id="auth-password" type="password" autocomplete="current-password" minlength="8" required />
          </label>
          <div class="auth-actions">
            <button id="signup-btn" class="btn-secondary" type="button">Create account</button>
            <button id="login-btn" class="btn-primary" type="button">Sign in</button>
          </div>
        </form>
      </div>
    `

  document.body.appendChild(modal)
  wireCloseButtons(modal)

  if (state.authUser) {
    modal.querySelector('#logout-btn')?.addEventListener('click', async () => {
      await logoutFromBackend()
      state.authUser = null
      await window.app?.refreshSessionState?.()
      window.app?.renderApp?.()
      modal.remove()
    })
    return
  }

  const usernameInput = modal.querySelector('#auth-username')
  const passwordInput = modal.querySelector('#auth-password')
  const loginBtn = modal.querySelector('#login-btn')
  const signupBtn = modal.querySelector('#signup-btn')

  const submit = async mode => {
    const username = usernameInput?.value?.trim()
    const password = passwordInput?.value || ''

    if (!username || password.length < 8) {
      return
    }

    loginBtn.disabled = true
    signupBtn.disabled = true

    try {
      state.authUser = mode === 'signup'
        ? await signupWithBackend({ username, password })
        : await loginWithBackend({ username, password })
      await window.app?.refreshSessionState?.()
      window.app?.renderApp?.()
      modal.remove()
    } catch (error) {
      alert(error.message || 'Authentication failed')
      loginBtn.disabled = false
      signupBtn.disabled = false
    }
  }

  loginBtn?.addEventListener('click', () => submit('login'))
  signupBtn?.addEventListener('click', () => submit('signup'))
}

function wireCloseButtons(modal) {
  const closeButtons = modal.querySelectorAll('.close-modal')
  closeButtons.forEach(button => {
    button.addEventListener('click', () => {
      modal.remove()
    })
  })

  modal.addEventListener('click', event => {
    if (event.target === modal) {
      modal.remove()
    }
  })
}

function getCurrentViewLabel() {
  switch (state.currentView) {
    case 'chat':
      return 'Prompt router'
    case 'settings':
      return 'Provider settings'
    case 'prompts':
      return 'System prompts'
    case 'logs':
      return 'Request logs'
    case 'usage':
      return 'Usage analytics'
    default:
      return 'Prompt router'
  }
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }

  return String(text || '').replace(/[&<>"']/g, char => map[char])
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

function menuIcon() {
  return `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
      <path d="M4 7h16"></path>
      <path d="M4 12h16"></path>
      <path d="M4 17h16"></path>
    </svg>
  `
}

function helpIcon() {
  return `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="9"></circle>
      <path d="M9.25 9.25a3 3 0 1 1 5.02 2.18c-.86.8-1.27 1.25-1.27 2.57"></path>
      <path d="M12 17h.01"></path>
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
