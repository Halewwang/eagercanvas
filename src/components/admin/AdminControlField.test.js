import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test, { after } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'

const server = await createServer({
  configFile: false,
  plugins: [vue()],
  resolve: { alias: { '@': fileURLToPath(new URL('../../', import.meta.url)) } },
  server: { middlewareMode: true },
  css: { postcss: { plugins: [] } },
  optimizeDeps: { noDiscovery: true },
  appType: 'custom'
})
after(() => server.close())
const { default: ControlField } = await server.ssrLoadModule('/src/components/admin/AdminControlField.vue')
const { default: RoleSelect } = await server.ssrLoadModule('/src/components/admin/features/AdminRoleMultiSelect.vue')

test('admin native selects retain accessible labels and dark styling for slotted options', async () => {
  const html = await renderToString(createSSRApp({
    render: () => h(ControlField, { tag: 'select', 'aria-label': '角色' }, {
      default: () => [h('option', { value: '' }, '全部'), h('option', { value: 'user' }, '普通用户')]
    })
  }))
  assert.match(html, /<select[^>]*ui-select-input[^>]*aria-label="角色"/)
  assert.match(html, /<option value="user">普通用户<\/option>/)
  const source = readFileSync(new URL('./AdminControlField.vue', import.meta.url), 'utf8')
  assert.match(source, /color-scheme:\s*dark/)
  assert.match(source, /\.ui-select-input :deep\(option\)\s*\{[^}]*background:\s*#202124;[^}]*color:/)
})

test('role choices preserve selection and reserve the super administrator control', async () => {
  const html = await renderToString(createSSRApp({
    render: () => h(RoleSelect, { modelValue: ['support', 'user'] })
  }))
  const inputs = [...html.matchAll(/<input\b([^>]*)>/g)].map(([, attributes]) => attributes)
  assert.equal(inputs.length, 5)
  assert.match(inputs[0], /disabled/)
  assert.ok(inputs.slice(1).every((attributes) => !attributes.includes('disabled')))
  assert.deepEqual(inputs.map((attributes) => attributes.includes('checked')), [false, false, false, true, true])
})

test('read-only role choices disable every input without hiding assigned roles', async () => {
  const html = await renderToString(createSSRApp({
    render: () => h(RoleSelect, { disabled: true, isSuperAdminOperator: true, modelValue: ['super_admin', 'user'] })
  }))
  assert.match(html, /<fieldset[^>]*disabled/)
  const inputs = [...html.matchAll(/<input\b([^>]*)>/g)].map(([, attributes]) => attributes)
  assert.ok(inputs.every((attributes) => attributes.includes('disabled')))
  assert.deepEqual(inputs.map((attributes) => attributes.includes('checked')), [true, false, false, false, true])
})
