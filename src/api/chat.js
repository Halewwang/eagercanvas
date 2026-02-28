/**
 * Chat API | 对话 API
 */

import { request, getBaseUrl } from '@/utils'
import { DEFAULT_API_KEY, STORAGE_KEYS } from '@/utils/constants'

// 对话补全
export const chatCompletions = (data) =>
  request({
    url: `/chat/completions`,
    method: 'post',
    data
  })

// 流式对话补全
export const streamChatCompletions = async function* (data, signal) {
  const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) || ''
  const apiKey = localStorage.getItem('apiKey') || DEFAULT_API_KEY
  const baseUrl = getBaseUrl()
  
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken || apiKey}`
    },
    credentials: 'include',
    body: JSON.stringify({ ...data, stream: true }),
    signal
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error?.error?.message || error?.message || 'Stream request failed')
  }

  const contentType = String(response.headers.get('content-type') || '').toLowerCase()
  if (contentType.includes('application/json')) {
    const payload = await response.json()
    const text =
      payload?.choices?.[0]?.message?.content ||
      payload?.choices?.[0]?.delta?.content ||
      payload?.choices?.[0]?.text ||
      payload?.data?.choices?.[0]?.message?.content ||
      payload?.data?.choices?.[0]?.text ||
      ''

    if (text) yield text
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data:')) continue

      const data = trimmed.slice(5).trim()
      if (data === '[DONE]') return

      try {
        const parsed = JSON.parse(data)
        const content = parsed.choices?.[0]?.delta?.content
        if (content) yield content
      } catch (e) {
        // Skip invalid JSON
      }
    }
  }
}
