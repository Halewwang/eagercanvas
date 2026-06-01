<template>
  <BaseModal
    :show="showRename"
    title="Rename project"
    description="Update the project name shown in your workspace."
    size="sm"
    @update:show="$emit('update:showRename', $event)"
  >
    <BaseInput
      v-model="renameValueModel"
      placeholder="Enter project name"
      @keyup.enter="$emit('confirmRename')"
    />
    <template #footer>
      <BaseModalActions>
        <BaseButton variant="ghost" @click="$emit('update:showRename', false)">Cancel</BaseButton>
        <BaseButton @click="$emit('confirmRename')">Save</BaseButton>
      </BaseModalActions>
    </template>
  </BaseModal>

  <BaseModal
    :show="showDelete"
    title="Delete project"
    description="This action permanently removes the project from your workspace."
    size="sm"
    @update:show="$emit('update:showDelete', $event)"
  >
    <BaseModalCopy>Delete "{{ deleteTargetName }}"? This action cannot be undone.</BaseModalCopy>
    <template #footer>
      <BaseModalActions>
        <BaseButton variant="ghost" @click="$emit('update:showDelete', false)">Cancel</BaseButton>
        <BaseButton variant="danger" @click="$emit('confirmDelete')">Delete</BaseButton>
      </BaseModalActions>
    </template>
  </BaseModal>

  <BaseModal
    :show="showTemplatePreview"
    title="Template Preview"
    description="View template details without copying it into your projects."
    size="md"
    @update:show="$emit('update:showTemplatePreview', $event)"
  >
    <div v-if="previewTemplate" class="template-preview">
      <WorkspaceTemplateCanvasPreview
        v-if="previewTemplate.canvasData"
        :canvas-data="previewTemplate.canvasData"
      />
      <div v-else-if="previewTemplate.thumbnail || previewTemplate.cover || previewTemplate.coverUrl" class="template-preview-media">
        <img
          :src="previewTemplate.thumbnail || previewTemplate.cover || previewTemplate.coverUrl"
          :alt="previewTemplate.title || previewTemplate.name"
        />
      </div>
      <WorkspaceTemplateCanvasPreview v-else :canvas-data="null" />
      <div class="template-preview-content">
        <div class="template-preview-copy">
          <h3>{{ previewTemplate.title || previewTemplate.name }}</h3>
          <p class="template-preview-owner">{{ String(previewTemplate.ownerDisplayName || '').trim() || 'Unknown user' }}</p>
          <p class="template-preview-description">{{ String(previewTemplate.description || '').trim() || 'No description provided.' }}</p>
        </div>
        <div class="template-preview-stat" aria-label="Template node count">
          <strong>{{ templateNodeCount }}</strong>
          <span>{{ templateNodeCount === 1 ? 'Node' : 'Nodes' }}</span>
        </div>
      </div>
    </div>
    <template #footer>
      <BaseModalActions>
        <BaseButton variant="ghost" @click="$emit('closeTemplatePreview')">Close</BaseButton>
        <BaseButton :disabled="!previewTemplate" @click="$emit('useTemplateFromPreview')">Use</BaseButton>
      </BaseModalActions>
    </template>
  </BaseModal>
</template>

<script setup>
import { computed } from 'vue'
import { BaseButton, BaseInput, BaseModal, BaseModalActions, BaseModalCopy } from '@/components/ui'
import WorkspaceTemplateCanvasPreview from './WorkspaceTemplateCanvasPreview.vue'
import { getWorkspaceTemplateNodeCount } from '@/utils/workspaceTemplatePreview'

const props = defineProps({
  showRename: {
    type: Boolean,
    default: false
  },
  showDelete: {
    type: Boolean,
    default: false
  },
  showTemplatePreview: {
    type: Boolean,
    default: false
  },
  renameValue: {
    type: String,
    default: ''
  },
  deleteTargetName: {
    type: String,
    default: ''
  },
  previewTemplate: {
    type: Object,
    default: null
  }
})

const emit = defineEmits([
  'update:showRename',
  'update:showDelete',
  'update:showTemplatePreview',
  'update:renameValue',
  'confirmRename',
  'confirmDelete',
  'closeTemplatePreview',
  'useTemplateFromPreview'
])

const renameValueModel = computed({
  get: () => props.renameValue,
  set: (value) => emit('update:renameValue', value)
})

const templateNodeCount = computed(() => getWorkspaceTemplateNodeCount(props.previewTemplate?.canvasData))
</script>

<style scoped>
.template-preview {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.template-preview-media {
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: linear-gradient(180deg, #16171a 0%, #111215 100%);
}

.template-preview-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.template-preview-content {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 18px;
}

.template-preview-copy {
  min-width: 0;
}

.template-preview-copy h3 {
  margin: 0;
  font-size: 18px;
  line-height: 1.25;
}

.template-preview-stat {
  min-width: 0;
  padding: 0;
  border-radius: 0;
  border: none;
  background: transparent;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
}

.template-preview-stat strong {
  font-size: 22px;
  line-height: 1;
  color: #fff;
}

.template-preview-stat span {
  font-size: 11px;
  line-height: 1;
  text-transform: uppercase;
  color: rgba(236, 238, 244, 0.55);
}

.template-preview-owner {
  margin: 6px 0 0;
  color: rgba(236, 238, 244, 0.78);
  font-size: 13px;
}

.template-preview-description {
  margin: 10px 0 0;
  color: rgba(236, 238, 244, 0.66);
  font-size: 13px;
  line-height: 1.5;
}

@media (max-width: 640px) {
  .template-preview-content {
    grid-template-columns: 1fr;
  }

  .template-preview-stat {
    align-items: flex-start;
  }
}
</style>
