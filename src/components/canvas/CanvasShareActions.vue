<template>
  <BaseModalActions>
    <BaseButton variant="ghost" @click="$emit('close')">Close</BaseButton>
    <BaseButton
      v-if="published"
      variant="secondary"
      :loading="actionLoading"
      @click="$emit('unpublish')"
    >
      Unpublish
    </BaseButton>
    <BaseButton
      :loading="actionLoading || statusLoading"
      @click="$emit('save')"
    >
      {{ published ? 'Update Template' : 'Publish Template' }}
    </BaseButton>
  </BaseModalActions>
</template>

<script setup>
import { BaseButton, BaseModalActions } from '@/components/ui'

defineProps({
  published: Boolean,
  actionLoading: Boolean,
  statusLoading: Boolean
})

defineEmits(['close', 'unpublish', 'save'])
</script>
