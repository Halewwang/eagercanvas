<template>
  <AdminUserDetail
    v-if="accessFocus"
    :target-user-id="accessFocus.targetUserId"
    :initial-tab="accessFocus.initialTab"
    embedded
    @close="closeAccessFocus"
  />
  <div v-else class="space-y-5 pb-8">
    <header class="admin-users-header">
      <div>
        <h1>注册用户</h1>
        <p>开通服务后可使用全部文字、图片和视频模型。</p>
      </div>
      <div class="admin-users-header-actions">
        <AdminMicroButton :disabled="loadingUsers" @click="loadUsers">{{ loadingUsers ? '刷新中…' : '刷新用户' }}</AdminMicroButton>
        <AdminMicroButton icon="home" @click="router.push('/')">返回首页</AdminMicroButton>
      </div>
    </header>
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
    <p v-if="!isDesktop" class="text-xs text-white/45">手机端仅支持查看，请在电脑上管理用户。</p>
    <div v-if="users.length" class="admin-users-grid" aria-label="注册用户列表">
      <AdminUserCard v-for="user in users" :key="user.id" :user="user">
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
      </AdminUserCard>
    </div>
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
import { AdminEmptyState, AdminMicroButton } from '@/components/admin'
import {
  AdminUserMutationDialog, AdminUserOperationsCell, AdminUserServiceFilters, AdminUserServicePagination
} from '@/components/admin/features'
import { useAdminAccessState } from '@/hooks/useAdminAccessState'
import { ADMIN_DESKTOP_ACTIONS_KEY, useAdminDesktopOnly } from '@/hooks/useAdminDesktopOnly'
import { buildAdminUserDetailTarget } from '@/hooks/adminAccessNavigation'
import { useAdminUsersAccessFocus } from '@/hooks/useAdminUsersAccessFocus'
import { useAdminUserActions } from '@/hooks/useAdminUserActions'
import { useAdminUsersState } from '@/hooks/useAdminUsersState'
import { useAuthStore } from '@/stores/auth'
import AdminUserCard from '@/components/admin/features/AdminUserCard.vue'
import AdminUserDetail from './AdminUserDetail.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const { isDesktop } = useAdminDesktopOnly()
provide(ADMIN_DESKTOP_ACTIONS_KEY, isDesktop)
const accessState = useAdminAccessState({ auth })
const {
  canActivateService, canArchiveUser, canDisableService, canManageRoles,
  canManageUserStatus, canReadUsers, canRestoreUser, isSelf
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

<style scoped>
.admin-users-header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; }
.admin-users-header h1 { color: rgba(255,255,255,.96); font-size: 24px; font-weight: 600; line-height: 1.3; }
.admin-users-header p { margin-top: 6px; color: rgba(255,255,255,.5); font-size: 13px; }
.admin-users-header-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.admin-users-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr)); gap: 16px; }
</style>
