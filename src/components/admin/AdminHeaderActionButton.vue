<template>
  <AdminMicroButton size="md" class="whitespace-nowrap" :disabled="disabled" @click="$emit('click')">
    <slot />
  </AdminMicroButton>
</template>

<script setup>
import AdminMicroButton from './AdminMicroButton.vue'

defineEmits(['click'])

defineProps({
  disabled: {
    type: Boolean,
    default: false
  }
})
</script>
