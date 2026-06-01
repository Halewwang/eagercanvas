<template>
  <AdminEmptyState>
    {{ users.length === 0 ? '暂无用户数据' : '没有匹配的用户' }}
  </AdminEmptyState>
</template>

<script setup>
import AdminEmptyState from '@/components/admin/AdminEmptyState.vue'

defineProps({
  users: {
    type: Array,
    default: () => []
  }
})
</script>
