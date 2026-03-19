import { state } from '../state.js'
import { PROVIDERS } from '../providers.js'

export function renderUsageView() {
  const logs = state.logs || []
  const stats = calculateStats(logs)
  const providerBreakdown = calculateProviderBreakdown(logs)

  return `
    <div class="view" id="view-usage">
      <div class="usage-page page-shell">
        <header class="page-header page-header--stacked">
          <span class="page-eyebrow">Analytics</span>
          <h1 class="page-title">Usage</h1>
          <p class="page-subtitle">
            Daily request volume, provider performance, and latency trends based on local telemetry.
          </p>
        </header>

        <div class="stat-cards-grid">
          <article class="stat-card">
            <span class="stat-label">Total Requests</span>
            <strong class="stat-value">${formatNumber(stats.totalRequests)}</strong>
            <span class="stat-note">All routed attempts</span>
          </article>

          <article class="stat-card">
            <span class="stat-label">Total Tokens</span>
            <strong class="stat-value">${formatNumber(stats.totalTokens)}</strong>
            <span class="stat-note">Assistant responses only</span>
          </article>

          <article class="stat-card">
            <span class="stat-label">Average Latency</span>
            <strong class="stat-value">${stats.avgLatency}ms</strong>
            <span class="stat-note">Across every logged request</span>
          </article>

          <article class="stat-card">
            <span class="stat-label">Success Rate</span>
            <strong class="stat-value">${stats.successRate}%</strong>
            <span class="stat-note">Requests with an OK result</span>
          </article>

          <article class="stat-card">
            <span class="stat-label">Fastest Provider</span>
            <strong class="stat-value">${escapeHtml(stats.fastestProvider)}</strong>
            <span class="stat-note">Lowest observed latency</span>
          </article>

          <article class="stat-card">
            <span class="stat-label">Most Used</span>
            <strong class="stat-value">${escapeHtml(stats.mostUsed)}</strong>
            <span class="stat-note">Highest request share</span>
          </article>
        </div>

        <div class="usage-grid">
          <section class="chart-container">
            <div class="chart-header">
              <h2>Provider Usage</h2>
              <p>Request volume by provider.</p>
            </div>
            <div class="chart-content">
              ${renderProviderChart(providerBreakdown)}
            </div>
          </section>

          <section class="chart-container">
            <div class="chart-header">
              <h2>Latency Comparison</h2>
              <p>Average response time for each provider.</p>
            </div>
            <div class="chart-content">
              ${renderLatencyChart(providerBreakdown)}
            </div>
          </section>
        </div>

        <section class="chart-container chart-container--wide">
          <div class="chart-header">
            <h2>Requests Over Time</h2>
            <p>Hourly distribution based on recorded request timestamps.</p>
          </div>
          <div class="chart-content">
            ${renderTimeSeries(logs)}
          </div>
        </section>
      </div>
    </div>
  `
}

export function attachUsageHandlers() {
  // Static analytics view.
}

function calculateStats(logs) {
  if (!logs.length) {
    return {
      totalRequests: 0,
      totalTokens: 0,
      avgLatency: 0,
      successRate: 0,
      fastestProvider: 'N/A',
      mostUsed: 'N/A'
    }
  }

  const successful = logs.filter(log => log.status === 'ok')
  const avgLatency = Math.round(logs.reduce((sum, log) => sum + (log.latency || 0), 0) / logs.length)
  const totalTokens = logs.reduce((sum, log) => sum + (log.tokens || 0), 0)
  const successRate = Math.round((successful.length / logs.length) * 100)

  let fastestProvider = 'N/A'
  let fastestLatency = Infinity

  logs.forEach(log => {
    if (typeof log.latency === 'number' && log.latency < fastestLatency) {
      fastestLatency = log.latency
      fastestProvider = PROVIDERS[log.providerId]?.name || log.providerId || 'Unknown'
    }
  })

  const counts = {}
  logs.forEach(log => {
    const id = log.providerId || 'unknown'
    counts[id] = (counts[id] || 0) + 1
  })

  const mostUsedId = Object.entries(counts).sort((left, right) => right[1] - left[1])[0]?.[0]

  return {
    totalRequests: logs.length,
    totalTokens,
    avgLatency,
    successRate,
    fastestProvider,
    mostUsed: PROVIDERS[mostUsedId]?.name || mostUsedId || 'N/A'
  }
}

function calculateProviderBreakdown(logs) {
  const breakdown = {}

  logs.forEach(log => {
    const id = log.providerId || 'unknown'

    if (!breakdown[id]) {
      breakdown[id] = {
        requests: 0,
        tokens: 0,
        latencies: [],
        errors: 0,
        successful: 0
      }
    }

    breakdown[id].requests += 1
    breakdown[id].tokens += log.tokens || 0
    breakdown[id].latencies.push(log.latency || 0)

    if (log.status === 'ok') {
      breakdown[id].successful += 1
    } else if (log.status === 'error') {
      breakdown[id].errors += 1
    }
  })

  return breakdown
}

function renderProviderChart(breakdown) {
  const entries = Object.entries(breakdown).sort((left, right) => right[1].requests - left[1].requests)

  if (!entries.length) {
    return renderNoData('No usage data yet')
  }

  const maxRequests = Math.max(...entries.map(([, data]) => data.requests))

  return `
    <div class="bar-chart">
      ${entries.map(([id, data]) => {
        const provider = PROVIDERS[id]
        const width = Math.max((data.requests / (maxRequests || 1)) * 100, 8)
        return `
          <div class="bar-row">
            <div class="bar-label">
              <span class="bar-label__name">${escapeHtml(provider?.name || id)}</span>
              <small>${formatNumber(data.requests)} requests</small>
            </div>
            <div class="bar-container">
              <div class="bar" style="width: ${width}%; background: ${provider?.avatarColor || '#64748b'}">
                <span class="bar-value">${formatNumber(data.requests)}</span>
              </div>
            </div>
          </div>
        `
      }).join('')}
    </div>
  `
}

function renderLatencyChart(breakdown) {
  const entries = Object.entries(breakdown)
    .map(([id, data]) => ({
      id,
      avgLatency: data.latencies.length
        ? Math.round(data.latencies.reduce((sum, value) => sum + value, 0) / data.latencies.length)
        : 0,
      name: PROVIDERS[id]?.name || id,
      color: PROVIDERS[id]?.avatarColor || '#64748b'
    }))
    .sort((left, right) => left.avgLatency - right.avgLatency)

  if (!entries.length) {
    return renderNoData('No latency data yet')
  }

  const maxLatency = Math.max(...entries.map(entry => entry.avgLatency))

  return `
    <div class="bar-chart">
      ${entries.map(entry => `
        <div class="bar-row">
          <div class="bar-label">
            <span class="bar-label__name">${escapeHtml(entry.name)}</span>
            <small>${entry.avgLatency}ms average</small>
          </div>
          <div class="bar-container">
            <div class="bar bar--latency" style="width: ${Math.max((entry.avgLatency / (maxLatency || 1)) * 100, 8)}%; background: ${entry.color}">
              <span class="bar-value">${entry.avgLatency}ms</span>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `
}

function renderTimeSeries(logs) {
  if (!logs.length) {
    return renderNoData('No request history yet')
  }

  const hourly = {}
  logs.forEach(log => {
    const timestamp = log.timestamp || log.time
    const hour = new Date(timestamp).getHours()
    hourly[hour] = (hourly[hour] || 0) + 1
  })

  const hours = Array.from({ length: 24 }, (_, index) => index)
  const values = hours.map(hour => hourly[hour] || 0)
  const maxValue = Math.max(...values)

  return `
    <div class="time-series">
      <div class="series-bars">
        ${hours.map((hour, index) => `
          <div class="series-bar" title="${hour}:00 - ${hourly[hour] || 0} requests">
            <div
              class="series-value"
              style="height: ${values[index] > 0 ? Math.max((values[index] / (maxValue || 1)) * 100, 8) : 4}%"
            ></div>
            <div class="series-label">${hour}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `
}

function renderNoData(label) {
  return `
    <div class="empty-panel empty-panel--chart">
      <strong>${escapeHtml(label)}</strong>
      <span>Route a few requests to populate this chart.</span>
    </div>
  `
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
