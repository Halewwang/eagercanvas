<template>
  <AdminUserDetail
    v-if="accessFocus"
    :target-user-id="accessFocus.targetUserId"
    :initial-tab="accessFocus.initialTab"
    embedded
    @close="closeAccessFocus"
  />
  <div v-else class="space-y-5 pb-8">
    <AdminPageHeader :display-name="displayName" :access-scope="accessScope" @go-home="router.push('/')" />
    <AdminUserServiceHeader :loading-users="loadingUsers" @refresh-users="loadUsers" />
    <p class="text-sm text-white/50">开通服务后，用户即可使用全部文字、图片和视频模型。</p>
    <AdminUserServiceFilters
      v-model:search-query="userSearchQuery"
      v-model:status-filter="userStatusFilter"
      v-model:service-status-filter="userServiceStatusFilter"
      v-model:role-filter="userRoleFilter"
      :total-users="pagination.total"
      :user-page-start="userPageStart"
      :user-page-end="userPageEnd"
    />
    <AdminEmptyState v-if="!users.length">{{ loadingUsers ? '正在加载用户…' : '暂无符合条件的注册用户' }}</AdminEmptyState>
    <AdminTableShell v-else min-width-class="min-w-[760px]">
      <template #header>
        <th class="px-3 py-3">用户</th>
        <th class="px-3 py-3">注册时间</th>
        <th class="px-3 py-3">最近登录</th>
        <th class="px-3 py-3">操作</th>
      </template>
      <template #default="{ rowClass }">
        <tr v-for="user in users" :key="user.id" :class="rowClass">
          <AdminUserIdentityCell
            :user="user"
            :role-label="getAdminRoleLabel"
            :service-status-label="getAdminServiceStatusLabel"
            :status-class="getAdminUserStatusClass"
            :status-label="getAdminUserStatusLabel"
            @open-detail="openDetail(user)"
          />
          <td class="px-3 py-4 text-xs text-white/55">{{ formatAdminDateTime(user.createdAt) }}</td>
          <td class="px-3 py-4 text-xs text-white/55">{{ formatAdminDateTime(user.lastLoginAt) }}</td>
          <AdminUserOperationsCell
            :user="user"
            :can-activate-service="canActivateService"
            :can-archive-user="canArchiveUser"
            :can-disable-service="canDisableService"
            :can-manage-roles="canManageRoles"
            :can-manage-user-status="canManageUserStatus"
            :can-restore-user="canRestoreUser"
            :deleting="deleting"
            :is-self="isSelf"
            :service-loading="serviceLoading"
            :status-loading="statusLoading"
            @open-detail="openDetail(user)"
            @open-role-detail="openDetail(user, 'roles')"
            @activate-service="activateService"
            @activate-user="activateUser"
            @delete-user="deleteUser"
            @disable-service="disableService"
            @restore-user="restoreUser"
            @suspend-user="suspendUser"
          />
        </tr>
      </template>
    </AdminTableShell>
    <AdminUserServicePagination :user-page="userPage" :total-user-pages="totalUserPages" :visible-user-pages="visibleUserPages" @set-user-page="setUserPage" />
    <AdminUserMutationDialog
      :show="mutationDialogVisible"
      :desktop-enabled="isDesktop"
      :action="mutationDialogAction"
      :user="mutationDialogUser"
      :loading="mutationSubmitting"
      @close="closeMutationDialog"
      @submit="submitMutation"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, provide } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AdminEmptyState, AdminPageHeader, AdminTableShell } from '@/components/admin'
import {
  AdminUserIdentityCell, AdminUserMutationDialog, AdminUserOperationsCell,
  AdminUserServiceFilters, AdminUserServiceHeader, AdminUserServicePagination
} from '@/components/admin/features'
import { useAdminAccessState } from '@/hooks/useAdminAccessState'
import { ADMIN_DESKTOP_ACTIONS_KEY, useAdminDesktopOnly } from '@/hooks/useAdminDesktopOnly'
import { buildAdminUserDetailTarget } from '@/hooks/adminAccessNavigation'
import { useAdminUsersAccessFocus } from '@/hooks/useAdminUsersAccessFocus'
import { useAdminUserActions } from '@/hooks/useAdminUserActions'
import { useAdminUsersState } from '@/hooks/useAdminUsersState'
import { useAuthStore } from '@/stores/auth'
import {
  formatAdminDateTime, getAdminRoleLabel, getAdminServiceStatusLabel,
  getAdminUserStatusClass, getAdminUserStatusLabel
} from '@/utils/adminDisplay'
import AdminUserDetail from './AdminUserDetail.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const { isDesktop } = useAdminDesktopOnly()
provide(ADMIN_DESKTOP_ACTIONS_KEY, isDesktop)
const accessState = useAdminAccessState({ auth })
const {
  accessScope, canActivateService, canArchiveUser, canDisableService, canManageRoles,
  canManageUserStatus, canReadUsers, canRestoreUser, displayName, isSelf
} = accessState
const {
  loadUsers, loadingUsers, pagination, setUserPage, totalUserPages, userPage, userPageEnd,
  userPageStart, userRoleFilter, userSearchQuery, userServiceStatusFilter, userStatusFilter,
  users, visibleUserPages
} = useAdminUsersState({ canReadUsers })
const { accessFocus, closeAccessFocus, loadUsersForCurrentView } = useAdminUsersAccessFocus({
  routeQuery: computed(() => route.query),
  routerReplace: (target) => router.replace(target),
  loadUsers
})
const {
  activateService, activateUser, closeMutationDialog, deleteUser, deleting, disableService,
  mutationDialogAction, mutationDialogUser, mutationDialogVisible, mutationSubmitting,
  restoreUser, serviceLoading, statusLoading, submitMutation, suspendUser
} = useAdminUserActions({
  ...accessState,
  canUseDesktopActions: isDesktop,
  isSelf,
  loadUsers
})
const openDetail = (user, tab = 'summary') => router.push(buildAdminUserDetailTarget(user.id, tab))
onMounted(() => { void loadUsersForCurrentView() })
</script>
