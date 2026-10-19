<template>
  <div class="admin-user-detail">
    <header class="admin-detail-header">
      <div>
        <AdminMicroButton icon="prev" @click="leaveDetail">返回用户列表</AdminMicroButton>
        <h1>{{ displayName }}</h1>
        <p>{{ user?.email ?? '--' }}</p>
      </div>
      <AdminMicroButton icon="refresh" :disabled="loading" @click="refreshDetail">{{ loading ? '刷新中…' : '刷新用户' }}</AdminMicroButton>
    </header>

    <p v-if="error" class="rounded-xl border border-red-300/20 bg-red-300/5 p-3 text-sm text-red-100" role="alert">{{ error }}</p>
    <nav class="admin-detail-tabs" aria-label="用户详情标签">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        type="button"
        class="admin-detail-tab"
        :class="{ 'is-active': activeTab === tab.key }"
        :aria-pressed="activeTab === tab.key"
        @click="activeTab = tab.key"
      >{{ tab.label }}</button>
    </nav>

    <section v-if="activeTab === 'summary'" aria-labelledby="admin-summary-title">
      <h2 id="admin-summary-title" class="admin-detail-section-title">账户摘要</h2>
      <dl class="admin-detail-summary">
        <div v-for="item in summaryItems" :key="item.label" class="admin-detail-summary-item">
          <dt>{{ item.label }}</dt>
          <dd>{{ item.value }}</dd>
        </div>
      </dl>
    </section>

    <section v-else-if="activeTab === 'roles'" class="admin-detail-panel" aria-labelledby="admin-roles-title">
      <h2 id="admin-roles-title" class="admin-detail-section-title">用户角色</h2>
      <p class="admin-detail-note">查看并调整此账户的管理权限。</p>
      <AdminRoleMultiSelect
        v-model="selectedRoles"
        :disabled="!isDesktop || !canMutateRoles || savingRoles"
        :is-super-admin-operator="isSuperAdminOperator"
      />
      <p v-if="isSelfTarget" class="admin-detail-note">不能修改当前登录账户的角色。</p>
      <p v-else-if="!canMutateRoles" class="admin-detail-note">当前权限仅支持查看此账户的角色。</p>
      <AdminDesktopOnlyAction :desktop-enabled="isDesktop" class="admin-detail-save">
        <template #default="{ disabled }">
          <AdminMicroButton
            v-if="canManageRoles"
            icon="save"
            tone="primary"
            :disabled="disabled || !canMutateRoles || savingRoles"
            @click="saveRoles"
          >
            {{ savingRoles ? '保存中…' : '保存角色' }}
          </AdminMicroButton>
        </template>
      </AdminDesktopOnlyAction>
    </section>

  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AdminDesktopOnlyAction, AdminMicroButton } from '@/components/admin'
import { AdminRoleMultiSelect } from '@/components/admin/features'
import { resolveAdminUserDetailTarget } from '@/hooks/adminAccessNavigation'
import { useAdminDesktopOnly } from '@/hooks/useAdminDesktopOnly'
import { useAdminUserDetail } from '@/hooks/useAdminUserDetail'
import { useAdminUserRoleMutation } from '@/hooks/useAdminUserRoleMutation'
import { getAdminSelfCheck } from '@/hooks/useAdminAccessStateCore'
import { useAuthStore } from '@/stores/auth'
import { formatAdminDateTime, formatAdminRoleList, getAdminServiceStatusLabel, getAdminUserStatusLabel } from '@/utils/adminDisplay'

const tabs = [
  { key: 'summary', label: '摘要' },
  { key: 'roles', label: '角色' }
]
const emit = defineEmits(['close'])
const props = defineProps({
  embedded: { type: Boolean, default: false },
  initialTab: { type: String, default: 'summary' },
  targetUserId: { type: String, default: '' }
})
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const detailTarget = computed(() => resolveAdminUserDetailTarget({
  targetUserId: props.targetUserId,
  routeUserId: route.params.userId,
  initialTab: props.initialTab
}))
const activeTab = ref(detailTarget.value.activeTab)
const { isDesktop } = useAdminDesktopOnly()

const userId = computed(() => detailTarget.value.userId)
const displayName = computed(() => user.value?.displayName ?? user.value?.email ?? '--')
const canManageRoles = computed(() => auth.hasPermission('admin.user.role.update'))
const isSuperAdminOperator = computed(() => auth.roles.value.includes('super_admin'))
const { error, loadDetail, loading, selectedRoles, user } = useAdminUserDetail()
const currentUserId = computed(() => auth.adminUser.value?.id || auth.user.value?.id || '')
const isSelfTarget = computed(() => getAdminSelfCheck(user.value, {
  adminUser: auth.adminUser.value,
  user: auth.user.value
}))
const canMutateRoles = computed(() => canManageRoles.value && !isSelfTarget.value && (
  isSuperAdminOperator.value || !user.value?.roles?.includes('super_admin')
))
const summaryItems = computed(() => [
  { label: '账号状态', value: getAdminUserStatusLabel(user.value?.status) },
  { label: '角色', value: formatAdminRoleList(user.value?.roles) },
  { label: '模型服务', value: getAdminServiceStatusLabel(user.value?.service?.serviceStatus) },
  { label: '创建时间', value: formatAdminDateTime(user.value?.createdAt) },
  { label: '最近登录', value: formatAdminDateTime(user.value?.lastLoginAt) }
])

const leaveDetail = () => {
  if (props.embedded) emit('close')
  else void router.push({ name: 'AdminUsers' })
}

const refreshDetail = () => loadDetail(userId.value)

const { saveRoles, savingRoles } = useAdminUserRoleMutation({
  canMutateRoles,
  canUseDesktopActions: isDesktop,
  currentUserId,
  error,
  refreshDetail,
  selectedRoles,
  targetUserId: userId
})

watch(() => detailTarget.value.activeTab, (tab) => { activeTab.value = tab })
watch(userId, () => void refreshDetail())
onMounted(refreshDetail)
</script>

<style scoped>
.admin-user-detail { display: grid; min-width: 0; gap: 20px; padding-bottom: 32px; }
.admin-detail-header { display: flex; flex-wrap: wrap; align-items: start; justify-content: space-between; gap: 16px; }
.admin-detail-header h1 { margin-top: 16px; color: rgba(255,255,255,.96); font-size: 24px; font-weight: 600; line-height: 1.3; overflow-wrap: anywhere; }
.admin-detail-header p { margin-top: 6px; color: rgba(255,255,255,.5); font-size: 13px; overflow-wrap: anywhere; }
.admin-detail-tabs { display: flex; flex-wrap: wrap; gap: 8px; }
.admin-detail-tab { min-height: 32px; border: 1px solid transparent; border-radius: 10px; padding: 6px 14px; color: rgba(255,255,255,.5); font-size: 13px; }
.admin-detail-tab.is-active { border-color: rgba(255,255,255,.18); background: rgba(255,255,255,.08); color: rgba(255,255,255,.94); }
.admin-detail-tab:focus-visible { outline: 2px solid rgba(255,255,255,.55); outline-offset: 2px; }
.admin-detail-section-title { color: rgba(255,255,255,.94); font-size: 15px; font-weight: 600; }
.admin-detail-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 16px; margin-top: 12px; }
.admin-detail-panel, .admin-detail-summary-item { min-width: 0; border: 1px solid rgba(255,255,255,.1); border-radius: 16px; padding: 18px; background: rgba(255,255,255,.025); }
.admin-detail-summary-item dt { color: rgba(255,255,255,.43); font-size: 12px; }
.admin-detail-summary-item dd { margin-top: 8px; color: rgba(255,255,255,.94); font-size: 14px; font-weight: 500; overflow-wrap: anywhere; }
.admin-detail-note { margin-top: 6px; color: rgba(255,255,255,.5); font-size: 12px; line-height: 1.5; }
.admin-detail-panel :deep(.admin-role-multi-select) { margin-top: 16px; }
.admin-detail-save { margin-top: 18px; border-top: 1px solid rgba(255,255,255,.08); padding-top: 16px; }
.admin-detail-save :deep(button) { justify-self: start; }
</style>
