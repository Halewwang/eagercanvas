<template>
  <BaseModal
    :show="show"
    title="Delete project"
    description="This action permanently removes the current canvas project."
    size="sm"
    @update:show="$emit('update:show', $event)"
  >
    <BaseModalCopy>Delete "{{ projectName }}"? This action cannot be undone.</BaseModalCopy>
    <template #footer>
      <BaseModalActions>
        <BaseButton variant="ghost" @click="$emit('update:show', false)">Cancel</BaseButton>
        <BaseButton variant="danger" @click="$emit('confirm')">Delete</BaseButton>
      </BaseModalActions>
    </template>
  </BaseModal>
</template>

<script setup>
import { BaseButton, BaseModal, BaseModalActions, BaseModalCopy } from '@/components/ui'

defineProps({
  show: Boolean,
  projectName: {
    type: String,
    default: ''
  }
})

defineEmits(['update:show', 'confirm'])
</script>
