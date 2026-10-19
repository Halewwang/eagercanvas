import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'

const server = await createServer({
  configFile: false,
  plugins: [vue()],
  ssr: { noExternal: ['naive-ui', 'vueuc'] },
  resolve: { alias: { '@': fileURLToPath(new URL('../../', import.meta.url)) } },
  server: { middlewareMode: true },
  css: { postcss: { plugins: [] } },
  optimizeDeps: { noDiscovery: true },
  appType: 'custom'
})
after(() => server.close())
const { default: SettingsPanel } = await server.ssrLoadModule('/src/components/workspace/WorkspaceSettingsPanel.vue')
const { default: CardsGrid } = await server.ssrLoadModule('/src/components/workspace/WorkspaceCardsGrid.vue')
const render = (Component, props) => {
  const app = createSSRApp({ render: () => h(Component, props) })
  app.provide('@css-render/vue3-ssr', { styles: [], ids: new Set() })
  return renderToString(app)
}

test('workspace permissions retain role values and busy states in shared select controls', async () => {
  const html = await render(SettingsPanel, {
    editName: 'Fixture team',
    editAvatarUrl: 'fixture-avatar',
    savingPermission: true,
    permissionDetail: {
      project: { id: 'fixture-project', name: 'Fixture project' },
      ownerUserId: 'owner',
      members: [
        { userId: 'owner', displayName: 'Owner fixture' },
        { userId: 'editor', displayName: 'Editor fixture', projectRole: 'editor' },
        { userId: 'viewer', displayName: 'Viewer fixture' }
      ]
    }
  })
  assert.doesNotMatch(html, /<select\b|<option\b/)
  const classes = [...html.matchAll(/\bclass="([^"]+)"/g)].map(([, value]) => value.split(' '))
  assert.equal(classes.filter((value) => value.includes('base-select')).length, 3)
  assert.equal(classes.filter((value) => value.includes('n-base-selection--disabled')).length, 3)
  for (const label of ['Owner', 'Editor', 'Viewer']) assert.ok(html.includes(`>${label}<`))
  assert.match(html, /value="Fixture team"/)
  assert.match(html, /value="fixture-avatar"/)
  assert.match(html, /<button type="submit"/)
})

test('project selection preserves checked and read-only states in shared checkboxes', async () => {
  const html = await render(CardsGrid, {
    selectionMode: true,
    selectedIds: ['owned'],
    canSelectProject: (item) => item.id === 'owned',
    items: [{ id: 'owned', name: 'Owned fixture' }, { id: 'readonly', name: 'Readonly fixture' }]
  })
  const checkboxes = [...html.matchAll(/<div\b[^>]*role="checkbox"[^>]*>/g)].map(([tag]) => tag)
  const owned = checkboxes.find((tag) => tag.includes('aria-label="Select Owned fixture"'))
  const readonly = checkboxes.find((tag) => tag.includes('aria-label="Select Readonly fixture"'))
  assert.match(owned, /aria-checked="true"/)
  assert.match(owned, /aria-disabled="false"/)
  assert.match(readonly, /aria-checked="false"/)
  assert.match(readonly, /aria-disabled="true"/)
  assert.match(html, /View only/)
  assert.doesNotMatch(html, /Actions for/)
})
