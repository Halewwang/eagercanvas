<template>
  <AdminMicroButton
    tone="primary"
    class="admin-editor-main"
    :icon="icon"
    :disabled="disabled"
    @click="$emit('click')"
  >
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
  },
  icon: {
    type: [Object, Function, String],
    default: ''
  }
})
</script>

<style scoped>
.admin-editor-main {
  width: 100%;
}
</style>
