import { state, persist } from '../state.js'
import { getAllProviders, getProviderOrder, PROVIDERS } from '../providers.js'
import { clearHealthCache } from '../health.js'

export function renderSettingsView() {
  const providers = getAllProviders()

  return `
    <div class="view" id="view-settings">
      <div class="settings-page page-shell page-shell--narrow">
        <header class="page-header page-header--stacked">
          <span class="page-eyebrow">Configuration</span>
          <h1 class="page-title">Provider Settings</h1>
          <p class="page-subtitle">
            Configure API keys for local routing. Keys stay in your browser and are never sent to a backend.
          </p>
        </header>

        <div class="settings-stack">
          <section class="settings-card">
            <div class="settings-card-head">
              <div>
                <h2>Routing Modes</h2>
                <p>Choose how Switchboard selects providers and returns responses.</p>
              </div>
            </div>

            <div class="settings-toggle-grid">
              <div class="toggle-row">
                <div class="toggle-copy">
                  <strong>Pool Mode</strong>
                  <p>Race all eligible providers in parallel and take the first successful response.</p>
                </div>
                <label class="switch">
                  <input type="checkbox" id="pool-toggle" ${state.poolMode ? 'checked' : ''} />
                  <span class="switch-track"></span>
                </label>
              </div>

              <div class="toggle-row">
                <div class="toggle-copy">
                  <strong>Streaming</strong>
                  <p>Show partial response chunks when a provider supports streaming output.</p>
                </div>
                <label class="switch">
                  <input type="checkbox" id="stream-toggle" ${state.streaming ? 'checked' : ''} />
                  <span class="switch-track"></span>
                </label>
              </div>
            </div>
          </section>

          <section class="settings-card">
            <div class="settings-card-head">
              <div>
                <h2>Providers</h2>
                <p>Drag rows to change sequential fallback order.</p>
              </div>
            </div>

            <div class="providers-list" id="providers-list">
              ${renderProviderRows(providers)}
            </div>
          </section>

          <section class="settings-card">
            <div class="settings-card-head">
              <div>
                <h2>Custom Providers</h2>
                <p>Add any OpenAI-compatible endpoint for local routing.</p>
              </div>
            </div>

            <div id="custom-providers-section" class="custom-providers-section">
              ${renderCustomProviders()}
            </div>

            <button id="add-custom-provider-btn" class="btn-secondary" type="button">
              Add Custom Provider
            </button>
          </section>

          <section id="custom-provider-form" class="settings-card hidden">
            <button id="close-provider-form" class="btn-back" type="button">
              ${arrowLeftIcon()}
              <span>Back</span>
            </button>

            <div class="settings-card-head">
              <div>
                <h2>New Custom Provider</h2>
                <p>Connect a self-hosted or third-party OpenAI-compatible endpoint.</p>
              </div>
            </div>

            <form id="provider-form" class="provider-form">
              <div class="form-grid">
                <label class="form-group">
                  <span>Provider Name</span>
                  <input type="text" id="provider-name" placeholder="My Local Model" required />
                </label>

                <label class="form-group">
                  <span>Model Name</span>
                  <input type="text" id="provider-model" placeholder="mistral-7b" required />
                </label>

                <label class="form-group form-group--full">
                  <span>Base URL</span>
                  <input type="url" id="provider-base-url" placeholder="https://api.example.com" required />
                  <small>Must expose a compatible <code>/chat/completions</code> endpoint.</small>
                </label>

                <label class="form-group form-group--full">
                  <span>API Key</span>
                  <div class="input-with-eye">
                    <input type="password" id="provider-api-key" placeholder="sk-..." required />
                    <button class="eye-toggle" type="button" data-target="provider-api-key" aria-label="Toggle API key visibility">
                      ${eyeIcon()}
                    </button>
                  </div>
                </label>

                <label class="form-group">
                  <span>Daily Limit</span>
                  <input type="number" id="provider-daily-limit" value="100" min="1" />
                </label>
              </div>

              <div class="form-actions">
                <button type="button" id="cancel-provider-form" class="btn-secondary">Cancel</button>
                <button type="submit" class="btn-primary">Save Provider</button>
              </div>
            </form>
          </section>

          <div class="settings-actions">
            <button id="save-settings-btn" class="btn-primary" type="button">Save Configuration</button>
          </div>
        </div>
      </div>
    </div>
  `
}

export function attachSettingsHandlers() {
  const poolToggle = document.getElementById('pool-toggle')
  const streamToggle = document.getElementById('stream-toggle')
  const addCustomBtn = document.getElementById('add-custom-provider-btn')
  const closeFormBtn = document.getElementById('close-provider-form')
  const cancelFormBtn = document.getElementById('cancel-provider-form')
  const providerForm = document.getElementById('provider-form')
  const saveSettingsBtn = document.getElementById('save-settings-btn')

  if (poolToggle) {
    poolToggle.addEventListener('change', event => {
      state.poolMode = event.target.checked
      persist()
    })
  }

  if (streamToggle) {
    streamToggle.addEventListener('change', event => {
      state.streaming = event.target.checked
      persist()
    })
  }

  if (addCustomBtn) {
    addCustomBtn.addEventListener('click', () => {
      document.getElementById('custom-provider-form')?.classList.remove('hidden')
    })
  }

  if (closeFormBtn) {
    closeFormBtn.addEventListener('click', () => {
      document.getElementById('custom-provider-form')?.classList.add('hidden')
    })
  }

  if (cancelFormBtn) {
    cancelFormBtn.addEventListener('click', () => {
      document.getElementById('custom-provider-form')?.classList.add('hidden')
    })
  }

  if (providerForm) {
    providerForm.addEventListener('submit', handleAddProvider)
  }

  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', () => {
      persist()
      const originalLabel = saveSettingsBtn.textContent
      saveSettingsBtn.textContent = 'Saved'
      saveSettingsBtn.disabled = true

      setTimeout(() => {
        saveSettingsBtn.textContent = originalLabel
        saveSettingsBtn.disabled = false
      }, 1400)
    })
  }

  const eyeToggles = document.querySelectorAll('.eye-toggle')
  eyeToggles.forEach(button => {
    button.addEventListener('click', event => {
      event.preventDefault()
      const inputId = button.dataset.target
      const input = document.getElementById(inputId)
      if (!input) return

      const nextType = input.type === 'password' ? 'text' : 'password'
      input.type = nextType
      button.classList.toggle('is-visible', nextType === 'text')
    })
  })

  const apiKeyInputs = document.querySelectorAll('.api-key-input')
  apiKeyInputs.forEach(input => {
    input.addEventListener('input', event => {
      const providerId = input.dataset.providerId
      state.apiKeys[providerId] = event.target.value
      const providerRow = input.closest('.provider-row')
      providerRow?.classList.remove('provider-row--error')
      persist()
    })
  })

  const testButtons = document.querySelectorAll('.test-api-btn')
  testButtons.forEach(button => {
    button.addEventListener('click', () => {
      testProvider(button)
    })
  })

  const deleteButtons = document.querySelectorAll('.delete-provider-btn')
  deleteButtons.forEach(button => {
    button.addEventListener('click', () => {
      const id = button.dataset.customId
      if (confirm('Delete this custom provider?')) {
        state.customProviders = state.customProviders.filter(provider => provider.id !== id)
        delete state.apiKeys[id]
        persist()
        window.app?.renderApp?.()
      }
    })
  })

  const providersList = document.getElementById('providers-list')
  if (providersList) {
    const rows = providersList.querySelectorAll('.provider-row[draggable="true"]')
    rows.forEach(row => {
      row.addEventListener('dragstart', event => {
        row.classList.add('provider-row--dragging')
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', row.dataset.providerId)
      })

      row.addEventListener('dragend', () => {
        row.classList.remove('provider-row--dragging')
      })

      row.addEventListener('dragover', event => {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        row.classList.add('drag-over')
      })

      row.addEventListener('dragleave', () => {
        row.classList.remove('drag-over')
      })

      row.addEventListener('drop', event => {
        event.preventDefault()
        row.classList.remove('drag-over')

        const fromId = event.dataTransfer.getData('text/plain')
        const toId = row.dataset.providerId

        if (fromId !== toId) {
          reorderProviders(fromId, toId)
        }
      })
    })
  }
}

function renderProviderRows(allProviders) {
  const order = getProviderOrder()

  return order.map(id => {
    const provider = allProviders[id]
    if (!provider) return ''

    const apiKey = state.apiKeys[id] || ''
    const isCustom = provider.isCustom

    return `
      <div class="provider-row ${apiKey ? 'provider-row--configured' : ''}" data-provider-id="${id}" ${isCustom ? '' : 'draggable="true"'}>
        <div class="row-left">
          <span class="drag-handle" title="${isCustom ? 'Custom providers stay pinned to the end' : 'Drag to reorder'}">
            ${dragIcon()}
          </span>

          <span class="provider-avatar" style="background-color: ${provider.avatarColor}">
            ${provider.initials}
          </span>

          <span class="provider-info">
            <span class="provider-name-row">
              <strong class="provider-name">${escapeHtml(provider.name)}</strong>
              <span class="provider-status ${apiKey ? 'provider-status--configured' : 'provider-status--idle'}"></span>
              ${isCustom ? '<span class="inline-badge">Custom</span>' : ''}
            </span>
            <span class="provider-model">${escapeHtml(provider.model)}</span>
          </span>
        </div>

        <div class="row-center">
          <div class="input-with-eye">
            <input
              type="password"
              id="api-key-${id}"
              class="api-key-input"
              data-provider-id="${id}"
              value="${escapeAttribute(apiKey)}"
              placeholder="Enter API key"
            />
            <button class="eye-toggle" type="button" data-target="api-key-${id}" aria-label="Toggle API key visibility">
              ${eyeIcon()}
            </button>
          </div>
        </div>

        <div class="row-right">
          <button class="test-api-btn btn-secondary" type="button" data-provider-id="${id}">Test</button>
          ${isCustom ? `<button class="delete-provider-btn btn-icon btn-icon--subtle" type="button" data-custom-id="${id}" title="Remove provider">${trashIcon()}</button>` : ''}
        </div>
      </div>
    `
  }).join('')
}

function renderCustomProviders() {
  if (!state.customProviders?.length) {
    return `
      <div class="empty-panel">
        <strong>No custom providers yet</strong>
        <span>Add an OpenAI-compatible endpoint to expand the router.</span>
      </div>
    `
  }

  return state.customProviders.map(provider => `
    <div class="custom-provider-item">
      <div class="custom-provider-copy">
        <strong>${escapeHtml(provider.name)}</strong>
        <span>${escapeHtml(provider.baseUrl)}</span>
      </div>
      <button class="delete-provider-btn btn-secondary" type="button" data-custom-id="${provider.id}">
        Remove
      </button>
    </div>
  `).join('')
}

function handleAddProvider(event) {
  event.preventDefault()

  const name = document.getElementById('provider-name')?.value?.trim()
  const baseUrl = document.getElementById('provider-base-url')?.value?.trim()
  const model = document.getElementById('provider-model')?.value?.trim()
  const apiKey = document.getElementById('provider-api-key')?.value?.trim()
  const dailyLimit = parseInt(document.getElementById('provider-daily-limit')?.value || '100', 10)

  if (!name || !baseUrl || !model || !apiKey) {
    alert('Please fill in all required fields.')
    return
  }

  const id = `custom_${Date.now()}`

  state.customProviders.push({
    id,
    name,
    baseUrl,
    model,
    apiKey,
    dailyLimit
  })

  state.apiKeys[id] = apiKey
  persist()

  document.getElementById('provider-form')?.reset()
  document.getElementById('custom-provider-form')?.classList.add('hidden')
  window.app?.renderApp?.()
}

async function testProvider(button) {
  const providerId = button.dataset.providerId
  const apiKey = state.apiKeys[providerId]

  if (!apiKey) {
    alert('No API key configured for this provider.')
    return
  }

  button.disabled = true
  button.textContent = 'Testing...'

  const row = button.closest('.provider-row')
  row?.classList.remove('provider-row--error')

  try {
    const provider = getAllProviders()[providerId]
    let url = provider?.healthEndpoint

    if (!url) {
      button.textContent = 'No check'
      return
    }

    if (providerId === 'gemini') {
      url = url.replace('{apiKey}', apiKey)
    }

    const response = await fetch(url, {
      headers: providerId === 'gemini' ? {} : { Authorization: `Bearer ${apiKey}` }
    })

    if (response.ok) {
      button.textContent = 'Connected'
      button.classList.add('is-success')
    } else {
      row?.classList.add('provider-row--error')
      button.textContent = 'Failed'
      button.classList.add('is-error')
    }
  } catch (error) {
    row?.classList.add('provider-row--error')
    button.textContent = 'Failed'
    button.classList.add('is-error')
  } finally {
    setTimeout(() => {
      button.textContent = 'Test'
      button.disabled = false
      button.classList.remove('is-success', 'is-error')
    }, 1600)
  }
}

function reorderProviders(fromId, toId) {
  const currentOrder = state.providerOrder.length > 0
    ? state.providerOrder
    : Object.keys(PROVIDERS)

  const fromIndex = currentOrder.indexOf(fromId)
  const toIndex = currentOrder.indexOf(toId)

  if (fromIndex >= 0 && toIndex >= 0) {
    const nextOrder = [...currentOrder]
    nextOrder.splice(fromIndex, 1)
    nextOrder.splice(toIndex, 0, fromId)
    state.providerOrder = nextOrder
    persist()
    clearHealthCache()
    window.app?.renderApp?.()
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

function escapeAttribute(text) {
  return escapeHtml(text).replace(/`/g, '&#096;')
}

function arrowLeftIcon() {
  return `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
      <path d="m15 18-6-6 6-6"></path>
    </svg>
  `
}

function eyeIcon() {
  return `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"></path>
      <circle cx="12" cy="12" r="3"></circle>
    </svg>
  `
}

function dragIcon() {
  return `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
      <circle cx="9" cy="7" r="1"></circle>
      <circle cx="15" cy="7" r="1"></circle>
      <circle cx="9" cy="12" r="1"></circle>
      <circle cx="15" cy="12" r="1"></circle>
      <circle cx="9" cy="17" r="1"></circle>
      <circle cx="15" cy="17" r="1"></circle>
    </svg>
  `
}

function trashIcon() {
  return `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
      <path d="M4 7h16"></path>
      <path d="M10 11v6"></path>
      <path d="M14 11v6"></path>
      <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"></path>
      <path d="M9 7V4h6v3"></path>
    </svg>
  `
}
