#!/usr/bin/env node

const baseUrl = String(process.env.PERF_BASE_URL || 'http://localhost:8787/api/v1').replace(/\/+$/, '')
const bearerToken = String(process.env.PERF_BEARER_TOKEN || '').trim()
const projectId = String(process.env.PERF_PROJECT_ID || '').trim()

if (!bearerToken) {
  console.error('[perf-probe] missing PERF_BEARER_TOKEN')
  process.exit(1)
}

const headers = {
  authorization: `Bearer ${bearerToken}`,
  'x-request-id': `perf-probe-${Date.now()}`
}

const fetchJson = async (path) => {
  const response = await fetch(`${baseUrl}${path}`, { headers })
  const text = await response.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  return {
    status: response.status,
    ok: response.ok,
    body
  }
}

const main = async () => {
  const me = await fetchJson('/auth/me')
  const output = {
    baseUrl,
    me
  }

  if (projectId) {
    output.project = await fetchJson(`/projects/${projectId}`)
    output.projectMeta = {
      id: output.project?.body?.data?.id || null,
      updatedAt: output.project?.body?.data?.updatedAt || output.project?.body?.data?.updated_at || null
    }
  }

  console.log(JSON.stringify(output, null, 2))
}

main().catch((error) => {
  console.error('[perf-probe] failed', error)
  process.exit(1)
})
