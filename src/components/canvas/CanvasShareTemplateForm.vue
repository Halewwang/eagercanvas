<template>
  <CanvasShareSection
    title="Template Details"
    copy="Other members will see this in Featured Templates and can create their own copy from it."
    form
  >
    <BaseInput
      :model-value="templateName"
      placeholder="Template title"
      @update:model-value="$emit('update:templateName', $event)"
    />
    <textarea
      :value="templateDescription"
      placeholder="Template description"
      rows="4"
      class="share-textarea ui-body"
      @input="$emit('update:templateDescription', $event.target.value)"
    />
  </CanvasShareSection>
</template>

<script setup>
import { BaseInput } from '@/components/ui'
import CanvasShareSection from './CanvasShareSection.vue'

defineProps({
  templateName: {
    type: String,
    default: ''
  },
  templateDescription: {
    type: String,
    default: ''
  }
})

defineEmits(['update:templateName', 'update:templateDescription'])
</script>

<style scoped>
.share-textarea {
  min-height: 96px;
  width: 100%;
  resize: none;
  border-radius: 18px;
  border: 1px solid var(--border);
  background: var(--surface);
  padding: 14px 16px;
  color: var(--text);
  outline: none;
  transition: all 0.2s ease;
}

.share-textarea::placeholder {
  color: var(--text-soft);
}

.share-textarea:focus {
  border-color: var(--border-strong);
  background: var(--surface-2);
}
</style>
