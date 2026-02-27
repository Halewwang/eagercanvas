import { Resend } from 'resend'
import { env } from '../config/env.js'

const resend = env.resendApiKey ? new Resend(env.resendApiKey) : null

export const sendLoginCodeEmail = async ({ email, code }) => {
  if (!resend) {
    console.info(`[auth] login code for ${email}: ${code}`)
    return
  }

  await resend.emails.send({
    from: env.resendFromEmail,
    to: email,
    subject: 'Your Eager Canvas login code',
    html: `<p>Your verification code is <strong>${code}</strong>. It expires in 10 minutes.</p>`
  })
}
