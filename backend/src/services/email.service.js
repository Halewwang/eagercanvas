import { Resend } from 'resend'
import { env } from '../config/env.js'

const resend = env.resendApiKey ? new Resend(env.resendApiKey) : null

export const sendVerificationCodeEmail = async ({ email, code, purpose = 'login' }) => {
  const subject = purpose === 'register' ? 'Your Eager Canvas registration code' : 'Your Eager Canvas login code'
  const title = purpose === 'register' ? 'registration' : 'login'

  if (!resend) {
    console.info(`[auth] ${title} code for ${email}: ${code}`)
    return
  }

  await resend.emails.send({
    from: env.resendFromEmail,
    to: email,
    subject,
    html: `<p>Your ${title} verification code is <strong>${code}</strong>. It expires in 10 minutes.</p>`
  })
}
