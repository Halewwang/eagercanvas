/**
 * Chat API | 对话 API
 */

import { request, getBaseUrl, fetchWithAuth } from '@/utils'

// 对话补全
export const chatCompletions = (data) =>
  request({
    url: `/chat/completions`,
    method: 'post',
    data
  })

// 流式对话补全
export const streamChatCompletions = async function* (data, signal) {
  const baseUrl = getBaseUrl()
  
  const response = await fetchWithAuth(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    // Backend currently returns JSON. Force non-stream to avoid empty parsed chunks.
    body: JSON.stringify({ ...data, stream: false }),
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

  const extractText = (payload) => {
    if (!payload) return ''
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

  const contentType = String(response.headers.get('content-type') || '').toLowerCase()
  if (contentType.includes('application/json')) {
    const payload = await response.json()
    const text = extractText(payload)

    if (text) yield text
    return
  }

  // Fallback for plain text response body.
  const textBody = await response.text()
  if (textBody && textBody.trim()) {
    yield textBody.trim()
  }
}
