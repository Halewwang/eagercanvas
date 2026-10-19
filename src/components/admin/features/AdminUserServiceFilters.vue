<template>
  <div class="mb-4 grid grid-cols-4 gap-4 md:grid-cols-8 xl:grid-cols-12 xl:items-end">
    <AdminFilterField class="col-span-4 md:col-span-4 xl:col-span-4" label="搜索用户">
      <AdminControlField
        :value="searchQuery"
        placeholder="按邮箱搜索"
        @input="updateSearchQuery"
      />
    </AdminFilterField>
    <AdminFilterField class="col-span-2 md:col-span-2 xl:col-span-2" label="服务状态">
      <BaseSelect :model-value="serviceStatusFilter" :options="serviceStatusOptions" aria-label="服务状态" @update:model-value="emit('update:serviceStatusFilter', $event)" />
    </AdminFilterField>
    <AdminFilterField class="col-span-2 md:col-span-2 xl:col-span-2" label="角色">
      <BaseSelect :model-value="roleFilter" :options="roleOptions" aria-label="角色" @update:model-value="emit('update:roleFilter', $event)" />
    </AdminFilterField>
    <AdminFilterField class="col-span-2 md:col-span-2 xl:col-span-2" label="状态筛选">
      <BaseSelect :model-value="statusFilter" :options="statusOptions" aria-label="状态筛选" @update:model-value="emit('update:statusFilter', $event)" />
    </AdminFilterField>
    <AdminUserServiceFilterSummary
      class="col-span-full"
      :total-users="totalUsers"
      :user-page-end="userPageEnd"
      :user-page-start="userPageStart"
    />
    <AdminMicroButton v-if="hasActiveFilters" class="col-span-2" block @click="clearFilters">清除筛选</AdminMicroButton>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { BaseSelect } from '@/components/ui'
import AdminControlField from '@/components/admin/AdminControlField.vue'
import AdminFilterField from '@/components/admin/AdminFilterField.vue'
import AdminMicroButton from '@/components/admin/AdminMicroButton.vue'
import AdminUserServiceFilterSummary from './AdminUserServiceFilterSummary.vue'

const emit = defineEmits([
  'update:searchQuery',
  'update:roleFilter',
  'update:serviceStatusFilter',
  'update:statusFilter'
])

const props = defineProps({
  totalUsers: {
    type: Number,
    default: 0
  },
  roleFilter: { type: String, default: 'all' },
  searchQuery: {
    type: String,
    default: ''
  },
  serviceStatusFilter: { type: String, default: 'all' },
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

const serviceStatusOptions = [
  { value: 'all', label: '全部' },
  { value: 'active', label: '已启用' },
  { value: 'disabled', label: '已暂停' },
  { value: 'not_enabled', label: '未开通' }
]
const roleOptions = [
  { value: 'all', label: '全部' },
  { value: 'super_admin', label: '超级管理员' },
  { value: 'admin', label: '管理员' },
  { value: 'ops', label: '运维' },
  { value: 'support', label: '客服' },
  { value: 'user', label: '普通用户' }
]
const statusOptions = [
  { value: 'all', label: '全部' },
  { value: 'active', label: '正常' },
  { value: 'suspended', label: '已暂停' },
  { value: 'deleted', label: '已删除' }
]

const hasActiveFilters = computed(() => Boolean(props.searchQuery) || [
  props.statusFilter,
  props.serviceStatusFilter,
  props.roleFilter
].some((value) => value !== 'all'))

const updateSearchQuery = (event) => {
  emit('update:searchQuery', String(event.target.value || ''))
}

const clearFilters = () => {
  emit('update:searchQuery', '')
  emit('update:statusFilter', 'all')
  emit('update:serviceStatusFilter', 'all')
  emit('update:roleFilter', 'all')
}
</script>
