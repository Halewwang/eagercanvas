<template>
  <BaseModal
    :show="show"
    title="Load cloud version"
    description="Replace this canvas with the latest saved cloud version."
    size="sm"
    :close-on-overlay="action !== 'refresh'"
    @update:show="$emit('update:show', $event)"
  >
    <BaseModalCopy>
      Unsynced local draft changes on this device will be replaced by the cloud version.
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
          Load cloud
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
