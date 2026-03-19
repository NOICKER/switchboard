import { state, persist } from '../state.js'

export function renderPromptsView() {
  const prompts = state.systemPrompts || []
  const activePrompt = state.activePromptId
  const editingId = state.currentEditingPromptId
    || state.activePromptId
  const selectedPrompt = prompts.find(
    prompt => prompt.id === editingId
  )

  return `
    <div class="view" id="view-prompts">
      <div class="prompts-layout">
        <aside class="prompts-sidebar">
          <div class="prompts-sidebar-header">
            <div>
              <h2>System Prompts</h2>
              <p>Reusable context for every routed request.</p>
            </div>
          </div>

          <div class="prompts-list" id="prompts-list">
            ${renderPromptsList(prompts, activePrompt)}
          </div>

          <div class="prompts-sidebar-footer">
            <button id="new-prompt-btn" class="btn-secondary prompts-new-btn" type="button">
              ${plusIcon()}
              <span>New Prompt</span>
            </button>
          </div>
        </aside>

        <section class="prompts-editor">
          ${selectedPrompt
            ? renderPromptEditor(
              selectedPrompt,
              state.activePromptId
            )
            : renderNoPromptSelected()}
        </section>
      </div>
    </div>
  `
}

export function attachPromptsHandlers() {
  const newButton = document.getElementById('new-prompt-btn')
  if (newButton) {
    newButton.addEventListener('click', handleNewPrompt)
  }

  const promptItems = document.querySelectorAll('.prompt-item')
  promptItems.forEach(item => {
    item.addEventListener('click', event => {
      if (event.target.closest('button')) return

      const id = item.dataset.promptId
      state.currentEditingPromptId = id
      reRenderPrompts()
    })
  })

  const deleteButtons = document.querySelectorAll('.delete-prompt-btn')
  deleteButtons.forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation()
      const id = button.dataset.promptId
      if (confirm('Delete this prompt?')) {
        state.systemPrompts = state.systemPrompts.filter(prompt => prompt.id !== id)
        if (state.activePromptId === id) {
          state.activePromptId = state.systemPrompts[0]?.id || null
        }
        if (state.currentEditingPromptId === id) {
          state.currentEditingPromptId = state.activePromptId || state.systemPrompts[0]?.id || null
        }
        persist()
        reRenderPrompts()
      }
    })
  })

  const editor = document.getElementById('prompt-editor')
  if (!editor) return

  const nameInput = editor.querySelector('.prompt-name')
  const contentInput = editor.querySelector('.prompt-content')
  const setActiveBtn = editor.querySelector('.set-active-btn')
  const saveBtn = editor.querySelector('.save-prompt-btn')

  if (nameInput) {
    let nameDebounce
    nameInput.addEventListener('input', event => {
      const promptId = state.currentEditingPromptId || state.activePromptId
      const prompt = state.systemPrompts.find(item => item.id === promptId)
      if (prompt) {
        prompt.name = event.target.value
        clearTimeout(nameDebounce)
        nameDebounce = setTimeout(() => persist(), 400)
      }
    })
  }

  if (contentInput) {
    contentInput.addEventListener('input', event => {
      const promptId = state.currentEditingPromptId || state.activePromptId
      const prompt = state.systemPrompts.find(item => item.id === promptId)
      if (prompt) {
        prompt.content = event.target.value
        updateTokenCount()
      }
    })

    contentInput.addEventListener('change', () => {
      persist()
    })
  }

  if (setActiveBtn) {
    setActiveBtn.addEventListener('click', event => {
      event.preventDefault()
      const editingId = state.currentEditingPromptId || state.activePromptId
      if (!editingId) return

      state.activePromptId = editingId
      state.currentEditingPromptId = editingId
      persist()
      reRenderPrompts()
    })
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', event => {
      event.preventDefault()
      persist()
      flashButtonLabel(saveBtn, 'Saved')
    })
  }
}

function renderPromptsList(prompts, activePromptId) {
  return prompts.map(prompt => `
    <div class="prompt-item ${prompt.id === activePromptId ? 'active' : ''}" data-prompt-id="${prompt.id}">
      <div class="prompt-item-content">
        <span class="active-indicator" aria-hidden="true"></span>
        <span class="prompt-item-copy">
          <strong class="prompt-item-name">${escapeHtml(prompt.name)}</strong>
          <small>${Math.ceil((prompt.content || '').length / 4)} tokens</small>
        </span>
      </div>

      <button
        class="delete-prompt-btn btn-icon btn-icon--subtle"
        data-prompt-id="${prompt.id}"
        title="Delete prompt"
        type="button"
      >
        ${trashIcon()}
      </button>
    </div>
  `).join('')
}

function renderPromptEditor(prompt, activePromptId) {
  const isActive = prompt.id === activePromptId

  return `
    <div id="prompt-editor" class="prompt-editor">
      <header class="editor-topbar">
        <div class="editor-heading">
          <input
            type="text"
            class="prompt-name"
            value="${escapeAttribute(prompt.name)}"
            placeholder="Prompt name"
          />
          ${isActive
            ? '<span class="editor-badge">Active context</span>'
            : ''}
        </div>

        <div class="editor-actions">
          <button class="set-active-btn btn-secondary" type="button" ${isActive ? 'disabled' : ''}>
            ${isActive ? 'Active' : 'Set Active'}
          </button>
          <button class="save-prompt-btn btn-primary" type="button">Save</button>
        </div>
      </header>

      <textarea
        class="prompt-content"
        placeholder="Enter system prompt instructions here..."
        spellcheck="false"
      >${escapeHtml(prompt.content)}</textarea>

      <footer class="editor-footer">
        <small class="token-count" id="prompt-token-count">Approx. ${Math.ceil((prompt.content || '').length / 4)} tokens</small>
      </footer>
    </div>
  `
}

function renderNoPromptSelected() {
  return `
    <div class="no-prompt-selected">
      <div class="empty-panel">
        <strong>No prompt selected</strong>
        <span>Create a new prompt or select one from the list to start editing.</span>
      </div>
    </div>
  `
}

function handleNewPrompt() {
  const id = `prompt_${Date.now()}`
  const prompt = {
    id,
    name: 'New Prompt',
    content: '',
    isDefault: false
  }

  state.systemPrompts.push(prompt)
  state.currentEditingPromptId = id
  persist()
  reRenderPrompts()
}

function updateTokenCount() {
  const content = document.querySelector('.prompt-content')?.value || ''
  const tokenCount = Math.ceil(content.length / 4)
  const tokenLabel = document.getElementById('prompt-token-count')

  if (tokenLabel) {
    tokenLabel.textContent = `Approx. ${tokenCount} tokens`
  }
}

function reRenderPrompts() {
  const view = document.getElementById('view-prompts')
  if (!view) return

  const wrapper = document.createElement('div')
  wrapper.innerHTML = renderPromptsView()
  view.replaceWith(...wrapper.childNodes)
  attachPromptsHandlers()
}

function flashButtonLabel(button, label) {
  const original = button.textContent
  button.textContent = label
  button.disabled = true

  setTimeout(() => {
    button.textContent = original
    button.disabled = false
  }, 1200)
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

function plusIcon() {
  return `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
      <path d="M12 5v14"></path>
      <path d="M5 12h14"></path>
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
