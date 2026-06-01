<template>
  <div class="mb-4 flex flex-wrap gap-2 lg:hidden">
    <AdminMicroButton
      v-for="item in navItems"
      :key="`mobile-${item.key}`"
      :active="activeSection === item.key"
      @click="$emit('select-section', item.key)"
    >
      {{ item.label }}
    </AdminMicroButton>
  </div>
</template>

<script setup>
import AdminMicroButton from './AdminMicroButton.vue'

defineEmits(['select-section'])

defineProps({
  navItems: {
    type: Array,
    default: () => []
  },
  activeSection: {
    type: String,
    default: 'overview'
  }
})
</script>
