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
      <div class="template-preview-media">
        <img
          v-if="previewTemplate.thumbnail || previewTemplate.cover || previewTemplate.coverUrl"
          :src="previewTemplate.thumbnail || previewTemplate.cover || previewTemplate.coverUrl"
          :alt="previewTemplate.title || previewTemplate.name"
        />
        <div v-else class="template-preview-fallback">No cover</div>
      </div>
      <div class="template-preview-content">
        <h3>{{ previewTemplate.title || previewTemplate.name }}</h3>
        <p class="template-preview-owner">{{ String(previewTemplate.ownerDisplayName || '').trim() || 'Unknown user' }}</p>
        <p class="template-preview-description">{{ String(previewTemplate.description || '').trim() || 'No description provided.' }}</p>
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

.template-preview-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(236, 238, 244, 0.6);
  font-size: 14px;
}

.template-preview-content h3 {
  margin: 0;
  font-size: 18px;
  line-height: 1.25;
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
</style>
