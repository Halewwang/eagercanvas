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
  assert.match(workspaceStoreSource, /const ensureLocalPreviewWorkspaceState = \(\) => \{/)
  assert.match(workspaceStoreSource, /const createLocalPreviewInviteUrl = \(workspaceId = currentWorkspace\.value\?\.id\) => \{/)
  assert.match(workspaceStoreSource, /if \(BYPASS_AUTH_IN_DEV\) \{[\s\S]*return ensureLocalPreviewWorkspaceState\(\)\.activeWorkspace[\s\S]*\}/)
  assert.match(workspaceStoreSource, /if \(BYPASS_AUTH_IN_DEV\) \{[\s\S]*return ensureLocalPreviewWorkspaceState\(\)\.workspaces[\s\S]*\}/)
  assert.match(workspaceStoreSource, /if \(BYPASS_AUTH_IN_DEV\) \{[\s\S]*localPreviewWorkspaces = \[\.\.\.state\.workspaces, workspace\][\s\S]*return currentWorkspace\.value[\s\S]*\}/)
  assert.match(workspaceStoreSource, /if \(BYPASS_AUTH_IN_DEV\) \{[\s\S]*ensureLocalPreviewWorkspaceState\(\)[\s\S]*setFeaturedTemplatesForScope\(normalizedScope, getLocalPreviewTemplates\(\)\)[\s\S]*return featuredTemplates\.value[\s\S]*\}/)
  assert.match(workspaceStoreSource, /if \(BYPASS_AUTH_IN_DEV\) \{[\s\S]*const template = getLocalPreviewTemplateById\(templateId\)[\s\S]*return createLocalProjectFromTemplate\(template\)[\s\S]*\}/)
})

test('workspace store preserves active workspace identity while loading template scopes', () => {
  const start = workspaceStoreSource.indexOf('export const loadFeaturedTemplates = async')
  const end = workspaceStoreSource.indexOf('export const getProjectTemplateStatus = async')
  const loadFeaturedTemplatesBranch = workspaceStoreSource.slice(start, end)

  assert.match(workspaceStoreSource, /const dedupeWorkspaces = \(items = \[\]\) => \{/)
  assert.match(workspaceStoreSource, /workspaces\.value = dedupeWorkspaces\(payload\.workspaces\)/)
  assert.doesNotMatch(
    loadFeaturedTemplatesBranch,
    /currentWorkspace\.value = normalizeWorkspace\(response\?\.data\?\.workspace \|\| currentWorkspace\.value\)/
  )
})

test('workspace store caches template scopes and ignores stale scope responses', () => {
  const workspaceStoreSource = readFileSync(new URL('./workspace.js', import.meta.url), 'utf8')

  assert.match(workspaceStoreSource, /const templateCache = new Map\(\)/)
  assert.match(workspaceStoreSource, /const getTemplateCacheKey = \(scope = templatesScope\.value\) =>/)
  assert.match(workspaceStoreSource, /const setFeaturedTemplatesForScope = \(scope, templates = \[\]\) =>/)
  assert.match(workspaceStoreSource, /export const clearTemplateCache = \(\) =>/)
  assert.match(workspaceStoreSource, /if \(preferCache && cachedTemplates\)/)
  assert.match(workspaceStoreSource, /const requestToken = \+\+templateRequestToken/)
  assert.match(workspaceStoreSource, /if \(requestToken !== templateRequestToken\) return featuredTemplates\.value/)
})

test('workspace store exposes team update and delete actions', () => {
  assert.match(workspaceStoreSource, /apiUpdateTeamWorkspace/)
  assert.match(workspaceStoreSource, /apiDeleteTeamWorkspace/)
  assert.match(workspaceStoreSource, /export const updateTeamWorkspace = async \(workspaceId = currentWorkspace\.value\?\.id, payload = \{\}\) => \{/)
  assert.match(workspaceStoreSource, /export const deleteTeamWorkspace = async \(workspaceId = currentWorkspace\.value\?\.id\) => \{/)
  assert.match(workspaceStoreSource, /updateTeamWorkspace,/)
  assert.match(workspaceStoreSource, /deleteTeamWorkspace,/)
})

test('projects store can materialize a local project from a Share Templates debug item', () => {
  assert.match(projectsStoreSource, /export const createLocalProjectFromTemplate = async \(template = \{\}\) => \{/)
  assert.match(projectsStoreSource, /const project = createLocalProjectRecord\([\s\S]*template\.title[\s\S]*canvasData:\s*template\.canvasData[\s\S]*thumbnail:\s*template\.coverUrl/)
  assert.match(projectsStoreSource, /projects\.value = \[project, \.\.\.projects\.value\]/)
  assert.match(projectsStoreSource, /await saveProjectCanvasDraft\(project\.id, project\.canvasData/)
  assert.match(projectsStoreSource, /return project/)
})
