import { state, persist } from '../state.js'
import { PROVIDERS } from '../providers.js'

export function renderLogsView() {
  const logs = state.logs || []
  const filter = state.logFilter || 'all'
  const summary = getLogSummary(logs)
  const providerFilters = getProviderFilters(logs)

  return `
    <div class="view" id="view-logs">
      <div class="logs-shell">
        <header class="logs-header">
          <div class="logs-header-copy">
            <h1>Logs</h1>
            <p>Real-time request telemetry and token tracking.</p>

            <div class="logs-summary">
              <span class="summary-pill">Requests ${summary.total}</span>
              <span class="summary-pill">Success ${summary.success}</span>
              <span class="summary-pill">Errors ${summary.error}</span>
              <span class="summary-pill">Avg latency ${summary.avgLatency}ms</span>
            </div>
          </div>

          <div class="logs-filters" role="tablist" aria-label="Log filters">
            <button class="filter-pill ${filter === 'all' ? 'active' : ''}" data-filter="all" type="button">All</button>
            ${providerFilters.map(provider => `
              <button class="filter-pill ${filter === provider.id ? 'active' : ''}" data-filter="${provider.id}" type="button">
                ${escapeHtml(provider.label)}
              </button>
            `).join('')}
            <button class="filter-pill ${filter === 'error' ? 'active' : ''}" data-filter="error" type="button">Errors</button>
          </div>
        </header>

        <div class="logs-table-container">
          <table class="logs-table" id="logs-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Provider</th>
                <th>Model</th>
                <th>Status</th>
                <th>Latency</th>
                <th>Tokens</th>
              </tr>
            </thead>
            <tbody id="logs-tbody">
              ${renderLogRows(logs)}
            </tbody>
          </table>
        </div>

        <footer class="logs-footer">
          <div class="logs-footer-status">
            <span class="system-dot" aria-hidden="true"></span>
            <span>Telemetry stored locally</span>
          </div>

          <button id="clear-logs-btn" class="btn-secondary btn-secondary--danger" type="button">
            Clear Logs
          </button>
        </footer>
      </div>
    </div>
  `
}

export function attachLogsHandlers() {
  const filterButtons = document.querySelectorAll('.filter-pill')
  filterButtons.forEach(button => {
    button.addEventListener('click', () => {
      state.logFilter = button.dataset.filter
      filterButtons.forEach(item => item.classList.remove('active'))
      button.classList.add('active')
      filterLogRows(state.logFilter)
    })
  })

  const clearButton = document.getElementById('clear-logs-btn')
  if (clearButton) {
    clearButton.addEventListener('click', () => {
      if (confirm('Clear all logs? This cannot be undone.')) {
        state.logs = []
        persist()
        window.app?.renderApp?.()
      }
    })
  }

  const rows = document.querySelectorAll('.log-row')
  rows.forEach(row => {
    row.addEventListener('click', () => {
      const detailRow = row.nextElementSibling
      const willOpen = !detailRow?.classList.contains('open')

      document.querySelectorAll('.log-row.expanded').forEach(openRow => {
        openRow.classList.remove('expanded')
      })

      document.querySelectorAll('.log-detail-row.open').forEach(openDetail => {
        openDetail.classList.remove('open')
        openDetail.style.display = 'none'
      })

      if (detailRow && willOpen) {
        row.classList.add('expanded')
        detailRow.classList.add('open')
        detailRow.style.display = ''
      }
    })
  })

  filterLogRows(state.logFilter || 'all')
}

function renderLogRows(logs) {
  if (!logs.length) {
    return `
      <tr class="empty-logs-row">
        <td colspan="6">
          <div class="empty-panel">
            <strong>No logs yet</strong>
            <span>Your routed requests will appear here once telemetry is recorded.</span>
          </div>
        </td>
      </tr>
    `
  }

  return logs.map((log, index) => {
    const providerId = log.providerId || 'unknown'
    const providerName = PROVIDERS[providerId]?.name || providerId
    const timestamp = log.timestamp || log.time || new Date().toISOString()
    const status = log.status || 'ok'
    const latency = typeof log.latency === 'number' ? `${log.latency}ms` : '--'
    const tokens = typeof log.tokens === 'number' ? log.tokens : 0
    const model = getModelLabel(log)
    const latencyClass = getLatencyClass(log.latency)
    const detailPayload = getDetailPayload(log)
    const detailResponse = getDetailResponse(log)

    return `
      <tr class="log-row ${status === 'error' ? 'log-row--error' : ''}" data-provider="${providerId}" data-status="${status}" data-log-index="${index}">
        <td class="cell-time">${formatTime(timestamp)}</td>
        <td class="cell-provider">${escapeHtml(providerName)}</td>
        <td class="cell-model"><code>${escapeHtml(model)}</code></td>
        <td class="cell-status">
          <span class="status-badge status-badge--${status}">${escapeHtml(status)}</span>
        </td>
        <td class="cell-latency">
          <span class="latency-pill latency-pill--${latencyClass}">${escapeHtml(latency)}</span>
        </td>
        <td class="cell-tokens">${formatNumber(tokens)}</td>
      </tr>
      <tr class="log-detail-row" data-provider="${providerId}" data-status="${status}">
        <td colspan="6">
          <div class="log-detail-grid">
            <section class="log-detail-card">
              <h3>Request Payload</h3>
              <pre>${escapeHtml(detailPayload)}</pre>
            </section>
            <section class="log-detail-card">
              <h3>Response Details</h3>
              <pre>${escapeHtml(detailResponse)}</pre>
            </section>
          </div>
        </td>
      </tr>
    `
  }).join('')
}

function filterLogRows(filter) {
  const rows = document.querySelectorAll('.log-row')
  const emptyState = document.querySelector('.empty-logs-row')

  if (emptyState) {
    return
  }

  let visibleCount = 0

  rows.forEach(row => {
    const provider = row.dataset.provider
    const status = row.dataset.status
    const detailRow = row.nextElementSibling

    const matches =
      filter === 'all' ||
      (filter === 'error' && status === 'error') ||
      filter === provider

    row.style.display = matches ? '' : 'none'
    if (detailRow) {
      detailRow.style.display = matches && detailRow.classList.contains('open') ? '' : 'none'
      if (!matches) {
        detailRow.classList.remove('open')
        row.classList.remove('expanded')
      }
    }

    if (matches) {
      visibleCount += 1
    }
  })

  let filterEmpty = document.getElementById('logs-filter-empty')
  if (!filterEmpty && visibleCount === 0) {
    filterEmpty = document.createElement('div')
    filterEmpty.id = 'logs-filter-empty'
    filterEmpty.className = 'logs-filter-empty'
    filterEmpty.innerHTML = `
      <strong>No matching logs</strong>
      <span>Try a different filter or route another request.</span>
    `
    document.querySelector('.logs-table-container')?.appendChild(filterEmpty)
  }

  if (filterEmpty) {
    filterEmpty.style.display = visibleCount === 0 ? 'flex' : 'none'
  }
}

function getProviderFilters(logs) {
  const counts = new Map()

  logs.forEach(log => {
    if (!log.providerId) return
    counts.set(log.providerId, (counts.get(log.providerId) || 0) + 1)
  })

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .map(([id]) => ({
      id,
      label: PROVIDERS[id]?.name || id
    }))
}

function getLogSummary(logs) {
  const success = logs.filter(log => log.status === 'ok').length
  const error = logs.filter(log => log.status === 'error').length
  const avgLatency = logs.length
    ? Math.round(logs.reduce((sum, log) => sum + (log.latency || 0), 0) / logs.length)
    : 0

  return {
    total: logs.length,
    success,
    error,
    avgLatency
  }
}

function getModelLabel(log) {
  if (log.model && log.model !== 'via API' && log.model !== 'error') {
    return log.model
  }

  return PROVIDERS[log.providerId]?.model || log.model || 'Unknown'
}

function getLatencyClass(latency) {
  if (typeof latency !== 'number') return 'neutral'
  if (latency < 300) return 'fast'
  if (latency < 1000) return 'moderate'
  return 'slow'
}

function getDetailPayload(log) {
  if (log.payload && Object.keys(log.payload).length) {
    return JSON.stringify(log.payload, null, 2)
  }

  if (log.messages && log.messages.length) {
    return JSON.stringify(log.messages, null, 2)
  }

  return 'Request payload was not captured for this entry.'
}

function getDetailResponse(log) {
  if (log.responseHeaders && Object.keys(log.responseHeaders).length) {
    return JSON.stringify(log.responseHeaders, null, 2)
  }

  if (log.error || log.errorMessage) {
    return log.error || log.errorMessage
  }

  return 'No response metadata captured for this entry.'
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

function formatNumber(value) {
  return new Intl.NumberFormat().format(value || 0)
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
