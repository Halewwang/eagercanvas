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
    'const sendAdminIssueDigest = async () => ({})',
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

test('admin issue inbox hook exports selected merged groups without marking them resolved', async () => {
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
  assert.deepEqual(calls.filter((call) => call[0] === 'patch'), [])
  assert.deepEqual(hook.selectedIssueIds.value, ['issue-1'])
  assert.ok(calls.some((call) => call[0] === 'success' && /已导出/.test(call[1])))
})

test('admin issue inbox hook exports the full current filter repeatedly with unique downloads', async () => {
  const exportCalls = []
  const downloads = []
  const hook = useAdminIssueInbox({
    canReadIssues: ref(true),
    fetchIssues: async () => ({
      data: [{ id: 'issue-1', severity: 'p1' }],
      pagination: { page: 1, limit: 10, total: 37 }
    }),
    exportIssuesRequest: async (payload) => {
      exportCalls.push(payload)
      return {
        data: {
          jsonFileName: 'issues.json',
          jsonContent: '{"ok":true}',
          markdownFileName: 'issues.md',
          markdownContent: '# Issues'
        }
      }
    },
    getMessageApi: () => ({ success: () => {}, error: () => {} }),
    downloadFile: (payload) => downloads.push(payload)
  })

  await hook.loadIssues()
  await hook.exportIssues()
  await hook.exportIssues()

  assert.equal(exportCalls.length, 2)
  assert.deepEqual(exportCalls.map((payload) => payload.limit), [37, 37])
  assert.deepEqual(downloads.map((item) => item.fileName), [
    'issues.json',
    'issues.md',
    'issues-2.json',
    'issues-2.md'
  ])
})

test('admin issue inbox hook can select and export every issue in the current filter', async () => {
  const exportCalls = []
  const hook = useAdminIssueInbox({
    canReadIssues: ref(true),
    fetchIssues: async () => ({
      data: [
        { id: 'issue-1', severity: 'p1' },
        { id: 'issue-2', severity: 'p2' }
      ],
      pagination: { page: 1, limit: 10, total: 37 }
    }),
    exportIssuesRequest: async (payload) => {
      exportCalls.push(payload)
      return { data: { jsonFileName: 'selected.json', jsonContent: '{"selected":true}' } }
    },
    getMessageApi: () => ({ success: () => {}, error: () => {} }),
    downloadFile: () => {}
  })

  await hook.loadIssues()
  hook.toggleAllVisibleIssueSelection(true)

  assert.equal(hook.allVisibleIssuesSelected.value, true)
  assert.equal(hook.selectedIssueCount.value, 37)
  assert.equal(hook.selectedExportGroupCount.value, 37)
  assert.deepEqual(hook.selectedIssueIds.value, ['issue-1', 'issue-2'])

  await hook.exportIssues({ selectedOnly: true })

  assert.deepEqual(exportCalls[0], {
    status: 'open',
    severity: '',
    source_layer: '',
    limit: 37
  })
})

test('admin issue inbox hook sends the current filter export package to a prompted email', async () => {
  const calls = []
  const hook = useAdminIssueInbox({
    canReadIssues: ref(true),
    fetchIssues: async () => ({
      data: [{ id: 'issue-1', severity: 'p1' }],
      pagination: { page: 1, limit: 10, total: 42 }
    }),
    sendIssueDigestRequest: async (payload) => {
      calls.push(['send-digest', payload])
      return { data: { ok: true, issueCount: 42, recipient: payload.to } }
    },
    getEmailRecipient: () => 'ops@example.com',
    getMessageApi: () => ({ success: (value) => calls.push(['success', value]), error: (value) => calls.push(['error', value]) })
  })

  hook.updateIssueQuery('severity', 'p1')
  await hook.loadIssues()
  const result = await hook.sendIssueDigestEmail()

  assert.equal(result.recipient, 'ops@example.com')
  assert.deepEqual(calls.find((call) => call[0] === 'send-digest')[1], {
    to: 'ops@example.com',
    status: 'open',
    severity: 'p1',
    source_layer: '',
    limit: 42
  })
  assert.ok(calls.some((call) => call[0] === 'success' && /已发送/.test(call[1])))
})
