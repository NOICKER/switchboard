export async function streamOpenAI(url, headers, body, onChunk) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 60000)

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    })

    clearTimeout(timeout)

    if (!resp.ok) {
      const err = await resp.text().catch(() => resp.statusText)
      throw new Error(resp.status + ': ' + err.slice(0, 120))
    }

    if (!resp.body) throw new Error('Response body not readable')

    const reader = resp.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let tokens = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.trim() || line.startsWith(':')) continue

        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') continue

          try {
            const json = JSON.parse(data)
            const chunk = json.choices?.[0]?.delta?.content
            if (chunk) {
              onChunk(chunk)
              tokens += Math.ceil(chunk.length / 4)
            }
          } catch (e) {
            console.warn('Failed to parse SSE line:', data)
          }
        }
      }
    }

    return {
      text: '',
      tokens,
      streamed: true,
      headers: {}
    }
  } finally {
    clearTimeout(timeout)
  }
}
