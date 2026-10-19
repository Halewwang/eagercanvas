<template>
  <div class="grid grid-cols-4 gap-4 pb-8 md:grid-cols-8 xl:grid-cols-12">
    <header class="col-span-full flex flex-wrap items-start justify-between gap-3">
      <div>
        <button type="button" class="text-xs text-cyan-100/70" @click="leaveDetail">← 返回用户列表</button>
        <h1 class="mt-2 text-2xl font-semibold text-white">{{ displayName }}</h1>
        <p class="mt-1 text-sm text-white/50">{{ user?.email ?? '--' }}</p>
      </div>
      <button type="button" class="rounded-lg bg-white/5 px-3 py-2 text-xs text-white/70" :disabled="loading" @click="refreshDetail">刷新</button>
    </header>

    <p v-if="error" class="col-span-full rounded-xl border border-red-300/20 bg-red-300/5 p-3 text-sm text-red-100">{{ error }}</p>
    <nav class="col-span-full flex gap-2 overflow-x-auto border-b border-white/10" aria-label="用户详情标签">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        type="button"
        class="whitespace-nowrap border-b-2 px-3 py-2 text-sm"
        :class="activeTab === tab.key ? 'border-cyan-300 text-white' : 'border-transparent text-white/45'"
        @click="activeTab = tab.key"
      >{{ tab.label }}</button>
    </nav>

    <section v-if="activeTab === 'summary'" class="col-span-full grid grid-cols-4 gap-4 md:grid-cols-8 xl:grid-cols-12">
      <article v-for="item in summaryItems" :key="item.label" class="col-span-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:col-span-4 xl:col-span-3">
        <p class="text-xs text-white/40">{{ item.label }}</p>
        <p class="mt-2 break-words text-sm font-semibold text-white">{{ item.value }}</p>
      </article>
    </section>

    <section v-else-if="activeTab === 'roles'" class="col-span-full rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <AdminRoleMultiSelect
        v-model="selectedRoles"
        :disabled="!isDesktop || !canMutateRoles || savingRoles"
        :is-super-admin-operator="isSuperAdminOperator"
      />
      <AdminDesktopOnlyAction :desktop-enabled="isDesktop" class="mt-3">
        <template #default="{ disabled }">
          <button
            v-if="canManageRoles"
            type="button"
            class="rounded-lg bg-cyan-300/15 px-3 py-2 text-xs text-cyan-50"
            :disabled="disabled || !canMutateRoles || savingRoles"
            @click="saveRoles"
          >
            保存角色
          </button>
        </template>
      </AdminDesktopOnlyAction>
    </section>

  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AdminDesktopOnlyAction } from '@/components/admin'
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
