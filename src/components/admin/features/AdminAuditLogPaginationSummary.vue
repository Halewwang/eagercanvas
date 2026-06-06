<template>
  <AdminPaginationBar
    :page="auditLogPage"
    :limit="auditLogLimit"
    :total="auditLogTotal"
    :loading="loading"
    @set-page="emit('set-page', $event)"
  />
</template>

<script setup>
import { computed } from 'vue'
import AdminPaginationBar from '@/components/admin/AdminPaginationBar.vue'

const emit = defineEmits(['set-page'])

const props = defineProps({
  loading: {
    type: Boolean,
    default: false
  },
  pagination: {
    type: Object,
    default: () => ({ page: 1, limit: 10, total: 0 })
  }
})

const auditLogPage = computed(() => Number(props.pagination?.page || 1))
const auditLogLimit = computed(() => Number(props.pagination?.limit || 10))
const auditLogTotal = computed(() => Number(props.pagination?.total || 0))
</script>
