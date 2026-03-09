/**
 * Workflow templates store | 工作流模板管理
 * Local-first implementation for My/Public/System workflow collections
 */
import { computed, ref } from 'vue'
import { WORKFLOW_TEMPLATES } from '@/config/workflows'
import { useAuthStore } from '@/stores/auth'

const STORAGE_KEY = 'ai-canvas-workflow-templates-v1'

const userTemplates = ref([])
const loaded = ref(false)
const loadedKey = ref('')

const WORKFLOW_NAME_MAP = {
  '多角度分镜': 'Multi-Angle Storyboard',
  '通用产品全套电商图': 'E-commerce Product Set',
  '短剧角色设计': 'Character Design Pack',
  '多时段场景背景': 'Multi-Time Scene Pack',
  '绘本生成器': 'Storybook Generator'
}

const systemTemplateMap = new Map(
  WORKFLOW_TEMPLATES.map((template) => [template.id, template])
)

const toDisplayName = (name) => WORKFLOW_NAME_MAP[name] || name

const mapSystemTemplate = (template) => ({
  id: template.id,
  name: toDisplayName(template.name),
  description: template.description || '',
  icon: template.icon || 'GridOutline',
  cover: template.cover || '',
  sourceType: 'system',
  visibility: 'public',
  baseWorkflowId: template.id
})

const getStorageKey = () => {
  const { user } = useAuthStore()
  const userId = user.value?.id
  return userId ? `${STORAGE_KEY}:${userId}` : STORAGE_KEY
}

const saveLocalTemplates = () => {
  try {
    localStorage.setItem(getStorageKey(), JSON.stringify(userTemplates.value))
  } catch {
    // ignore storage errors
  }
}

export const loadWorkflowTemplates = async () => {
  const storageKey = getStorageKey()
  if (loaded.value && loadedKey.value === storageKey) return
  try {
    const raw = localStorage.getItem(storageKey)
    const parsed = raw ? JSON.parse(raw) : []
    userTemplates.value = Array.isArray(parsed) ? parsed : []
  } catch {
    userTemplates.value = []
  } finally {
    loaded.value = true
    loadedKey.value = storageKey
  }
}

export const resetWorkflowTemplates = () => {
  loaded.value = false
  loadedKey.value = ''
  userTemplates.value = []
}

const systemWorkflows = computed(() => WORKFLOW_TEMPLATES.map(mapSystemTemplate))

const normalizeUserTemplate = (item) => {
  const base = systemTemplateMap.get(item.baseWorkflowId)
  return {
    ...item,
    name: item.name || (base ? toDisplayName(base.name) : 'Untitled Workflow'),
    description: item.description || base?.description || '',
    icon: item.icon || base?.icon || 'GridOutline',
    cover: item.cover || base?.cover || ''
  }
}

const myWorkflows = computed(() =>
  userTemplates.value
    .map(normalizeUserTemplate)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
)

const publicWorkflows = computed(() =>
  myWorkflows.value.filter((item) => item.visibility === 'public')
)

const buildTemplatePayload = ({ baseWorkflowId, name }) => {
  const base = systemTemplateMap.get(baseWorkflowId)
  const now = new Date().toISOString()
  return {
    id: `wf_tpl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    baseWorkflowId,
    name: name?.trim() || (base ? toDisplayName(base.name) : 'Untitled Workflow'),
    description: base?.description || '',
    icon: base?.icon || 'GridOutline',
    cover: base?.cover || '',
    visibility: 'private',
    sourceType: 'user',
    createdAt: now,
    updatedAt: now
  }
}

export const createMyWorkflowTemplate = async ({ baseWorkflowId, name }) => {
  if (!systemTemplateMap.has(baseWorkflowId)) return null
  const next = buildTemplatePayload({ baseWorkflowId, name })
  userTemplates.value = [next, ...userTemplates.value]
  saveLocalTemplates()
  return next
}

export const deleteMyWorkflowTemplate = async (id) => {
  const before = userTemplates.value.length
  userTemplates.value = userTemplates.value.filter((item) => item.id !== id)
  if (userTemplates.value.length !== before) saveLocalTemplates()
}

export const setWorkflowTemplateVisibility = async (id, visibility) => {
  const valid = new Set(['private', 'unlisted', 'public'])
  if (!valid.has(visibility)) return
  const idx = userTemplates.value.findIndex((item) => item.id === id)
  if (idx === -1) return
  const current = userTemplates.value[idx]
  userTemplates.value[idx] = {
    ...current,
    visibility,
    updatedAt: new Date().toISOString()
  }
  saveLocalTemplates()
}

export const resolveWorkflowTemplate = (item) => {
  const workflowId = item?.baseWorkflowId || item?.id
  return systemTemplateMap.get(workflowId) || null
}

export const useWorkflowsStore = () => ({
  systemWorkflows,
  myWorkflows,
  publicWorkflows,
  loadWorkflowTemplates,
  resetWorkflowTemplates,
  createMyWorkflowTemplate,
  deleteMyWorkflowTemplate,
  setWorkflowTemplateVisibility,
  resolveWorkflowTemplate
})
