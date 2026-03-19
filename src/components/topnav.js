import { state } from '../state.js'

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

  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
      const sidebar = document.getElementById('app-sidebar')
      if (sidebar) {
        sidebar.classList.toggle('hidden')
      }
    })
  }

  if (helpBtn) {
    helpBtn.addEventListener('click', () => {
      showHelpModal()
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
          <p>Everything stays local to your browser unless you send a routed request.</p>
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
            <li>Pool mode races all configured providers in parallel.</li>
            <li>Responses and prompts are stored locally in your browser.</li>
            <li>Logs are trimmed automatically to keep the app lightweight.</li>
          </ul>
        </section>
      </div>

      <div class="modal-footer">
        <button class="btn-primary close-modal" type="button">Done</button>
      </div>
    </div>
  `

  document.body.appendChild(modal)

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
