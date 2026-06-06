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
  const downloads = []
  const hook = useAdminIssueInbox({
    canReadIssues: ref(true),
    fetchIssues: async (params) => {
      calls.push(['list', params])
      return {
        data: [{ id: 'issue-1', severity: 'p1' }],
        pagination: { page: 1, limit: 20, total: 1 }
      }
    },
    fetchIssue: async (id, params) => {
      calls.push(['detail', id, params])
      return { data: { group: { id }, events: [{ id: 'event-1' }] } }
    },
    patchIssueStatus: async (id, status) => calls.push(['patch', id, status]),
    exportIssuesRequest: async (payload) => {
      calls.push(['export', payload])
      return {
        data: {
          jsonFileName: 'issues.json',
          jsonContent: '{"ok":true}',
          markdownFileName: 'issues.md',
          markdownContent: '# Issues'
        }
      }
    },
    notifyIssueRequest: async (id) => {
      calls.push(['notify', id])
      return { data: { ok: true } }
    },
    getMessageApi: () => messages,
    downloadFile: (payload) => downloads.push(payload)
  })

  hook.updateIssueQuery('severity', 'p1')
  await hook.loadIssues()
  await hook.openIssue('issue-1')
  await hook.openIssue({ id: 'issue-1', merged_group_ids: ['issue-1', 'issue-2'] })
  await hook.setIssueStatus({ issueGroupId: 'issue-1', status: 'investigating' })
  await hook.exportIssues()
  await hook.notifyIssue('issue-1')

  assert.equal(hook.issues.value[0].id, 'issue-1')
  assert.equal(hook.selectedIssue.value.group.id, 'issue-1')
  assert.equal(hook.lastExport.value.jsonFileName, 'issues.json')
  assert.ok(calls.some((call) => call[0] === 'patch' && call[2] === 'investigating'))
  assert.ok(calls.some((call) => call[0] === 'detail' && call[2]?.group_ids === 'issue-1,issue-2'))
  assert.ok(calls.some((call) => call[0] === 'export' && call[1].severity === 'p1'))
  assert.ok(calls.some((call) => call[0] === 'notify'))
  assert.deepEqual(downloads.map((item) => item.fileName), ['issues.json', 'issues.md'])
  assert.ok(calls.some((call) => call[0] === 'success' && /生成并下载/.test(call[1])))
})

test('admin issue inbox hook exports selected merged groups and marks them resolved', async () => {
  const calls = []
  const messages = { success: (value) => calls.push(['success', value]), error: (value) => calls.push(['error', value]) }
  const hook = useAdminIssueInbox({
    canReadIssues: ref(true),
    canUpdateIssues: ref(true),
    fetchIssues: async (params) => {
      calls.push(['list', params])
      return {
        data: [
          { id: 'issue-1', severity: 'p1', merged_group_ids: ['issue-1', 'issue-2'] },
          { id: 'issue-3', severity: 'p2' }
        ],
        pagination: { page: 1, limit: 20, total: 2 }
      }
    },
    patchIssueStatus: async (id, status) => calls.push(['patch', id, status]),
    exportIssuesRequest: async (payload) => {
      calls.push(['export', payload])
      return {
        data: {
          jsonFileName: 'selected.json',
          jsonContent: '{"selected":true}',
          markdownFileName: 'selected.md',
          markdownContent: '# Selected'
        }
      }
    },
    getMessageApi: () => messages,
    downloadFile: () => {}
  })

  await hook.loadIssues()
  hook.toggleIssueSelection({ id: 'issue-1', merged_group_ids: ['issue-1', 'issue-2'] }, true)
  assert.deepEqual(hook.selectedIssueIds.value, ['issue-1'])
  assert.equal(hook.selectedIssueCount.value, 1)
  assert.deepEqual(hook.selectedExportGroupIds.value.sort(), ['issue-1', 'issue-2'])

  await hook.exportIssues({ selectedOnly: true })

  const exportCall = calls.find((call) => call[0] === 'export')
  assert.deepEqual(exportCall[1].issueGroupIds, ['issue-1', 'issue-2'])
  assert.deepEqual(
    calls.filter((call) => call[0] === 'patch').map((call) => call.slice(1)),
    [['issue-1', 'resolved'], ['issue-2', 'resolved']]
  )
  assert.deepEqual(hook.selectedIssueIds.value, [])
  assert.ok(calls.some((call) => call[0] === 'success' && /已标记已解决/.test(call[1])))
})
