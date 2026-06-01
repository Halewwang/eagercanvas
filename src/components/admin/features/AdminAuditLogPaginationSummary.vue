<template>
  <p class="mt-3 text-xs text-white/45">
    第 {{ pagination.page }} 页 · 每页 {{ pagination.limit }} 条 · 共 {{ pagination.total }} 条
  </p>
</template>

<script setup>
defineProps({
  pagination: {
    type: Object,
    default: () => ({ page: 1, limit: 20, total: 0 })
  }
})
</script>
