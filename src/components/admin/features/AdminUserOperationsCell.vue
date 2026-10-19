<template>
  <td class="admin-user-operations-cell px-3 py-4">
    <NPopover
      v-model:show="menuVisible"
      trigger="click"
      placement="bottom-end"
      :show-arrow="false"
      raw
      @update:show="focusMenu"
    >
      <template #trigger>
        <button
          ref="triggerRef"
          type="button"
          class="admin-user-operations-trigger"
          aria-label="用户操作"
          title="用户操作"
          aria-haspopup="true"
          :aria-expanded="menuVisible"
          @keydown.esc.stop.prevent="closeMenu"
        >
          <EllipsisHorizontalOutline aria-hidden="true" />
        </button>
      </template>
      <div ref="menuRef" class="admin-user-operations-menu" @keydown.esc.stop.prevent="closeMenu" @click="menuVisible = false">
        <section class="admin-operation-group">
          <p class="admin-operation-group-label">详情与角色</p>
          <AdminMicroButton icon="detail" block @click="emit('open-detail')">查看详情</AdminMicroButton>
          <AdminMicroButton v-if="canManageRoles && !isSelf(user)" icon="settings" block @click="emit('open-role-detail')">管理角色</AdminMicroButton>
        </section>
        <section v-if="canActivateService || canDisableService" class="admin-operation-group">
          <p class="admin-operation-group-label">模型服务</p>
          <AdminMicroButton v-if="canActivateService && user.service?.serviceStatus !== 'active'" icon="play" block :disabled="!desktopActionsEnabled || !!serviceLoading[user.id] || user.status === 'deleted'" @click="emit('activate-service', user)">{{ user.service?.serviceStatus === 'disabled' ? '恢复服务' : '开通服务' }}</AdminMicroButton>
          <AdminMicroButton v-if="canDisableService && user.service?.serviceStatus === 'active'" icon="pause" block :disabled="!desktopActionsEnabled || !!serviceLoading[user.id] || user.status === 'deleted'" @click="emit('disable-service', user)">暂停服务</AdminMicroButton>
        </section>
        <section v-if="!isSelf(user)" class="admin-operation-group">
          <p class="admin-operation-group-label">账户状态</p>
          <AdminMicroButton v-if="canManageUserStatus && user.status === 'active'" icon="pause" block :disabled="!desktopActionsEnabled || !!statusLoading[user.id]" @click="emit('suspend-user', user)">暂停用户</AdminMicroButton>
          <AdminMicroButton v-if="canManageUserStatus && user.status === 'suspended'" icon="play" block :disabled="!desktopActionsEnabled || !!statusLoading[user.id]" @click="emit('activate-user', user)">恢复状态</AdminMicroButton>
          <AdminMicroButton v-if="canArchiveUser && user.status !== 'deleted'" icon="trash" tone="danger" block :disabled="!desktopActionsEnabled || !!deleting[user.id]" @click="emit('delete-user', user)">删除账户</AdminMicroButton>
          <AdminMicroButton v-if="canRestoreUser && user.status === 'deleted'" icon="play" block :disabled="!desktopActionsEnabled || !!statusLoading[user.id]" @click="emit('restore-user', user)">恢复已删除账户</AdminMicroButton>
        </section>
      </div>
    </NPopover>
  </td>
</template>

<script setup>
import { inject, nextTick, ref } from 'vue'
import { NPopover } from 'naive-ui'
import AdminMicroButton from '@/components/admin/AdminMicroButton.vue'
import { ADMIN_DESKTOP_ACTIONS_KEY } from '@/hooks/useAdminDesktopOnly'
import { EllipsisHorizontalOutline } from '@/icons/coolicons'

const emit = defineEmits([
  'activate-service', 'activate-user', 'delete-user', 'disable-service',
  'open-detail', 'open-role-detail', 'restore-user', 'suspend-user'
])

const menuVisible = ref(false)
const triggerRef = ref(null)
const menuRef = ref(null)
const focusMenu = async (show) => {
  if (!show) return
  await nextTick()
  menuRef.value?.querySelector('button:not(:disabled)')?.focus()
}
const closeMenu = () => {
  menuVisible.value = false
  triggerRef.value?.focus()
}

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
.admin-user-operations-cell { position: relative; width: 56px; min-width: 56px; }
.admin-user-operations-trigger { width: 36px; height: 36px; display: grid; place-items: center; cursor: pointer; list-style: none; border: 1px solid rgba(255,255,255,.12); border-radius: 9px; background: rgba(255,255,255,.06); color: rgba(255,255,255,.78); }
.admin-user-operations-trigger svg { width: 18px; height: 18px; }
.admin-user-operations-menu { display: grid; width: min(288px, calc(100vw - 32px)); max-height: 70vh; overflow-y: auto; border: 1px solid rgba(255,255,255,.12); border-radius: 14px; background: #171719; box-shadow: 0 18px 45px rgba(0,0,0,.38); }
.admin-operation-group { display: grid; gap: 6px; padding: 8px; border-top: 1px solid rgba(255,255,255,.08); }
.admin-operation-group:first-child { border-top: 0; }
.admin-operation-group-label { min-width: 0; color: rgba(255,255,255,.45); font-size: 11px; }
</style>
