import assert from 'node:assert/strict'
import test from 'node:test'

import { LOCAL_PREVIEW_ADMIN_PERMISSIONS as backendPermissions } from '../backend/src/middleware/auth.js'
import { LOCAL_PREVIEW_ADMIN_PERMISSIONS as frontendPermissions } from '../src/utils/localPreview.js'

test('frontend and backend directly share the complete local preview permission contract', () => {
  assert.deepEqual(new Set(frontendPermissions), new Set(backendPermissions))
  assert.ok(frontendPermissions.includes('admin.service_access.activate'))
  assert.ok(frontendPermissions.includes('admin.service_access.disable'))
  assert.ok(frontendPermissions.includes('admin.user.delete'))
  assert.ok(frontendPermissions.includes('admin.user.restore'))
  assert.equal(frontendPermissions.some((code) => /admin\.(?:issue|api_key|billing|usage)\./.test(code)), false)
})
