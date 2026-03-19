import { state, newChat, persist } from '../state.js'
import { showToast } from './toast.js'

export function attachKeyboardShortcuts() {
  document.addEventListener('keydown', handleGlobalKeydown)
}

export function removeKeyboardShortcuts() {
  document.removeEventListener('keydown', handleGlobalKeydown)
}

function handleGlobalKeydown(evt) {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
  const modifier = isMac ? evt.metaKey : evt.ctrlKey

  // Cmd/Ctrl+K: Focus chat input
  if (modifier && evt.key === 'k' && state.currentView === 'chat') {
    evt.preventDefault()
    const input = document.getElementById('chat-input')
    if (input) {
      input.focus()
    }
  }

  // Cmd/Ctrl+Enter: Send message
  if (modifier && evt.key === 'Enter' && state.currentView === 'chat') {
    evt.preventDefault()
    const input = document.getElementById('chat-input')
    if (input && !state.sending) {
      const sendBtn = document.getElementById('send-btn')
      if (sendBtn) {
        sendBtn.click()
      }
    }
  }

  // Cmd/Ctrl+N: New chat
  if (modifier && evt.key === 'n' && state.currentView === 'chat') {
    evt.preventDefault()
    newChat()
    window.app?.renderApp?.()
    showToast('New chat created', 'success')
  }

  // Cmd/Ctrl+Shift+P: Toggle pool mode
  if (modifier && evt.shiftKey && evt.key === 'P') {
    evt.preventDefault()
    state.poolMode = !state.poolMode
    persist()
    showToast(`Pool mode ${state.poolMode ? 'enabled' : 'disabled'}`, 'info')
  }

  // Cmd/Ctrl+Shift+S: Toggle streaming
  if (modifier && evt.shiftKey && evt.key === 'S') {
    evt.preventDefault()
    state.streaming = !state.streaming
    persist()
    showToast(`Streaming ${state.streaming ? 'enabled' : 'disabled'}`, 'info')
  }

  // Cmd/Ctrl+L: Switch to logs
  if (modifier && evt.key === 'l') {
    evt.preventDefault()
    state.currentView = 'logs'
    window.app?.renderApp?.()
  }

  // Cmd/Ctrl+U: Switch to usage
  if (modifier && evt.key === 'u') {
    evt.preventDefault()
    state.currentView = 'usage'
    window.app?.renderApp?.()
  }

  // Cmd/Ctrl+,: Switch to settings
  if (modifier && evt.key === ',') {
    evt.preventDefault()
    state.currentView = 'settings'
    window.app?.renderApp?.()
  }

  // Cmd/Ctrl+/: Show help
  if (modifier && evt.key === '/') {
    evt.preventDefault()
    const helpBtn = document.getElementById('show-help')
    if (helpBtn) {
      helpBtn.click()
    }
  }

  // Escape in any text input: Unfocus
  if (evt.key === 'Escape' && ['INPUT', 'TEXTAREA'].includes(evt.target.tagName)) {
    evt.target.blur()
  }

  // Tab in textarea: Insert 2 spaces instead of focusing next element
  if (evt.key === 'Tab' && evt.target.tagName === 'TEXTAREA') {
    evt.preventDefault()
    const textarea = evt.target
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    textarea.value = textarea.value.substring(0, start) + '  ' + textarea.value.substring(end)
    textarea.selectionStart = textarea.selectionEnd = start + 2
  }
}
