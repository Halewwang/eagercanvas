import { Resend } from 'resend'
import { env } from '../config/env.js'
import { HttpError } from '../utils/http.js'

/* global console */

const resend = env.resendApiKey ? new Resend(env.resendApiKey) : null

const getResendErrorMessage = (error) => {
  if (!error) return ''
  if (typeof error === 'string') return error
  return error.message || error.name || ''
}

export const buildVerificationCodeEmailPayload = ({
  email,
  code,
  purpose = 'login',
  from,
  templateId = ''
}) => {
  const subject = purpose === 'register' ? 'Your Eager Canvas registration code' : 'Your Eager Canvas login code'
  const title = purpose === 'register' ? 'registration' : 'login'
  const trimmedTemplateId = String(templateId || '').trim()
  const payload = {
    from,
    to: email,
    subject
  }

  if (trimmedTemplateId) {
    return {
      ...payload,
      template: {
        id: trimmedTemplateId,
        variables: {
          verification_code: code
        }
      }
    }
  }

  return {
    ...payload,
    html: `<p>Your ${title} verification code is <strong>${code}</strong>. It expires in 10 minutes.</p>`
  }
}

export const sendVerificationCodeEmail = async ({ email, code, purpose = 'login' }) => {
  const title = purpose === 'register' ? 'registration' : 'login'

  if (!resend) {
    if (env.nodeEnv === 'production') {
      throw new HttpError(500, 'Email delivery is not configured', 'EMAIL_NOT_CONFIGURED')
    }
    console.info(`[auth] ${title} code for ${email}: ${code}`)
    return
  }

  try {
    const result = await resend.emails.send(
      buildVerificationCodeEmailPayload({
        email,
        code,
        purpose,
        from: env.resendFromEmail,
        templateId: env.resendAuthCodeTemplateId
      })
    )

    if (result?.error) {
      throw new HttpError(
        502,
        getResendErrorMessage(result.error) || 'Failed to send verification code email',
        'EMAIL_SEND_FAILED'
      )
    }
  } catch (error) {
    if (error instanceof HttpError) throw error
    throw new HttpError(
      502,
      getResendErrorMessage(error) || 'Failed to send verification code email',
      'EMAIL_SEND_FAILED'
    )
  }
}

export const sendIssueAlertEmail = async ({ to, subject, html, text = '' }) => {
  if (!resend || !env.resendFromEmail) {
    return { ok: true, status: 'skipped', reason: 'EMAIL_NOT_CONFIGURED' }
  }

  try {
    const result = await resend.emails.send({
      from: env.resendFromEmail,
      to,
      subject,
      html,
      text
    })

    if (result?.error) {
      return {
        ok: false,
        status: 'failed',
        error: getResendErrorMessage(result.error) || 'Failed to send issue alert email'
      }
    }

    return { ok: true, status: 'sent', id: result?.data?.id || result?.id || null }
  } catch (error) {
    return {
      ok: false,
      status: 'failed',
      error: getResendErrorMessage(error) || 'Failed to send issue alert email'
    }
  }
}
