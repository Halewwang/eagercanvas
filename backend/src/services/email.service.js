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

export const sendVerificationCodeEmail = async ({ email, code, purpose = 'login' }) => {
  const subject = purpose === 'register' ? 'Your Eager Canvas registration code' : 'Your Eager Canvas login code'
  const title = purpose === 'register' ? 'registration' : 'login'

  if (!resend) {
    if (env.nodeEnv === 'production') {
      throw new HttpError(500, 'Email delivery is not configured', 'EMAIL_NOT_CONFIGURED')
    }
    console.info(`[auth] ${title} code for ${email}: ${code}`)
    return
  }

  try {
    const result = await resend.emails.send({
      from: env.resendFromEmail,
      to: email,
      subject,
      html: `<p>Your ${title} verification code is <strong>${code}</strong>. It expires in 10 minutes.</p>`
    })

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
