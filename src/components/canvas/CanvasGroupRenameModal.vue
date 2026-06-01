<template>
  <BaseModal
    :show="show"
    title="Rename group"
    description="Update the selected group label."
    size="sm"
    @update:show="$emit('update:show', $event)"
  >
    <BaseInput
      :model-value="value"
      placeholder="Enter group name"
      @update:model-value="$emit('update:value', $event)"
      @keyup.enter="$emit('confirm')"
    />
    <template #footer>
      <BaseModalActions>
        <BaseButton variant="ghost" @click="$emit('update:show', false)">Cancel</BaseButton>
        <BaseButton @click="$emit('confirm')">Save</BaseButton>
      </BaseModalActions>
    </template>
  </BaseModal>
</template>

<script setup>
import { BaseButton, BaseInput, BaseModal, BaseModalActions } from '@/components/ui'

defineProps({
  show: Boolean,
  value: {
    type: String,
    default: ''
  }
})

defineEmits(['update:show', 'update:value', 'confirm'])
</script>
