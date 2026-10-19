import { randomUUID } from 'node:crypto'

const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/

export const normalizeTrustedRequestId = (value, generate = randomUUID) => {
  if (typeof value === 'string') {
    const candidate = value.trim()
    if (SAFE_REQUEST_ID.test(candidate)) return candidate
  }
  return String(generate())
}

export default normalizeTrustedRequestId
