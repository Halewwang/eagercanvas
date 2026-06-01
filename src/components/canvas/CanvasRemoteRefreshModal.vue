<template>
  <BaseModal
    :show="show"
    title="Refresh from cloud"
    description="Load the latest saved cloud canvas for this project."
    size="sm"
    :close-on-overlay="action !== 'refresh'"
    @update:show="$emit('update:show', $event)"
  >
    <BaseModalCopy>
      Local draft changes on this device will be replaced by the cloud version.
    </BaseModalCopy>
    <template #footer>
      <BaseModalActions>
        <BaseButton
          variant="ghost"
          :disabled="action === 'refresh'"
          @click="$emit('update:show', false)"
        >
          Cancel
        </BaseButton>
        <BaseButton
          :loading="action === 'refresh'"
          @click="$emit('confirm')"
        >
          Refresh cloud
        </BaseButton>
      </BaseModalActions>
    </template>
  </BaseModal>
</template>

<script setup>
import { BaseButton, BaseModal, BaseModalActions, BaseModalCopy } from '@/components/ui'

defineProps({
  show: Boolean,
  action: {
    type: String,
    default: ''
  }
})

defineEmits(['update:show', 'confirm'])
</script>
