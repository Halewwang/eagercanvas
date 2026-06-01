const extractTextFromContent = (content) => {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  for (const item of content) {
    if (typeof item === 'string' && item.trim()) return item
    if (typeof item?.text === 'string' && item.text.trim()) return item.text
    if (typeof item?.content === 'string' && item.content.trim()) return item.content
  }
  return ''
}

const extractChatStreamDelta = (payload = {}) => {
  const candidates = [
    payload?.choices?.[0]?.delta?.content,
    payload?.choices?.[0]?.message?.content,
    payload?.choices?.[0]?.text,
    payload?.delta?.content,
    payload?.message?.content,
    payload?.content,
    payload?.text
  ]

  for (const value of candidates) {
    const text = extractTextFromContent(value)
    if (text) return text
  }
  return ''
}

const extractFinishReason = (payload = {}) =>
  payload?.choices?.[0]?.finish_reason ||
  payload?.choices?.[0]?.finishReason ||
  payload?.finish_reason ||
  payload?.finishReason ||
  ''

export const extractChatCompletionText = (payload = {}) => {
  if (typeof payload === 'string') return payload

  const candidates = [
    payload?.choices?.[0]?.message?.content,
    payload?.choices?.[0]?.delta?.content,
    payload?.choices?.[0]?.text,
    payload?.data?.choices?.[0]?.message?.content,
    payload?.data?.choices?.[0]?.text,
    payload?.message,
    payload?.result?.message,
    payload?.result?.content,
    payload?.data?.result?.message,
    payload?.data?.result?.content,
    payload?.output_text,
    payload?.data?.output_text,
    payload?.result?.text,
    payload?.data?.result?.text,
    payload?.raw
  ]
  for (const value of candidates) {
    const direct = extractTextFromContent(value)
    if (direct) return direct
  }
  if (Array.isArray(payload?.output)) {
    for (const item of payload.output) {
      const text = extractTextFromContent(item?.content)
      if (text) return text
      if (typeof item?.text === 'string' && item.text.trim()) return item.text
    }
  }
  if (Array.isArray(payload?.data?.output)) {
    for (const item of payload.data.output) {
      const text = extractTextFromContent(item?.content)
      if (text) return text
    }
  }
  return ''
}

export const formatSseData = (payload) => {
  const data = typeof payload === 'string' ? payload : JSON.stringify(payload)
  return `data: ${data}\n\n`
}

export const buildChatCompletionSseEvents = (payload = {}) => {
  const content = extractChatCompletionText(payload)
  const events = []
  if (content) {
    events.push(formatSseData({ choices: [{ delta: { content } }] }))
  }
  events.push(formatSseData('[DONE]'))
  return events
}

export async function * readChatCompletionSseStream(response) {
  if (!response?.body?.getReader) {
    throw new Error('Provider stream response body is not readable')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split(/\r?\n\r?\n/)
    buffer = parts.pop() || ''

    for (const part of parts) {
      const dataLines = part
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.replace(/^data:\s?/, ''))

      if (!dataLines.length) continue
      const raw = dataLines.join('\n').trim()
      if (!raw) continue
      if (raw === '[DONE]') {
        yield { type: 'done', raw, delta: '', payload: null, usage: null, finishReason: '' }
        continue
      }

      let payload
      try {
        payload = JSON.parse(raw)
      } catch {
        payload = { raw }
      }

      if (payload?.error) {
        const message = payload.error?.message || payload.message || 'Provider stream error'
        throw new Error(message)
      }

      yield {
        type: 'data',
        raw,
        payload,
        delta: extractChatStreamDelta(payload),
        usage: payload?.usage || payload?.data?.usage || null,
        finishReason: extractFinishReason(payload)
      }
    }
  }

  const tail = buffer.trim()
  if (tail) {
    const raw = tail.replace(/^data:\s?/, '').trim()
    if (raw === '[DONE]') {
      yield { type: 'done', raw, delta: '', payload: null, usage: null, finishReason: '' }
    }
  }
}
