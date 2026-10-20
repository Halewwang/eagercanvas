import { env } from '../../config/env.js'
import { HttpError } from '../../utils/http.js'
import { normalizeProviderVisibleMessage } from '../../utils/provider-visible-message.js'
import { attachProviderResponseMetadata } from '../provider-response-metadata.js'
import { buildProviderUrl } from './http-client.js'

const TEXT_MODEL = 'gpt-5.6-sol'

const providerError = (data, response, code = 'PROVIDER_ERROR') => {
  const message = normalizeProviderVisibleMessage(
    data?.error?.message || data?.message || data?.incomplete_details?.reason,
    `OpenAI request failed: ${response?.status || 502}`
  )
  return attachProviderResponseMetadata(new HttpError(response?.ok === false ? response.status : 502, message, code), response)
}

const requestOpenAi = async (path, body, requestOptions = {}) => {
  const apiKey = String(requestOptions.openaiApiKey || env.openaiApiKey || '').trim()
  if (!apiKey) throw new HttpError(500, 'OPENAI_API_KEY is not configured', 'OPENAI_NOT_CONFIGURED')

  const controller = new AbortController()
  const abort = () => controller.abort(requestOptions.signal.reason)
  if (requestOptions.signal?.aborted) abort()
  else requestOptions.signal?.addEventListener('abort', abort, { once: true })
  const defaultTimeout = Number(env.openaiTimeoutMs) || 180000
  const timeoutMs = Number(requestOptions.timeoutMs) > 0
    ? Number(requestOptions.timeoutMs)
    : defaultTimeout
  const timer = setTimeout(() => controller.abort(new DOMException('OpenAI request timed out', 'AbortError')), timeoutMs)
  const cleanup = () => {
    clearTimeout(timer)
    requestOptions.signal?.removeEventListener('abort', abort)
  }

  try {
    const response = await fetch(buildProviderUrl(env.openaiApiBaseUrl || 'https://api.enbrand.co/v1', path), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    })
    if (!response.ok) {
      const text = await response.text()
      let data
      try { data = JSON.parse(text) } catch { data = {} }
      throw providerError(data, response)
    }
    return { response, controller, cleanup }
  } catch (error) {
    cleanup()
    throw error
  }
}

const responseInput = (messages = []) => messages.map((message) => ({
  role: message.role,
  content: Array.isArray(message.content)
    ? message.content.map((part) => {
        if (part.type === 'text') return { type: message.role === 'assistant' ? 'output_text' : 'input_text', text: part.text }
        if (part.type === 'image_url') {
          const image = part.image_url
          return {
            type: 'input_image',
            image_url: typeof image === 'string' ? image : image?.url,
            ...(image?.detail ? { detail: image.detail } : {})
          }
        }
        return part
      })
    : message.content
}))

const responsesBody = (payload, stream) => ({
  model: TEXT_MODEL,
  store: false,
  stream,
  input: responseInput(payload.messages),
  ...((payload.max_output_tokens ?? payload.max_completion_tokens ?? payload.max_tokens) !== undefined
    ? { max_output_tokens: payload.max_output_tokens ?? payload.max_completion_tokens ?? payload.max_tokens }
    : {})
})

const parseSseEvent = (block) => {
  const lines = block.split(/\r?\n/)
  const data = lines.filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart()).join('\n').trim()
  if (!data || data === '[DONE]') return null
  let event
  try { event = JSON.parse(data) } catch {
    throw new HttpError(502, 'Invalid Responses stream event', 'PROVIDER_INVALID_RESPONSE')
  }
  if (!event.type) event.type = lines.find((line) => line.startsWith('event:'))?.slice(6).trim()
  return event
}

async function * readResponseEvents(response) {
  if (!String(response.headers.get('content-type')).includes('text/event-stream')) {
    const text = await response.text()
    if (/^\s*(event:|data:|:)/.test(text)) {
      for (const block of text.split(/\r?\n\r?\n/)) {
        const event = parseSseEvent(block)
        if (event) yield event
      }
    } else {
      let data
      try { data = JSON.parse(text) } catch {
        throw new HttpError(502, 'Invalid Responses result', 'PROVIDER_INVALID_RESPONSE')
      }
      yield { type: `response.${data.status || 'completed'}`, response: data }
    }
    return
  }

  const reader = response.body?.getReader()
  if (!reader) throw new HttpError(502, 'Responses stream body is missing', 'PROVIDER_INVALID_RESPONSE')
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true })
      const blocks = buffer.split(/\r?\n\r?\n/)
      buffer = blocks.pop() || ''
      for (const block of blocks) {
        const event = parseSseEvent(block)
        if (event) yield event
      }
      if (done) break
    }
    const tail = parseSseEvent(buffer)
    if (tail) yield tail
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

const outputText = (response = {}) => typeof response.output_text === 'string'
  ? response.output_text
  : (response.output || []).flatMap((item) => item.content || [])
      .filter((part) => part.type === 'output_text').map((part) => part.text || '').join('')

const chatUsage = (usage) => usage && ({
  ...usage,
  prompt_tokens: usage.input_tokens || 0,
  completion_tokens: usage.output_tokens || 0,
  total_tokens: usage.total_tokens ?? (Number(usage.input_tokens || 0) + Number(usage.output_tokens || 0))
})

async function * chatChunks(response) {
  let id
  let text = ''
  for await (const event of readResponseEvents(response)) {
    id = event.response?.id || event.response_id || id
    if (event.error || ['error', 'response.failed', 'response.cancelled'].includes(event.type)) {
      throw providerError(event.response || event, response)
    }
    if (event.type === 'response.incomplete') {
      throw providerError(event.response || event, response, 'PROVIDER_RESPONSE_INCOMPLETE')
    }
    if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') {
      text += event.delta
      yield { id, model: TEXT_MODEL, choices: [{ index: 0, delta: { content: event.delta } }] }
    }
    if (event.type === 'response.completed') {
      const completed = event.response || {}
      if (completed.error || ['failed', 'cancelled'].includes(completed.status)) throw providerError(completed, response)
      if (completed.status === 'incomplete') throw providerError(completed, response, 'PROVIDER_RESPONSE_INCOMPLETE')
      const content = outputText(completed) || text
      if (!content.trim()) throw new HttpError(502, 'No text output from provider', 'NO_TEXT_OUTPUT')
      if (!text) yield { id, model: TEXT_MODEL, choices: [{ index: 0, delta: { content } }] }
      yield { id, model: TEXT_MODEL, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage: chatUsage(completed.usage) }
      return
    }
  }
  throw new HttpError(502, 'Responses stream ended before completion', 'PROVIDER_STREAM_INTERRUPTED')
}

export const createEnbrandChatCompletion = async (payload = {}, requestOptions = {}) => {
  const { response, cleanup } = await requestOpenAi('/v1/responses', responsesBody(payload, false), requestOptions)
  try {
    let content = ''
    let result
    for await (const chunk of chatChunks(response)) {
      content += chunk.choices[0].delta.content || ''
      result = chunk
    }
    return attachProviderResponseMetadata({
      id: result.id,
      model: TEXT_MODEL,
      choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
      usage: result.usage
    }, response)
  } finally {
    cleanup()
  }
}

export const createEnbrandChatCompletionStream = async (payload = {}, requestOptions = {}) => {
  const { response, controller, cleanup } = await requestOpenAi('/v1/responses', responsesBody(payload, true), requestOptions)
  const chunks = chatChunks(response)
  const encoder = new TextEncoder()
  const body = new ReadableStream({
    async pull(stream) {
      try {
        const { done, value } = await chunks.next()
        if (done) {
          stream.enqueue(encoder.encode('data: [DONE]\n\n'))
          stream.close()
          cleanup()
        } else {
          stream.enqueue(encoder.encode(`data: ${JSON.stringify(value)}\n\n`))
        }
      } catch (error) {
        cleanup()
        stream.error(error)
      }
    },
    cancel(reason) {
      controller.abort(reason)
      cleanup()
      chunks.return().catch(() => {})
    }
  })
  const headers = new Headers(response.headers)
  headers.set('content-type', 'text/event-stream')
  headers.delete('content-length')
  headers.delete('content-encoding')
  return new Response(body, { status: response.status, headers })
}
