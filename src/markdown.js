// Renders markdown with highlighted code blocks
// Dependencies: marked.js and highlight.js loaded via CDN in index.html

export function renderMarkdown(text) {
  if (!window.marked) {
    return escapeHtml(text)
  }

  // Configure marked
  const renderer = new window.marked.Renderer()

  renderer.code = ({ text, lang, escaped }) => {
    const highlighted = lang && window.hljs
      ? window.hljs.highlight(text, { language: lang, ignoreIllegals: true }).value
      : escapeHtml(text)

    const id = 'code-' + Math.random().toString(36).slice(2, 9)
    return `
      <pre class="hljs" data-code-id="${id}">
        <code class="language-${lang || 'text'}">${highlighted}</code>
        <button class="code-copy-btn" data-code-id="${id}" title="Copy code">
          <span class="copy-text">Copy</span>
        </button>
      </pre>
    `
  }

  renderer.codespan = ({ text }) => {
    return `<code class="inline-code">${escapeHtml(text)}</code>`
  }

  renderer.link = ({ href, title, text }) => {
    return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener" title="${title || ''}">${escapeHtml(text)}</a>`
  }

  renderer.blockquote = ({ text }) => {
    return `<blockquote class="markdown-blockquote">${text}</blockquote>`
  }

  let html = ''
  try {
    const raw = window.marked.parse(text, {
      renderer,
      breaks: false,
      gfm: true
    })
    html = window.DOMPurify
      ? window.DOMPurify.sanitize(raw)
      : raw
  } catch (e) {
    console.error('Markdown parsing failed:', e)
    html = '<p class="error">' + escapeHtml(text) + '</p>'
  }

  return html
}

export function attachCopyHandlers(container) {
  if (!container) return

  const buttons = container.querySelectorAll('.code-copy-btn')
  buttons.forEach(btn => {
    btn.removeEventListener('click', handleCodeCopy)
    btn.addEventListener('click', handleCodeCopy)
  })
}

function handleCodeCopy(evt) {
  const btn = evt.currentTarget
  const id = btn.dataset.codeId
  const pre = btn.closest('pre')
  if (!pre) return

  const code = pre.querySelector('code')
  const text = code ? code.innerText : ''

  navigator.clipboard.writeText(text).then(() => {
    const original = btn.innerHTML
    btn.classList.add('copied')
    btn.querySelector('.copy-text').textContent = 'Copied!'

    setTimeout(() => {
      btn.classList.remove('copied')
      btn.innerHTML = original
    }, 2000)
  }).catch(e => {
    console.error('Copy failed:', e)
  })
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }
  return text.replace(/[&<>"']/g, c => map[c])
}

export { escapeHtml }
