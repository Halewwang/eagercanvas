<template>
  <div class="mb-4 grid grid-cols-1 gap-3 xl:grid-cols-[1fr_170px_auto] xl:items-end">
    <div>
      <p class="mb-2 text-xs uppercase tracking-[0.12em] text-white/45">搜索用户</p>
      <AdminControlField
        :value="searchQuery"
        placeholder="按用户 ID、邮箱或昵称搜索"
        @input="updateSearchQuery"
      />
    </div>
    <div>
      <p class="mb-2 text-xs uppercase tracking-[0.12em] text-white/45">状态筛选</p>
      <AdminControlField tag="select" :value="statusFilter" @change="updateStatusFilter">
        <option value="all">全部</option>
        <option value="active">正常</option>
        <option value="suspended">已暂停</option>
        <option value="deleted">已删除</option>
      </AdminControlField>
    </div>
    <AdminUserServiceFilterSummary
      :filtered-user-count="filteredUserCount"
      :user-page-end="userPageEnd"
      :user-page-start="userPageStart"
    />
  </div>
</template>

<script setup>
import AdminControlField from '@/components/admin/AdminControlField.vue'
import AdminUserServiceFilterSummary from './AdminUserServiceFilterSummary.vue'

const emit = defineEmits([
  'update:searchQuery',
  'update:statusFilter'
])

defineProps({
  filteredUserCount: {
    type: Number,
    default: 0
  },
  searchQuery: {
    type: String,
    default: ''
  },
  statusFilter: {
    type: String,
    default: 'all'
  },
  userPageEnd: {
    type: Number,
    default: 0
  },
  userPageStart: {
    type: Number,
    default: 0
  }
})

const updateSearchQuery = (event) => {
  emit('update:searchQuery', String(event.target.value || '').trim())
}

const updateStatusFilter = (event) => {
  emit('update:statusFilter', event.target.value)
}
</script>
