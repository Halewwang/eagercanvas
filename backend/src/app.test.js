import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createServer } from 'node:http'
import test from 'node:test'

test('the native Express entry serves the same app as the compatibility entry', async () => {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    SUPABASE_URL: 'https://supabase.unit.invalid',
    SUPABASE_SERVICE_ROLE_KEY: 'unit-test-service-role-key',
    JWT_ACCESS_SECRET: 'unit-test-access-secret',
    JWT_REFRESH_SECRET: 'unit-test-refresh-secret',
    FRONTEND_ORIGIN: 'http://localhost:5173'
  })
  const { default: handler, app } = await import('./app.js')
  assert.equal(typeof handler, 'function')
  assert.equal(handler, app)
  assert.equal(handler, (await import('../api/index.js')).default)

  const server = createServer(handler).listen(0, '127.0.0.1')
  await once(server, 'listening')
  try {
    const base = `http://127.0.0.1:${server.address().port}`
    const [root, missing, health, admin] = await Promise.all([
      fetch(base),
      fetch(`${base}/missing`),
      fetch(`${base}/api/v1/health`, { headers: { Origin: 'http://localhost:5173' } }),
      fetch(`${base}/api/v1/admin/users`)
    ])
    assert.equal(root.status, 404)
    assert.equal(missing.status, 404)
    assert.equal(health.status, 200)
    assert.equal((await health.json()).ok, true)
    assert.equal(health.headers.get('access-control-allow-origin'), 'http://localhost:5173')
    assert.equal(health.headers.get('access-control-allow-credentials'), 'true')
    assert.ok(health.headers.get('x-request-id'))
    assert.equal(admin.status, 401)
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  }
})
