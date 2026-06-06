<template>
  <div class="admin-filter-toolbar" :class="toolbarClasses">
    <slot />
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  align: {
    type: String,
    default: 'start',
    validator: (value) => ['start', 'end'].includes(value)
  },
  compact: {
    type: Boolean,
    default: false
  }
})

const toolbarClasses = computed(() => ({
  'admin-filter-toolbar-end': props.align === 'end',
  'admin-filter-toolbar-compact': props.compact
}))
</script>

<style scoped>
.admin-filter-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: flex-start;
  gap: 12px;
  min-width: 0;
  max-width: 100%;
}

.admin-filter-toolbar-end {
  justify-content: flex-end;
}

.admin-filter-toolbar-compact {
  gap: 10px;
}

.admin-filter-toolbar :deep(.admin-filter-field) {
  flex: 1 1 160px;
}

.admin-filter-toolbar-compact :deep(.admin-filter-field) {
  flex: 0 1 150px;
}

.admin-filter-toolbar :deep(.ui-number-input) {
  width: 100%;
  max-width: 96px;
}

.admin-filter-toolbar :deep(.ui-micro-btn) {
  flex: 0 0 auto;
}

@media (max-width: 640px) {
  .admin-filter-toolbar {
    width: 100%;
    align-items: stretch;
  }

  .admin-filter-toolbar :deep(.admin-filter-field) {
    flex: 1 1 100%;
  }

  .admin-filter-toolbar :deep(.ui-micro-btn) {
    width: 100%;
  }
}
</style>
