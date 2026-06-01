<template>
  <BaseModal
    :show="showError"
    title="Video Module Error"
    size="sm"
    @update:show="$emit('update:showError', $event)"
  >
    <BaseModalCopy class="whitespace-pre-wrap">{{ errorMessage }}</BaseModalCopy>
    <template #footer>
      <BaseModalActions>
        <BaseButton @click="$emit('closeError')">Close</BaseButton>
      </BaseModalActions>
    </template>
  </BaseModal>

  <BaseModal
    :show="showValidation"
    :title="validationTitle"
    size="sm"
    @update:show="$emit('update:showValidation', $event)"
  >
    <BaseModalCopy class="whitespace-pre-wrap">{{ validationMessage }}</BaseModalCopy>
    <template #footer>
      <BaseModalActions>
        <BaseButton @click="$emit('closeValidation')">OK</BaseButton>
      </BaseModalActions>
    </template>
  </BaseModal>
</template>

<script setup>
import { BaseButton, BaseModal, BaseModalActions, BaseModalCopy } from '@/components/ui'

defineProps({
  showError: Boolean,
  showValidation: Boolean,
  errorMessage: {
    type: String,
    default: ''
  },
  validationTitle: {
    type: String,
    default: 'Upload Limit'
  },
  validationMessage: {
    type: String,
    default: ''
  }
})

defineEmits(['update:showError', 'update:showValidation', 'closeError', 'closeValidation'])
</script>
