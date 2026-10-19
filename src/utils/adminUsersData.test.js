import assert from 'node:assert/strict'
import test from 'node:test'
import { getAdminVisibleUserPages } from './adminUsersData.js'

test('pagination keeps a bounded visible range at the start, middle, and end', () => {
  assert.deepEqual(getAdminVisibleUserPages({ totalPages: 2 }), [1, 2])
  assert.deepEqual(getAdminVisibleUserPages({ currentPage: 1, totalPages: 9 }), [1, 2, 3, 4, 5])
  assert.deepEqual(getAdminVisibleUserPages({ currentPage: 5, totalPages: 9 }), [3, 4, 5, 6, 7])
  assert.deepEqual(getAdminVisibleUserPages({ currentPage: 9, totalPages: 9 }), [5, 6, 7, 8, 9])
})
