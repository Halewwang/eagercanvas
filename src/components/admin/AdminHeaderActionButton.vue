<template>
  <AdminMicroButton
    size="md"
    class="whitespace-nowrap"
    :icon="HomeOutline"
    :disabled="disabled"
    @click="$emit('click')"
  >
    <slot />
  </AdminMicroButton>
</template>

<script setup>
import AdminMicroButton from './AdminMicroButton.vue'
import { HomeOutline } from '@/icons/coolicons'

defineEmits(['click'])

defineProps({
  disabled: {
    type: Boolean,
    default: false
  }
})
</script>
