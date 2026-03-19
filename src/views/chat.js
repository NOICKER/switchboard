import { state, getCurrentChat, persist, getActiveSystemPrompt } from '../state.js'
import { getProviderOrder, getAllProviders } from '../providers.js'
import { routeMessage } from '../router.js'
import { renderMarkdown, attachCopyHandlers } from '../markdown.js'

let handleDocumentClick = null
let handleResponseCopyClick = null
let responseCopyContainer = null

export function renderChatView() {
  const chat = getCurrentChat()
  const activePrompt = getActiveSystemPrompt()
  const activeProvider = getActiveProvider()
  const sessionTokens = getSessionTokens(chat)

  return `
    <div class="view" id="view-chat">
      <div class="chat-shell">
        <header class="chat-header">
          <div class="chat-header-main">
            <div class="provider-badge provider-badge--chat">
              <span class="provider-badge__avatar" style="background-color: ${activeProvider.avatarColor}">
                ${activeProvider.initials}
              </span>
              <span class="provider-badge__copy">
                <strong>${escapeHtml(activeProvider.name)}</strong>
                <small>${escapeHtml(activeProvider.model)}</small>
              </span>
            </div>
            ${renderPoolIndicator()}
          </div>

          <div class="chat-header-actions">
            ${renderTokenPill(sessionTokens)}
            <div class="provider-switch">
              <button
                id="toggle-provider-dropdown"
                class="btn-secondary provider-switch-btn"
                title="Switch provider"
                type="button"
              >
                <span>Provider</span>
                ${chevronIcon()}
              </button>
              ${renderProviderDropdown()}
            </div>
          </div>
        </header>

        <div class="chat-messages" id="chat-messages">
          ${renderMessages(chat?.messages || [])}
        </div>

        <div class="chat-compose-area">
          <div class="chat-composer">
            <textarea
              id="chat-input"
              class="chat-input"
              placeholder="Message ${escapeHtml(activeProvider.name)}..."
              maxlength="8000"
              rows="1"
            ></textarea>

            <div class="chat-composer-footer">
              <div class="chat-composer-meta">
                ${activePrompt ? `<span class="composer-chip">Prompt: ${escapeHtml(activePrompt.name)}</span>` : ''}
                <span class="composer-hint">Shift + Enter adds a new line</span>
              </div>

              <button
                id="send-btn"
                class="send-btn"
                type="button"
                ${state.sending ? 'disabled' : ''}
              >
                <span class="send-text">${state.sending ? 'Sending...' : 'Send'}</span>
                ${sendArrowIcon()}
              </button>
            </div>
          </div>

          <div class="chat-footer">
            <small class="token-count" id="token-count">Session tokens: ${formatNumber(sessionTokens)}</small>
          </div>
        </div>
      </div>
    </div>
  `
}

export function attachChatHandlers() {
  const input = document.getElementById('chat-input')
  const sendBtn = document.getElementById('send-btn')
  const messagesContainer = document.getElementById('chat-messages')
  const dropdownToggle = document.getElementById('toggle-provider-dropdown')
  const dropdownMenu = document.getElementById('provider-dropdown')

  if (input) {
    input.addEventListener('keydown', handleInputKeydown)
    input.addEventListener('input', () => autoResizeTextarea(input))
    autoResizeTextarea(input)
  }

  if (sendBtn) {
    sendBtn.addEventListener('click', handleSendMessage)
  }

  if (dropdownToggle) {
    dropdownToggle.addEventListener('click', event => {
      event.stopPropagation()
      dropdownMenu?.classList.toggle('open')
    })
  }

  if (dropdownMenu) {
    const providerButtons = dropdownMenu.querySelectorAll('.provider-option')
    providerButtons.forEach(button => {
      button.addEventListener('click', event => {
        const providerId = event.currentTarget.dataset.providerId
        state.providerOverride = providerId
        persist()
        dropdownMenu.classList.remove('open')
        document.getElementById('view-chat')?.replaceWith(...parseChatHtml(renderChatView()))
        attachChatHandlers()
      })
    })
  }

  if (messagesContainer) {
    attachCopyHandlers(messagesContainer)

    // Ensure we only ever attach one response-copy listener per container.
    if (responseCopyContainer && handleResponseCopyClick) {
      responseCopyContainer.removeEventListener('click', handleResponseCopyClick)
    }

    responseCopyContainer = messagesContainer
    handleResponseCopyClick = event => {
      const button = event.target.closest('.copy-response-btn')
      if (!button || !responseCopyContainer.contains(button)) return
      const text = button.dataset.copy || ''
      navigator.clipboard.writeText(text).catch(() => {})
    }

    messagesContainer.addEventListener('click', handleResponseCopyClick)
  }

  if (handleDocumentClick) {
    document.removeEventListener('click', handleDocumentClick)
  }

  handleDocumentClick = event => {
    if (dropdownMenu?.classList.contains('open') && !event.target.closest('.provider-switch')) {
      dropdownMenu.classList.remove('open')
    }
  }

  document.addEventListener('click', handleDocumentClick)
}

function handleInputKeydown(event) {
  if (event.key === 'Enter' && !event.shiftKey && !state.sending) {
    event.preventDefault()
    handleSendMessage()
  }
}

async function handleSendMessage() {
  const input = document.getElementById('chat-input')
  if (!input || !input.value.trim()) return

  const text = input.value.trim()
  input.value = ''
  autoResizeTextarea(input)

  const chat = getCurrentChat()
  if (!chat) return

  chat.messages.push({
    role: 'user',
    content: text
  })

  const messagesContainer = document.getElementById('chat-messages')
  if (messagesContainer) {
    if (messagesContainer.querySelector('.chat-empty')) {
      messagesContainer.innerHTML = ''
    }

    messagesContainer.insertAdjacentHTML(
      'beforeend',
      renderUserMessage(text)
    )
    messagesContainer.scrollTop = messagesContainer.scrollHeight

    messagesContainer.insertAdjacentHTML(
      'beforeend',
      renderThinkingMessage()
    )
    messagesContainer.scrollTop = messagesContainer.scrollHeight
  }

  state.sending = true
  updateSendButton()
  persist()

  let shouldRefreshApp = false

  try {
    let fullText = ''

    const activeProvider = getActiveProvider()

    const result = await routeMessage(chat.messages, chunk => {
      fullText += chunk

      const thinkingEl = document.getElementById('ai-thinking')
      if (thinkingEl && messagesContainer) {
        thinkingEl.replaceWith(
          ...parseAiMessageHtml(
            renderAssistantMessage(
              fullText,
              {
                id: 'ai-thinking',
                providerId: activeProvider.id,
                providerLabel: activeProvider.name,
                tokens: Math.ceil(fullText.length / 4),
                latency: 'Streaming'
              }
            )
          )
        )

        messagesContainer.scrollTop = messagesContainer.scrollHeight
      }
    })

    if (!fullText) {
      fullText = result.text
    }

    chat.messages.push({
      role: 'assistant',
      content: fullText,
      providerId: result.providerId,
      latency: result.latency,
      tokens: result.tokens
    })

    const thinkingEl = document.getElementById('ai-thinking')
    if (thinkingEl && fullText) {
      const bubble = thinkingEl.querySelector('.message-card')
      if (bubble) {
        bubble.innerHTML = `
          <div class="message-meta">
            <span class="message-provider">
              ${escapeHtml(result.providerId || 'Assistant')}
            </span>
            <span class="message-stats">
              ${formatNumber(result.tokens || 0)} tokens /
              ${result.latency || 0}ms
            </span>
          </div>
          <div class="message-content">
            ${renderMarkdown(fullText)}
          </div>
          <div class="message-actions">
            <button
              class="btn-icon btn-icon--subtle copy-response-btn"
              title="Copy response"
              type="button"
              data-copy="${escapeAttribute(fullText)}"
            >
              ${copyIcon()}
            </button>
          </div>
        `
        thinkingEl.removeAttribute('id')
      }
    } else {
      if (thinkingEl) thinkingEl.remove()
      if (messagesContainer) {
        messagesContainer.insertAdjacentHTML(
          'beforeend',
          renderAssistantMessage(fullText, {
            providerId: result.providerId,
            latency: result.latency,
            tokens: result.tokens
          })
        )
      }
    }

    if (messagesContainer) {
      messagesContainer.scrollTop =
        messagesContainer.scrollHeight
      attachCopyHandlers(messagesContainer)
    }

    persist()
    shouldRefreshApp = true
  } catch (error) {
    if (messagesContainer) {
      const thinkingEl = document.getElementById('ai-thinking')
      if (thinkingEl) {
        thinkingEl.remove()
      }

      messagesContainer.insertAdjacentHTML(
        'beforeend',
        `
          <article class="chat-message chat-message--assistant">
            <div class="message-card message-card--error">
              <div class="message-meta">
                <span class="message-provider">Routing error</span>
                <span class="message-stats">Request failed</span>
              </div>
              <div class="message-content">
                <p><strong>Error:</strong> ${escapeHtml(error.message)}</p>
              </div>
            </div>
          </article>
        `
      )
      messagesContainer.scrollTop = messagesContainer.scrollHeight
    }
  } finally {
    state.sending = false
    updateSendButton()
    updateTokenFooter()
    persist()
    if (shouldRefreshApp && state.currentView === 'chat') {
      window.app?.renderApp?.()
    }
  }
}

function renderMessages(messages) {
  if (!messages.length) {
    return renderEmptyState()
  }

  return messages.map(message => {
    if (message.role === 'user') {
      return renderUserMessage(message.content)
    }

    return renderAssistantMessage(message.content, {
      providerId: message.providerId,
      tokens: message.tokens,
      latency: message.latency
    })
  }).join('')
}

function renderEmptyState() {
  const order = getProviderOrder().slice(0, 3).map(id => getAllProviders()[id]?.name || id)
  const activePrompt = getActiveSystemPrompt()

  return `
    <section class="chat-empty">
      <div class="chat-empty__eyebrow">Switchboard</div>
      <h2>Route your first prompt</h2>
      <p>
        Send one message and Switchboard will apply your local prompt,
        provider order, and telemetry automatically.
      </p>

      <div class="chat-empty-grid">
        <article class="chat-empty-card">
          <span class="chat-empty-card__label">Routing order</span>
          <strong>${escapeHtml(order.join(' / ') || 'Configure providers')}</strong>
        </article>
        <article class="chat-empty-card">
          <span class="chat-empty-card__label">Active prompt</span>
          <strong>${escapeHtml(activePrompt?.name || 'Default assistant')}</strong>
        </article>
      </div>
    </section>
  `
}

function renderUserMessage(content) {
  return `
    <article class="chat-message chat-message--user">
      <div class="message-card message-card--user">
        <div class="message-meta">
          <span class="message-provider">You</span>
        </div>
        <div class="message-content">${renderMarkdown(content)}</div>
      </div>
    </article>
  `
}

function renderAssistantMessage(content, metadata = {}) {
  const providerLabel = metadata.providerLabel || metadata.providerId || 'Assistant'
  const stats = []

  if (metadata.tokens !== undefined) {
    stats.push(`${formatNumber(metadata.tokens)} tokens`)
  }

  if (metadata.latency !== undefined) {
    stats.push(typeof metadata.latency === 'number' ? `${metadata.latency}ms` : metadata.latency)
  }

  return `
    <article class="chat-message chat-message--assistant" ${metadata.id ? `id="${metadata.id}"` : ''}>
      <div class="message-card">
        <div class="message-meta">
          <span class="message-provider">${escapeHtml(providerLabel)}</span>
          ${stats.length ? `<span class="message-stats">${escapeHtml(stats.join(' / '))}</span>` : ''}
        </div>
        <div class="message-content">${renderMarkdown(content)}</div>
        <div class="message-actions">
          <button
            class="btn-icon btn-icon--subtle copy-response-btn"
            title="Copy response"
            type="button"
            data-copy="${escapeAttribute(content)}"
          >
            ${copyIcon()}
          </button>
        </div>
      </div>
    </article>
  `
}

function renderThinkingMessage() {
  return `
    <article class="chat-message chat-message--assistant" id="ai-thinking">
      <div class="message-card message-card--thinking">
        <div class="message-meta">
          <span class="message-provider">Routing request</span>
          <span class="message-stats">Waiting for first token</span>
        </div>
        <div class="thinking-indicator" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    </article>
  `
}

function renderTokenPill(total) {
  return `
    <div class="token-pill">
      <span class="token-pill__label">Tokens</span>
      <strong>${formatNumber(total)}</strong>
    </div>
  `
}

function renderPoolIndicator() {
  if (!state.poolMode) {
    return `
      <div class="routing-pill">
        <span class="routing-pill__dot"></span>
        <span>Sequential fallback</span>
      </div>
    `
  }

  return `
    <div class="routing-pill routing-pill--pool">
      <span class="routing-pill__dot"></span>
      <span>Pool mode enabled</span>
    </div>
  `
}

function renderProviderDropdown() {
  const providers = getAllProviders()
  const order = getProviderOrder()
  const activeProvider = getActiveProvider()

  const options = order.map(id => {
    const provider = providers[id]
    if (!provider) return ''

    const selected = (state.providerOverride || activeProvider.id) === id

    return `
      <button
        class="provider-option ${selected ? 'active' : ''}"
        data-provider-id="${id}"
        type="button"
      >
        <span class="provider-option__avatar" style="background-color: ${provider.avatarColor}">
          ${provider.initials}
        </span>
        <span class="provider-option__copy">
          <strong>${escapeHtml(provider.name)}</strong>
          <small>${escapeHtml(provider.model)}</small>
        </span>
        ${selected ? `<span class="provider-option__check">${checkIcon()}</span>` : ''}
      </button>
    `
  }).filter(Boolean).join('')

  return `
    <div id="provider-dropdown" class="provider-dropdown">
      ${options}
    </div>
  `
}

function getActiveProvider() {
  const providers = getAllProviders()
  const fallbackId = getProviderOrder().find(id => providers[id]) || 'groq'
  const id = state.providerOverride || fallbackId
  const provider = providers[id] || providers.groq

  return {
    id,
    ...provider
  }
}

function getSessionTokens(chat) {
  return chat?.messages?.reduce((sum, message) => sum + (message.tokens || 0), 0) || 0
}

function autoResizeTextarea(element) {
  element.style.height = 'auto'
  element.style.height = `${Math.min(element.scrollHeight, 220)}px`
}

function updateSendButton() {
  const button = document.getElementById('send-btn')
  if (!button) return

  button.disabled = state.sending
  button.querySelector('.send-text').textContent = state.sending ? 'Sending...' : 'Send'
}

function updateTokenFooter() {
  const chat = getCurrentChat()
  const total = getSessionTokens(chat)
  const footer = document.getElementById('token-count')

  if (footer) {
    footer.textContent = `Session tokens: ${formatNumber(total)}`
  }
}

function formatNumber(value) {
  return new Intl.NumberFormat().format(value || 0)
}

function parseChatHtml(html) {
  const container = document.createElement('div')
  container.innerHTML = html
  return [...container.childNodes]
}

function parseAiMessageHtml(html) {
  const container = document.createElement('div')
  container.innerHTML = html
  return [...container.childNodes]
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

function escapeAttribute(text) {
  return escapeHtml(text).replace(/`/g, '&#096;')
}

function chevronIcon() {
  return `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
      <path d="m6 9 6 6 6-6"></path>
    </svg>
  `
}

function sendArrowIcon() {
  return `
    <svg class="send-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
      <path d="M12 5v14"></path>
      <path d="m17 10-5-5-5 5"></path>
    </svg>
  `
}

function copyIcon() {
  return `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
      <rect x="9" y="9" width="10" height="10" rx="2"></rect>
      <path d="M5 15V5a2 2 0 0 1 2-2h10"></path>
    </svg>
  `
}

function checkIcon() {
  return `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
      <path d="m5 12 4 4L19 6"></path>
    </svg>
  `
}
