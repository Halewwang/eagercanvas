<template>
  <BaseModal
    :show="show"
    title="Text Module Error"
    size="sm"
    @update:show="$emit('update:show', $event)"
  >
    <BaseModalCopy class="whitespace-pre-wrap">{{ errorMessage }}</BaseModalCopy>
    <template #footer>
      <BaseModalActions>
        <BaseButton @click="$emit('close')">Close</BaseButton>
      </BaseModalActions>
    </template>
  </BaseModal>
</template>

<script setup>
import { BaseButton, BaseModal, BaseModalActions, BaseModalCopy } from '@/components/ui'

defineProps({
  show: Boolean,
  errorMessage: {
    type: String,
    default: ''
  }
})

defineEmits(['update:show', 'close'])
</script>
