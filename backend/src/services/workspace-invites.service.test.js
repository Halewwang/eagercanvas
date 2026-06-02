import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createInviteLink,
  isInviteExpired,
  resolveInviteeByUsernameOrEmail
} from './workspace-invites.service.js'

const createInsertClient = ({ inserted }) => ({
  from(table) {
    assert.equal(table, 'workspace_invites')
    return {
      insert(row) {
        inserted.push(row)
        return this
      },
      select() { return this },
      single: async () => ({ data: { id: 'invite-1', ...inserted.at(-1) }, error: null })
    }
  }
})

const createLookupClient = () => ({
  from(table) {
    const query = {
      filters: {},
      select() { return this },
      eq(column, value) {
        this.filters[column] = value
        return this
      },
      ilike(column, value) {
        this.filters[column] = value
        return this
      },
      maybeSingle: async () => {
        if (table === 'users' && query.filters.email === 'ada@example.com') {
          return { data: { id: 'user-1', email: 'ada@example.com' }, error: null }
        }
        if (table === 'user_profiles' && query.filters.username === 'ada') {
          return { data: { user_id: 'user-1', username: 'ada' }, error: null }
        }
        return { data: null, error: null }
      }
    }
    return query
  }
})

test('createInviteLink stores only a token hash and expires the link in seven days', async () => {
  const inserted = []
  const now = new Date('2026-06-02T00:00:00.000Z')

  const result = await createInviteLink('owner-1', 'team-1', {
    supabaseClient: createInsertClient({ inserted }),
    now,
    tokenFactory: () => 'raw-token-value'
  })

  assert.equal(result.token, 'raw-token-value')
  assert.equal(inserted[0].invite_type, 'link')
  assert.equal(inserted[0].token_hash.length, 64)
  assert.notEqual(inserted[0].token_hash, 'raw-token-value')
  assert.equal(inserted[0].expires_at, '2026-06-09T00:00:00.000Z')
})

test('isInviteExpired rejects links after their seven-day expiration', () => {
  assert.equal(
    isInviteExpired(
      { expires_at: '2026-06-09T00:00:00.000Z', status: 'pending' },
      new Date('2026-06-09T00:00:01.000Z')
    ),
    true
  )
  assert.equal(
    isInviteExpired(
      { expires_at: '2026-06-09T00:00:00.000Z', status: 'pending' },
      new Date('2026-06-08T23:59:59.000Z')
    ),
    false
  )
})

test('resolveInviteeByUsernameOrEmail matches verified email before username', async () => {
  const supabaseClient = createLookupClient()

  assert.deepEqual(
    await resolveInviteeByUsernameOrEmail('ada@example.com', { supabaseClient }),
    { userId: 'user-1', email: 'ada@example.com', username: '' }
  )
  assert.deepEqual(
    await resolveInviteeByUsernameOrEmail('ada', { supabaseClient }),
    { userId: 'user-1', email: '', username: 'ada' }
  )
})
