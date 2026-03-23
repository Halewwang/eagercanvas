/**
 * Chat API | 对话 API
 */

import { request } from '@/utils'

// 对话补全
export const chatCompletions = (data) =>
  request({
    url: `/chat/completions`,
    method: 'post',
    data
  })

// 流式对话补全
export const streamChatCompletions = async function* (data, signal) {
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

  const payload = await request({
    url: '/chat/completions',
    method: 'post',
    data: { ...data, stream: false },
    signal,
    silentErrorToast: true
  })

  const text = extractText(payload)
  if (text) {
    yield text
  }
}
