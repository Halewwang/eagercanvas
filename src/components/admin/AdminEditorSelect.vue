<template>
  <AdminControlField
    tag="select"
    :value="value"
    class="admin-editor-select"
    :disabled="disabled"
    @change="$emit('change', $event)"
  >
    <slot />
  </AdminControlField>
</template>

<script setup>
import AdminControlField from './AdminControlField.vue'

defineEmits(['change'])

defineProps({
  value: {
    type: [String, Number],
    default: ''
  },
  disabled: {
    type: Boolean,
    default: false
  }
})
</script>

<style scoped>
.admin-editor-select {
  width: 100%;
  min-width: 180px;
}
</style>
