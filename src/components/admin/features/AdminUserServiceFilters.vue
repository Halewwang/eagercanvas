<template>
  <div class="mb-4 grid grid-cols-1 gap-3 xl:grid-cols-[1fr_170px_auto_auto] xl:items-end">
    <AdminFilterField label="搜索用户">
      <AdminControlField
        :value="searchQuery"
        placeholder="按用户 ID、邮箱或昵称搜索"
        @input="updateSearchQuery"
      />
    </AdminFilterField>
    <AdminFilterField label="状态筛选">
      <AdminControlField tag="select" :value="statusFilter" @change="updateStatusFilter">
        <option value="all">全部</option>
        <option value="active">正常</option>
        <option value="suspended">已暂停</option>
        <option value="deleted">已删除</option>
      </AdminControlField>
    </AdminFilterField>
    <AdminUserServiceFilterSummary
      :filtered-user-count="filteredUserCount"
      :user-page-end="userPageEnd"
      :user-page-start="userPageStart"
    />
    <AdminMicroButton v-if="hasActiveFilters" block @click="clearFilters">清除筛选</AdminMicroButton>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import AdminControlField from '@/components/admin/AdminControlField.vue'
import AdminFilterField from '@/components/admin/AdminFilterField.vue'
import AdminMicroButton from '@/components/admin/AdminMicroButton.vue'
import AdminUserServiceFilterSummary from './AdminUserServiceFilterSummary.vue'

const emit = defineEmits([
  'update:searchQuery',
  'update:statusFilter'
])

const props = defineProps({
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

const hasActiveFilters = computed(() => Boolean(props.searchQuery) || props.statusFilter !== 'all')

const updateSearchQuery = (event) => {
  emit('update:searchQuery', String(event.target.value || '').trim())
}

const updateStatusFilter = (event) => {
  emit('update:statusFilter', event.target.value)
}

const clearFilters = () => {
  emit('update:searchQuery', '')
  emit('update:statusFilter', 'all')
}
</script>
