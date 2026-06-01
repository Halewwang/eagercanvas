<template>
  <BaseModal
    :show="show"
    title="Sync conflict"
    description="This canvas has newer changes elsewhere. Choose how to continue."
    size="md"
    :close-on-overlay="false"
    @update:show="$emit('update:show', $event)"
  >
    <BaseModalCopy>
      Your current canvas is still saved on this device. Nothing has been cleared.
    </BaseModalCopy>
    <template #footer>
      <BaseModalActions class="conflict-actions">
        <BaseButton
          variant="ghost"
          :disabled="!!action"
          @click="$emit('cancel')"
        >
          Cancel
        </BaseButton>
        <BaseButton
          variant="secondary"
          :loading="action === 'copy'"
          :disabled="!!action && action !== 'copy'"
          @click="$emit('saveCopy')"
        >
          Save as copy
        </BaseButton>
        <BaseButton
          variant="secondary"
          :loading="action === 'refresh'"
          :disabled="!!action && action !== 'refresh'"
          @click="$emit('refresh')"
        >
          Refresh remote
        </BaseButton>
        <BaseButton
          variant="danger"
          :loading="action === 'overwrite'"
          :disabled="!!action && action !== 'overwrite'"
          @click="$emit('overwrite')"
        >
          Overwrite remote
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

defineEmits([
  'update:show',
  'cancel',
  'saveCopy',
  'refresh',
  'overwrite'
])
</script>

<style scoped>
.conflict-actions {
  flex-wrap: wrap;
}

.conflict-actions :deep(.ui-button-text) {
  flex: 1 1 132px;
  min-width: 0;
}
</style>
