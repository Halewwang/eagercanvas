/**
 * Workflow templates store | 工作流模板管理
 * System workflow presets only. Shared and team templates are served from the backend.
 */
import { computed } from 'vue'
import { WORKFLOW_TEMPLATES } from '@/config/workflows'

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

const systemWorkflows = computed(() => WORKFLOW_TEMPLATES.map(mapSystemTemplate))

export const resolveWorkflowTemplate = (item) => {
  const workflowId = item?.baseWorkflowId || item?.id
  return systemTemplateMap.get(workflowId) || null
}

export const useWorkflowsStore = () => ({
  systemWorkflows,
  resolveWorkflowTemplate
})
