<template>
  <BaseModal
    :show="show"
    title="Share To Workspace"
    description="Publish this project as a reusable template so other workspace members can copy the full canvas."
    size="sm"
    @update:show="$emit('update:show', $event)"
  >
    <div class="share-panel">
      <CanvasShareWorkspaceSection :workspace-name="workspaceName" />
      <CanvasShareTemplateForm
        :template-name="templateName"
        :template-description="templateDescription"
        @update:template-name="$emit('update:templateName', $event)"
        @update:template-description="$emit('update:templateDescription', $event)"
      />
      <CanvasShareStatusSection
        :status-loading="statusLoading"
        :published="published"
        :last-published-at="lastPublishedAt"
      />
    </div>
    <template #footer>
      <CanvasShareActions
        :published="published"
        :action-loading="actionLoading"
        :status-loading="statusLoading"
        @close="$emit('close')"
        @unpublish="$emit('unpublish')"
        @save="$emit('save')"
      />
    </template>
  </BaseModal>
</template>

<script setup>
import { BaseModal } from '@/components/ui'
import CanvasShareActions from './CanvasShareActions.vue'
import CanvasShareStatusSection from './CanvasShareStatusSection.vue'
import CanvasShareTemplateForm from './CanvasShareTemplateForm.vue'
import CanvasShareWorkspaceSection from './CanvasShareWorkspaceSection.vue'

defineProps({
  show: Boolean,
  templateName: {
    type: String,
    default: ''
  },
  templateDescription: {
    type: String,
    default: ''
  },
  workspaceName: {
    type: String,
    default: ''
  },
  statusLoading: Boolean,
  published: Boolean,
  lastPublishedAt: {
    type: String,
    default: ''
  },
  actionLoading: Boolean
})

defineEmits([
  'update:show',
  'update:templateName',
  'update:templateDescription',
  'close',
  'unpublish',
  'save'
])
</script>

<style scoped>
.share-panel {
  display: flex;
  flex-direction: column;
  gap: 0;
}
</style>
