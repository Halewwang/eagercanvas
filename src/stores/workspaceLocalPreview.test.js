import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const workspaceStoreSource = readFileSync(new URL('./workspace.js', import.meta.url), 'utf8')
const projectsStoreSource = readFileSync(new URL('./projects.js', import.meta.url), 'utf8')

test('workspace store uses Share Templates mock data only in local preview mode', () => {
  assert.match(workspaceStoreSource, /import \{ isLocalPreviewEnabled \} from '@\/utils\/localPreview'/)
  assert.match(workspaceStoreSource, /const BYPASS_AUTH_IN_DEV = isLocalPreviewEnabled\(\)/)
  assert.match(workspaceStoreSource, /getLocalPreviewWorkspace/)
  assert.match(workspaceStoreSource, /getLocalPreviewTemplates/)
  assert.match(workspaceStoreSource, /getLocalPreviewTemplateById/)
  assert.match(workspaceStoreSource, /if \(BYPASS_AUTH_IN_DEV\) \{[\s\S]*currentWorkspace\.value = getLocalPreviewWorkspace\(\)[\s\S]*return currentWorkspace\.value[\s\S]*\}/)
  assert.match(workspaceStoreSource, /if \(BYPASS_AUTH_IN_DEV\) \{[\s\S]*featuredTemplates\.value = getLocalPreviewTemplates\(\)[\s\S]*return featuredTemplates\.value[\s\S]*\}/)
  assert.match(workspaceStoreSource, /if \(BYPASS_AUTH_IN_DEV\) \{[\s\S]*const template = getLocalPreviewTemplateById\(templateId\)[\s\S]*return createLocalProjectFromTemplate\(template\)[\s\S]*\}/)
})

test('projects store can materialize a local project from a Share Templates debug item', () => {
  assert.match(projectsStoreSource, /export const createLocalProjectFromTemplate = async \(template = \{\}\) => \{/)
  assert.match(projectsStoreSource, /const project = createLocalProjectRecord\([\s\S]*template\.title[\s\S]*canvasData:\s*template\.canvasData[\s\S]*thumbnail:\s*template\.coverUrl/)
  assert.match(projectsStoreSource, /projects\.value = \[project, \.\.\.projects\.value\]/)
  assert.match(projectsStoreSource, /await saveProjectCanvasDraft\(project\.id, project\.canvasData/)
  assert.match(projectsStoreSource, /return project/)
})
