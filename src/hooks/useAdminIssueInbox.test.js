import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const hookUrl = new URL('./useAdminIssueInbox.js', import.meta.url)
const vueUrl = import.meta.resolve('vue')

const hookSource = readFileSync(hookUrl, 'utf8')
  .replace("from 'vue'", `from '${vueUrl}'`)
  .replace(/import \{\n[\s\S]*?\n\} from '@\/api\/admin'\n/, [
    'const exportAdminIssues = async () => ({})',
    'const getAdminIssue = async () => ({})',
    'const getAdminIssues = async () => ({})',
    'const notifyAdminIssue = async () => ({})',
    'const updateAdminIssueStatus = async () => ({})'
  ].join('\n') + '\n')
  .replace("import { getErrorMessage } from '@/utils'\n", 'const getErrorMessage = (_error, fallback) => fallback\n')

const { ref } = await import('vue')
const { useAdminIssueInbox } = await import(`data:text/javascript;base64,${Buffer.from(hookSource).toString('base64')}`)

test('admin issue inbox hook loads, filters, exports, and updates issues', async () => {
  const calls = []
  const messages = { success: (value) => calls.push(['success', value]), error: (value) => calls.push(['error', value]) }
  const hook = useAdminIssueInbox({
    canReadIssues: ref(true),
    fetchIssues: async (params) => {
      calls.push(['list', params])
      return {
        data: [{ id: 'issue-1', severity: 'p1' }],
        pagination: { page: 1, limit: 20, total: 1 }
      }
    },
    fetchIssue: async (id) => {
      calls.push(['detail', id])
      return { data: { group: { id }, events: [{ id: 'event-1' }] } }
    },
    patchIssueStatus: async (id, status) => calls.push(['patch', id, status]),
    exportIssuesRequest: async (payload) => {
      calls.push(['export', payload])
      return { data: { jsonPath: '/tmp/issues.json' } }
    },
    notifyIssueRequest: async (id) => {
      calls.push(['notify', id])
      return { data: { ok: true } }
    },
    getMessageApi: () => messages
  })

  hook.updateIssueQuery('severity', 'p1')
  await hook.loadIssues()
  await hook.openIssue('issue-1')
  await hook.setIssueStatus({ issueGroupId: 'issue-1', status: 'investigating' })
  await hook.exportIssues()
  await hook.notifyIssue('issue-1')

  assert.equal(hook.issues.value[0].id, 'issue-1')
  assert.equal(hook.selectedIssue.value.group.id, 'issue-1')
  assert.equal(hook.lastExport.value.jsonPath, '/tmp/issues.json')
  assert.ok(calls.some((call) => call[0] === 'patch' && call[2] === 'investigating'))
  assert.ok(calls.some((call) => call[0] === 'export' && call[1].severity === 'p1'))
  assert.ok(calls.some((call) => call[0] === 'notify'))
})
