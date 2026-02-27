import crypto from 'crypto'

export const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex')

export const randomToken = (size = 48) => crypto.randomBytes(size).toString('base64url')

export const randomCode = (digits = 6) => {
  const max = 10 ** digits
  const code = crypto.randomInt(0, max)
  return String(code).padStart(digits, '0')
}
