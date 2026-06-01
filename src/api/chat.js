/**
 * Chat API | 对话 API
 */

import { apiRequest, fetchWithApiAuth, getApiBaseUrl } from './_httpClient.js'

// 对话补全
export const chatCompletions = (data) =>
  apiRequest({
    url: `/chat/completions`,
    method: 'post',
    data
  })

// 流式对话补全
export const extractChatStreamDelta = (payload = {}) => {
  const candidates = [
    payload?.choices?.[0]?.delta?.content,
    payload?.choices?.[0]?.message?.content,
    payload?.choices?.[0]?.text,
    payload?.delta?.content,
    payload?.text
  ]
  const found = candidates.find((value) => typeof value === 'string' && value.length > 0)
  return found || ''
}

export const parseChatStreamEvent = (rawEvent = '') => {
  const data = String(rawEvent || '')
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n')
    .trim()

  if (!data || data === '[DONE]') return []

  let payload
  try {
    payload = JSON.parse(data)
  } catch {
    throw new Error('Invalid chat stream event')
  }

  const errorMessage = payload?.error?.message || payload?.message
  if (errorMessage) {
    throw new Error(String(errorMessage))
  }

  const delta = extractChatStreamDelta(payload)
  return delta ? [delta] : []
}

export async function* readChatCompletionStream(response) {
  const reader = response?.body?.getReader?.()
  if (!reader) {
    throw new Error('Chat stream response is not readable')
  }

  const decoder = new TextDecoder()
  let buffer = ''

  const flushEvents = function* () {
    let match = buffer.match(/\r?\n\r?\n/)
    while (match?.index !== undefined) {
      const event = buffer.slice(0, match.index)
      buffer = buffer.slice(match.index + match[0].length)
      yield* parseChatStreamEvent(event)
      match = buffer.match(/\r?\n\r?\n/)
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    yield* flushEvents()
  }

  buffer += decoder.decode()
  if (buffer.trim()) {
    yield* parseChatStreamEvent(buffer)
  }
}

export const streamChatCompletions = async function* (data, signal) {
  const baseUrl = getApiBaseUrl()

  const response = await fetchWithApiAuth(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ ...data, stream: true }),
    signal
  })

  if (!response.ok) {
    let message = 'Stream request failed'
    try {
      const error = await response.json()
      message = error?.error?.message || error?.message || message
    } catch {
      const text = await response.text()
      if (text?.trim()) message = text.trim()
    }
    throw new Error(message)
  }

  for await (const chunk of readChatCompletionStream(response)) {
    yield chunk
  }
}
