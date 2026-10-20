import assert from 'node:assert/strict'
import { after } from 'node:test'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'

const server = await createServer({
  configFile: false,
  plugins: [vue()],
  resolve: { alias: { '@': fileURLToPath(new URL('../../../', import.meta.url)) } },
  server: { middlewareMode: true },
  ssr: { noExternal: ['naive-ui', 'vueuc'] },
  optimizeDeps: { noDiscovery: true },
  appType: 'custom'
})
after(() => server.close())
const { default: CapsuleMenu } = await server.ssrLoadModule('/src/components/nodes/image/ImageNodeCapsuleMenu.vue')
const render = (props = {}) => {
  const app = createSSRApp({ render: () => h(CapsuleMenu, {
    toolOptions: [{ key: 'replace-image', label: 'Upload Image' }],
    backgroundOptions: [{ key: 'auto', label: 'Auto' }],
    displayBackground: 'Background',
    ...props
  }) })
  app.provide('@css-render/vue3-ssr', { styles: [], ids: new Set() })
  return renderToString(app)
}

test('image capsule removes Background and keeps empty-node Upload accessible through Tools', async () => {
  const html = await render()
  assert.doesNotMatch(html, /<button[^>]*>Background<\/button>/)
  const tools = [...html.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)].find(([, , content]) => /Tools/.test(content))
  assert.ok(tools)
  assert.doesNotMatch(tools[1], /\bdisabled\b/)
})

test('image capsule hides an empty Tools menu and disables tools while processing', async () => {
  assert.doesNotMatch(await render({ toolOptions: [] }), /<span[^>]*>Tools<\/span>/)
  const busyHtml = await render({ toolBusy: true })
  const tools = [...busyHtml.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)].find(([, , content]) => /Tools/.test(content))
  assert.match(tools[1], /\bdisabled\b/)
})


test('empty image nodes expose selectable local parameters as their current values', async () => {
  const html = await render({ exportRatio: '1:1', exportSize: 4096 })
  assert.match(html, /aria-label="Image ratio 1:1"[^>]*>\s*1:1\s*<\/button>/)
  assert.match(html, /aria-label="Image size 4K"[^>]*>\s*4K\s*<\/button>/)
  const ratioButton = html.match(/<button([^>]*aria-label="Image ratio 1:1"[^>]*)>/)[1]
  assert.doesNotMatch(ratioButton, /\bdisabled\b/)
  assert.doesNotMatch(html, /Export ratio|Export PNG/)
  assert.doesNotMatch(html, /aria-label="Download PNG"/)
})

test('existing images keep current parameter values and provide a separate local download action', async () => {
  const html = await render({ hasDisplayImage: true, exportRatio: '16:9', exportSize: 2048 })
  assert.match(html, />\s*16:9\s*<\/button>/)
  assert.match(html, />\s*2K\s*<\/button>/)
  assert.match(html, /aria-label="Download PNG"/)
  assert.match(html, /keep the original image unchanged/)
  const busyHtml = await render({ hasDisplayImage: true, exportRatio: '1:1', exportSize: 4096, localExportBusy: true })
  for (const name of ['Image ratio 1:1', 'Image size 4K', 'Download PNG']) {
    assert.match(busyHtml.match(new RegExp(`<button([^>]*aria-label="${name}"[^>]*)>`))[1], /\bdisabled\b/)
  }
})

test('unconfigured imported images display original ratio and size explicitly', async () => {
  const html = await render({ hasDisplayImage: true, exportRatio: '', exportSize: 0 })
  assert.equal([...html.matchAll(/>\s*Original\s*<\/button>/g)].length, 2)
})
