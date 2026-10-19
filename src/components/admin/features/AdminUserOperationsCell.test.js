import assert from 'node:assert/strict'
import { after } from 'node:test'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createSSRApp, h, ref } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'

const server = await createServer({
  configFile: false,
  plugins: [vue()],
  resolve: { alias: { '@': fileURLToPath(new URL('../../../', import.meta.url)) } },
  server: { middlewareMode: true },
  css: { postcss: { plugins: [] } },
  optimizeDeps: { noDiscovery: true },
  appType: 'custom'
})
after(() => server.close())
const { default: Operations } = await server.ssrLoadModule('/src/components/admin/features/AdminUserOperationsCell.vue')
const { default: UserCard } = await server.ssrLoadModule('/src/components/admin/features/AdminUserCard.vue')
const { ADMIN_DESKTOP_ACTIONS_KEY } = await server.ssrLoadModule('/src/hooks/useAdminDesktopOnly.js')

const render = async ({ user = {}, desktop = true, self = false, permissions = true, ...props } = {}) => {
  const app = createSSRApp({
    render: () => h(Operations, {
      user: { id: 'fixture-user', status: 'active', service: { serviceStatus: 'not_enabled' }, ...user },
      isSelf: () => self,
      canActivateService: permissions,
      canDisableService: permissions,
      canManageRoles: permissions,
      canManageUserStatus: permissions,
      canArchiveUser: permissions,
      canRestoreUser: permissions,
      ...props
    })
  })
  app.provide(ADMIN_DESKTOP_ACTIONS_KEY, ref(desktop))
  return renderToString(app)
}
const buttons = (html) => [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)]
  .map(([, attributes, content]) => ({ disabled: /\bdisabled\b/.test(attributes), text: content.replace(/<[^>]*>/g, '').trim() }))


test('user actions are visible without opening a more menu', async () => {
  const html = await render()
  assert.doesNotMatch(html, /aria-haspopup|用户操作|<td/)
  assert.deepEqual(buttons(html).map(({ text }) => text), ['查看详情', '管理角色', '开通服务', '暂停账户', '删除账户'])
})

test('service and account actions reflect paused and deleted states', async () => {
  const paused = buttons(await render({ user: { status: 'suspended', service: { serviceStatus: 'disabled' } } }))
  assert.deepEqual(paused.map(({ text }) => text), ['查看详情', '管理角色', '恢复服务', '恢复账户', '删除账户'])
  const deleted = buttons(await render({ user: { status: 'deleted', service: { serviceStatus: 'active' } } }))
  assert.ok(deleted.some(({ text }) => text === '恢复已删除账户'))
  assert.ok(!deleted.some(({ text }) => text === '删除账户' || text === '暂停账户'))
  assert.equal(deleted.find(({ text }) => text === '暂停服务').disabled, true)
})

test('permissions and self protection exclude forbidden actions', async () => {
  assert.deepEqual(buttons(await render({ permissions: false })).map(({ text }) => text), ['查看详情'])
  assert.deepEqual(buttons(await render({ self: true })).map(({ text }) => text), ['查看详情', '开通服务'])
})

test('mobile users and pending mutations cannot submit account or service changes', async () => {
  const mobile = buttons(await render({ desktop: false }))
  assert.ok(mobile.filter(({ text }) => !['查看详情', '管理角色'].includes(text)).every(({ disabled }) => disabled))
  const pending = buttons(await render({ serviceLoading: { 'fixture-user': true }, statusLoading: { 'fixture-user': true }, deleting: { 'fixture-user': true } }))
  assert.ok(pending.filter(({ text }) => !['查看详情', '管理角色'].includes(text)).every(({ disabled }) => disabled))
})


test('user cards expose identity and all permission states without showing the raw identifier', async () => {
  const html = await renderToString(createSSRApp({
    render: () => h(UserCard, {
      user: { id: 'private-fixture-id', displayName: 'Fixture', email: 'fixture@example.invalid', status: 'suspended', roles: ['support'], service: { serviceStatus: 'disabled' } }
    })
  }))
  for (const value of ['Fixture', 'fixture@example.invalid', '服务已暂停', '已暂停', '客服', '最近登录']) assert.ok(html.includes(value))
  assert.doesNotMatch(html, /private-fixture-id|<td/)
})
