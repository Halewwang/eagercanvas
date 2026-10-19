<template>
  <div class="admin-user-actions" role="group" aria-label="账户管理操作">
    <AdminMicroButton icon="detail" @click="emit('open-detail')">查看详情</AdminMicroButton>
    <AdminMicroButton v-if="canManageRoles && !isSelf(user)" icon="settings" @click="emit('open-role-detail')">管理角色</AdminMicroButton>
    <AdminMicroButton v-if="canActivateService && user.service?.serviceStatus !== 'active'" icon="play" :disabled="!desktopActionsEnabled || !!serviceLoading[user.id] || user.status === 'deleted'" @click="emit('activate-service', user)">{{ user.service?.serviceStatus === 'disabled' ? '恢复服务' : '开通服务' }}</AdminMicroButton>
    <AdminMicroButton v-if="canDisableService && user.service?.serviceStatus === 'active'" icon="pause" :disabled="!desktopActionsEnabled || !!serviceLoading[user.id] || user.status === 'deleted'" @click="emit('disable-service', user)">暂停服务</AdminMicroButton>
    <template v-if="!isSelf(user)">
      <AdminMicroButton v-if="canManageUserStatus && user.status === 'active'" icon="pause" :disabled="!desktopActionsEnabled || !!statusLoading[user.id]" @click="emit('suspend-user', user)">暂停账户</AdminMicroButton>
      <AdminMicroButton v-if="canManageUserStatus && user.status === 'suspended'" icon="play" :disabled="!desktopActionsEnabled || !!statusLoading[user.id]" @click="emit('activate-user', user)">恢复账户</AdminMicroButton>
      <AdminMicroButton v-if="canArchiveUser && user.status !== 'deleted'" icon="trash" tone="danger" :disabled="!desktopActionsEnabled || !!deleting[user.id]" @click="emit('delete-user', user)">删除账户</AdminMicroButton>
      <AdminMicroButton v-if="canRestoreUser && user.status === 'deleted'" icon="play" :disabled="!desktopActionsEnabled || !!statusLoading[user.id]" @click="emit('restore-user', user)">恢复已删除账户</AdminMicroButton>
    </template>
  </div>
</template>

<script setup>
import { inject, ref } from 'vue'
import AdminMicroButton from '@/components/admin/AdminMicroButton.vue'
import { ADMIN_DESKTOP_ACTIONS_KEY } from '@/hooks/useAdminDesktopOnly'

const emit = defineEmits([
  'activate-service', 'activate-user', 'delete-user', 'disable-service',
  'open-detail', 'open-role-detail', 'restore-user', 'suspend-user'
])

const desktopActionsEnabled = inject(ADMIN_DESKTOP_ACTIONS_KEY, ref(false))

defineProps({
  canActivateService: { type: Boolean, default: false },
  canArchiveUser: { type: Boolean, default: false },
  canDisableService: { type: Boolean, default: false },
  canManageRoles: { type: Boolean, default: false },
  canManageUserStatus: { type: Boolean, default: false },
  canRestoreUser: { type: Boolean, default: false },
  deleting: { type: Object, default: () => ({}) },
  isSelf: { type: Function, required: true },
  serviceLoading: { type: Object, default: () => ({}) },
  statusLoading: { type: Object, default: () => ({}) },
  user: { type: Object, default: () => ({}) }
})
</script>

<style scoped>
.admin-user-actions { display: flex; flex-wrap: wrap; gap: 8px; }
</style>
