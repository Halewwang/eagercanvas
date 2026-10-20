import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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


const parameterProps = {
  ratioOptions: [{ key: '1:1', label: '1:1' }, { key: '16:9', label: '16:9' }],
  resolutionOptions: [{ key: '4k', label: '4K' }],
  displayRatio: '16:9', displayResolution: '4K',
}

test('empty nodes display generation ratio and resolution directly', async () => {
  const html = await render(parameterProps)
  for (const [name, value] of [['ratio', '16:9'], ['resolution', '4K']]) {
    const button = html.match(new RegExp(`<button([^>]*aria-label="Image ${name} ${value}"[^>]*)>([\\s\\S]*?)<\\/button>`))
    assert.ok(button, name)
    assert.doesNotMatch(button[1], /\bdisabled\b/)
    assert.match(button[2], new RegExp(value))
  }
  assert.doesNotMatch(html, /Image quality|Image qualities|Generation size|3840/)
  assert.doesNotMatch(html, /Local crop|Local PNG|Export ratio|Export PNG/)
})

test('existing images download their original output and disable controls while generating', async () => {
  const html = await render({ ...parameterProps, hasDisplayImage: true })
  assert.match(html, /aria-label="Download original image"/)
  assert.match(html, /Download the original image/)
  const busy = await render({ ...parameterProps, imageBusy: true })
  for (const label of ['Image ratio 16:9', 'Image resolution 4K']) {
    assert.match(busy.match(new RegExp(`<button([^>]*aria-label="${label}"[^>]*)>`))[1], /\bdisabled\b/)
  }
})


test('parameter menus keep dark surfaces selected radio roles and keyboard focus cues', async () => {
  const html = await render(parameterProps)
  for (const label of ['Image ratio 16:9', 'Image resolution 4K']) {
    const attributes = html.match(new RegExp(`<button([^>]*aria-label="${label}"[^>]*)>`))[1]
    assert.match(attributes, /aria-haspopup="menu"/)
    assert.match(attributes, /aria-expanded="false"/)
  }
  const source = readFileSync(new URL('./ImageNodeCapsuleMenu.vue', import.meta.url), 'utf8')
  assert.match(source, /role: 'menuitemradio'/)
  assert.match(source, /'aria-checked': option.key === selectedKey\(options, displayValue\)/)
  assert.equal((source.match(/:value="selectedKey\(/g) || []).length, 2)
  assert.equal((source.match(/@update:show="(?:ratio|resolution)MenuOpen = \$event"/g) || []).length, 2)
  assert.match(source, /color: 'var\(--surface-2\)'/)
  assert.match(source, /optionColorActive: 'var\(--surface-3\)'/)
  assert.match(source, /\.capsule-select:focus-visible/)
})
