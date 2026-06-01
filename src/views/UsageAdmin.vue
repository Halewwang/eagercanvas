<template>
  <UsageAdminShell>
    <template #sidebar>
      <UsageAdminSidebar
        :nav-items="sidebarNavItems"
        :session-summary="sidebarSessionSummary"
      />
    </template>

    <UsageAdminHeader
      :is-authenticated="isAdminAuthenticated"
      :loading="loadingAll"
      @go-home="goHome"
      @logout="logout"
      @refresh="loadAll"
    />

    <UsageAdminLoginCard
      v-if="!isAdminAuthenticated"
      :form="loginForm"
      :logging-in="loggingIn"
      @submit-login="handleLogin"
      @update-login-form-field="updateLoginFormField"
    />

    <template v-else>
      <UsageAdminOverviewSection
        :metrics="overviewMetrics"
      />

      <UsageAdminCredentialsSection
        :api-keys="apiKeys"
        :assign-selections="assignSelections"
        :create-form="createForm"
        :creating-key="creatingKey"
        :format-expire="formatExpire"
        :mask-api-key="maskApiKey"
        :users="users"
        @assign-key-from-row="assignKeyFromRow"
        @create-api-key="createApiKey"
        @delete-api-key="deleteApiKey"
        @update-assignment-selection="updateAssignmentSelection"
        @update-create-form-field="updateCreateFormField"
      />

      <UsageAdminUsersSection
        :format-date-time="formatDateTime"
        :users="users"
        @unassign-key="unassignKey"
      />
    </template>
  </UsageAdminShell>
</template>

<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  UsageAdminCredentialsSection,
  UsageAdminHeader,
  UsageAdminLoginCard,
  UsageAdminOverviewSection,
  UsageAdminShell,
  UsageAdminSidebar,
  UsageAdminUsersSection
} from '@/components/admin/features'
import { useUsageAdminAccessState } from '@/hooks/useUsageAdminAccessState'
import { useUsageAdminCredentialActions } from '@/hooks/useUsageAdminCredentialActions'
import { useUsageAdminDataState } from '@/hooks/useUsageAdminDataState'
import { useUsageAdminDisplayState } from '@/hooks/useUsageAdminDisplayState'

const router = useRouter()

const {
  apiKeys,
  balance,
  loadAll,
  loadingAll,
  users
} = useUsageAdminDataState()

const {
  assignKeyFromRow,
  assignSelections,
  createApiKey,
  createForm,
  creatingKey,
  deleteApiKey,
  unassignKey,
  updateAssignmentSelection,
  updateCreateFormField
} = useUsageAdminCredentialActions({
  loadAll
})

const {
  adminSession,
  handleLogin,
  isAdminAuthenticated,
  loggingIn,
  loginForm,
  logout,
  restoreSession,
  updateLoginFormField
} = useUsageAdminAccessState({
  loadAll
})

const {
  formatDateTime,
  formatExpire,
  maskApiKey,
  overviewMetrics,
  sidebarNavItems,
  sidebarSessionSummary
} = useUsageAdminDisplayState({
  adminSession,
  apiKeys,
  balance,
  isAdminAuthenticated,
  users
})

const goHome = () => router.push('/')

onMounted(async () => {
  await restoreSession()
})
</script>
