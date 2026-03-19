export function showToast(message, type = 'info', duration = 3000) {
  const container = getToastContainer()

  const toast = document.createElement('div')
  toast.className = `toast toast-${type}`
  toast.setAttribute('role', 'alert')
  toast.textContent = message

  container.appendChild(toast)

  // Trigger animation
  setTimeout(() => toast.classList.add('show'), 10)

  if (duration > 0) {
    setTimeout(() => {
      toast.classList.remove('show')
      setTimeout(() => toast.remove(), 300)
    }, duration)
  }

  return toast
}

export function showSuccessToast(message) {
  return showToast(message, 'success')
}

export function showErrorToast(message) {
  return showToast(message, 'error', 5000)
}

export function showWarningToast(message) {
  return showToast(message, 'warning', 4000)
}

function getToastContainer() {
  let container = document.getElementById('toast-container')

  if (!container) {
    container = document.createElement('div')
    container.id = 'toast-container'
    container.className = 'toast-container'
    document.body.appendChild(container)
  }

  return container
}
