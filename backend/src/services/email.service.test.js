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

test('builds a Resend template payload for verification code emails', async () => {
  const { buildVerificationCodeEmailPayload } = await import('./email.service.js')

  const payload = buildVerificationCodeEmailPayload({
    email: 'user@example.com',
    code: '123456',
    purpose: 'login',
    from: 'Eager Canvas <login@example.com>',
    templateId: 'email-verification-template'
  })

  assert.deepEqual(payload, {
    from: 'Eager Canvas <login@example.com>',
    to: 'user@example.com',
    subject: 'Your Eager Canvas login code',
    template: {
      id: 'email-verification-template',
      variables: {
        verification_code: '123456'
      }
    }
  })
})

test('builds the existing inline verification email when no template id is configured', async () => {
  const { buildVerificationCodeEmailPayload } = await import('./email.service.js')

  const payload = buildVerificationCodeEmailPayload({
    email: 'user@example.com',
    code: '654321',
    purpose: 'login',
    from: 'login@example.com'
  })

  assert.equal(payload.from, 'login@example.com')
  assert.equal(payload.to, 'user@example.com')
  assert.equal(payload.subject, 'Your Eager Canvas login code')
  assert.equal(payload.template, undefined)
  assert.match(payload.html, /Your login verification code is <strong>654321<\/strong>/)
})
