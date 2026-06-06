<template>
  <AdminPaginationBar
    v-if="totalUserPages > 1"
    :page="userPage"
    :total-pages="totalUserPages"
    :visible-pages="visibleUserPages"
    item-label="位用户"
    @set-page="emit('set-user-page', $event)"
  />
</template>

<script setup>
import AdminPaginationBar from '@/components/admin/AdminPaginationBar.vue'

const emit = defineEmits(['set-user-page'])

defineProps({
  totalUserPages: {
    type: Number,
    default: 1
  },
  userPage: {
    type: Number,
    default: 1
  },
  visibleUserPages: {
    type: Array,
    default: () => []
  }
})
</script>
