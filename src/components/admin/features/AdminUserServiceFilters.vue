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
      <AdminControlField tag="select" :value="serviceStatusFilter" @change="emitValue('update:serviceStatusFilter', $event)">
        <option value="all">全部</option><option value="active">已启用</option><option value="disabled">已暂停</option><option value="not_enabled">未开通</option>
      </AdminControlField>
    </AdminFilterField>
    <AdminFilterField class="col-span-2 md:col-span-2 xl:col-span-2" label="角色">
      <AdminControlField tag="select" :value="roleFilter" @change="emitValue('update:roleFilter', $event)">
        <option value="all">全部</option><option value="super_admin">超级管理员</option><option value="admin">管理员</option><option value="ops">运维</option><option value="support">客服</option><option value="user">普通用户</option>
      </AdminControlField>
    </AdminFilterField>
    <AdminFilterField class="col-span-2 md:col-span-2 xl:col-span-2" label="状态筛选">
      <AdminControlField tag="select" :value="statusFilter" @change="updateStatusFilter">
        <option value="all">全部</option>
        <option value="active">正常</option>
        <option value="suspended">已暂停</option>
        <option value="deleted">已删除</option>
      </AdminControlField>
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

const hasActiveFilters = computed(() => Boolean(props.searchQuery) || [
  props.statusFilter,
  props.serviceStatusFilter,
  props.roleFilter
].some((value) => value !== 'all'))

const emitValue = (name, event) => emit(name, event.target.value)

const updateSearchQuery = (event) => {
  emit('update:searchQuery', String(event.target.value || ''))
}

const updateStatusFilter = (event) => {
  emit('update:statusFilter', event.target.value)
}

const clearFilters = () => {
  emit('update:searchQuery', '')
  emit('update:statusFilter', 'all')
  emit('update:serviceStatusFilter', 'all')
  emit('update:roleFilter', 'all')
}
</script>
