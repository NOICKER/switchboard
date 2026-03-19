export function showModal(options = {}) {
  const {
    title = 'Modal',
    content = '',
    buttons = [],
    onClose = null,
    width = '500px'
  } = options

  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'

  const card = document.createElement('div')
  card.className = 'modal-card'
  card.style.width = width

  const header = document.createElement('div')
  header.className = 'modal-header'

  const titleEl = document.createElement('h2')
  titleEl.textContent = title

  const closeBtn = document.createElement('button')
  closeBtn.className = 'btn-icon close-modal'
  closeBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  `

  header.appendChild(titleEl)
  header.appendChild(closeBtn)

  const body = document.createElement('div')
  body.className = 'modal-body'
  if (typeof content === 'string') {
    body.innerHTML = content
  } else {
    body.appendChild(content)
  }

  const footer = document.createElement('div')
  footer.className = 'modal-footer'

  buttons.forEach(btn => {
    const button = document.createElement('button')
    button.className = `btn-${btn.type || 'secondary'}`
    button.textContent = btn.text
    button.addEventListener('click', () => {
      if (btn.onClick) btn.onClick()
      overlay.remove()
      if (onClose) onClose()
    })
    footer.appendChild(button)
  })

  if (!buttons.length) {
    const closeButton = document.createElement('button')
    closeButton.className = 'btn-primary'
    closeButton.textContent = 'Close'
    closeButton.addEventListener('click', () => {
      overlay.remove()
      if (onClose) onClose()
    })
    footer.appendChild(closeButton)
  }

  card.appendChild(header)
  card.appendChild(body)
  card.appendChild(footer)
  overlay.appendChild(card)

  // Close handlers
  const closeButtons = overlay.querySelectorAll('.close-modal')
  closeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      overlay.remove()
      if (onClose) onClose()
    })
  })

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove()
      if (onClose) onClose()
    }
  })

  document.body.appendChild(overlay)

  return overlay
}

export function showConfirmDialog(message, onConfirm, onCancel) {
  return showModal({
    title: 'Confirm',
    content: message,
    buttons: [
      {
        text: 'Cancel',
        type: 'secondary',
        onClick: () => onCancel?.()
      },
      {
        text: 'Confirm',
        type: 'primary',
        onClick: () => onConfirm?.()
      }
    ]
  })
}

export function showAlertDialog(message) {
  return new Promise(resolve => {
    showModal({
      title: 'Alert',
      content: message,
      buttons: [
        {
          text: 'OK',
          type: 'primary',
          onClick: () => resolve()
        }
      ]
    })
  })
}
