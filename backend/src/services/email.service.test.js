import assert from 'node:assert/strict'
import process from 'node:process'
import test from 'node:test'

test('throws a clear error when Resend rejects the verification email', async () => {
  const originalFetch = globalThis.fetch
  const originalApiKey = process.env.RESEND_API_KEY
  const originalFromEmail = process.env.RESEND_FROM_EMAIL

  process.env.RESEND_API_KEY = 're_test_key'
  process.env.RESEND_FROM_EMAIL = 'login@example.com'
  globalThis.fetch = async () => new globalThis.Response(
    JSON.stringify({
      name: 'validation_error',
      message: 'You can only send testing emails to your own email address'
    }),
    {
      status: 403,
      headers: { 'content-type': 'application/json' }
    }
  )

  try {
    const { sendVerificationCodeEmail } = await import('./email.service.js')

    await assert.rejects(
      () => sendVerificationCodeEmail({
        email: 'user@example.com',
        code: '123456',
        purpose: 'login'
      }),
      (error) => {
        assert.equal(error.status, 502)
        assert.equal(error.code, 'EMAIL_SEND_FAILED')
        assert.match(error.message, /testing emails/)
        return true
      }
    )
  } finally {
    globalThis.fetch = originalFetch
    if (originalApiKey === undefined) delete process.env.RESEND_API_KEY
    else process.env.RESEND_API_KEY = originalApiKey
    if (originalFromEmail === undefined) delete process.env.RESEND_FROM_EMAIL
    else process.env.RESEND_FROM_EMAIL = originalFromEmail
  }
})
