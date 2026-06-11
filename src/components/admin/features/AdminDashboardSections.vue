<template>
  <section ref="overviewRef" class="mb-8 scroll-mt-6">
    <AdminOverviewSection
      v-bind="overviewSection"
      @refresh-overview="emit('refresh-overview')"
    />
  </section>

  <AdminDashboardSectionFrame
    ref="usersRef"
    :show="userServiceSection.canReadUsers"
    frame-class="mb-8"
  >
    <AdminUserServiceSection
      v-bind="userServiceContentProps"
      @activate-service="emit('activate-service', $event)"
      @activate-user="emit('activate-user', $event)"
      @delete-user="emit('delete-user', $event)"
      @disable-service="emit('disable-service', $event)"
      @refresh-users="emit('refresh-users')"
      @reset-service="emit('reset-service', $event)"
      @save-roles="emit('save-roles', $event)"
      @set-user-page="emit('set-user-page', $event)"
      @suspend-user="emit('suspend-user', $event)"
      @update-role-selection="(userId, role) => emit('update-role-selection', userId, role)"
      @update-service-limits="emit('update-service-limits', $event)"
      @update:search-query="emit('update:searchQuery', $event)"
      @update:status-filter="emit('update:statusFilter', $event)"
    />
  </AdminDashboardSectionFrame>

  <AdminDashboardSectionFrame
    ref="serviceRef"
    :show="serviceReconciliationSection.showServiceSection"
    frame-class="mb-8 space-y-6"
  >
    <AdminServiceReconciliationSection
      v-bind="serviceReconciliationContentProps"
      @load-api-logs="emit('load-api-logs')"
      @query-record="emit('query-record')"
      @reconcile-billing="emit('reconcile-billing')"
      @refresh-service-data="emit('refresh-service-data')"
      @update-log-query="(key, value) => emit('update-log-query', key, value)"
      @update:record-request-id="emit('update:recordRequestId', $event)"
    />
  </AdminDashboardSectionFrame>

  <AdminDashboardSectionFrame
    ref="auditRef"
    :show="auditLogSection.canReadAudit && activeRouteSection === 'audit'"
    frame-class="mb-8"
  >
    <AdminAuditLogSection
      v-bind="auditLogContentProps"
      @load-logs="emit('load-logs')"
      @update-log-query="(key, value) => emit('update-audit-log-query', key, value)"
    />
  </AdminDashboardSectionFrame>

  <AdminDashboardSectionFrame
    ref="issuesRef"
    :show="issueInboxSection.canReadIssues"
  >
    <AdminIssueInboxSection
      v-bind="issueInboxSection"
      @export-issues="emit('export-issues', $event)"
      @load-issues="emit('load-issues')"
      @notify-issue="emit('notify-issue', $event)"
      @open-issue="emit('open-issue', $event)"
      @send-issue-digest-email="emit('send-issue-digest-email')"
      @toggle-all-issue-selection="emit('toggle-all-issue-selection', $event)"
      @toggle-issue-selection="emit('toggle-issue-selection', ...$event)"
      @update-issue-query="(key, value) => emit('update-issue-query', key, value)"
      @update-issue-status="emit('update-issue-status', $event)"
    />
  </AdminDashboardSectionFrame>
</template>

<script setup>
import { computed, ref } from 'vue'
import AdminDashboardSectionFrame from '@/components/admin/AdminDashboardSectionFrame.vue'
import AdminAuditLogSection from './AdminAuditLogSection.vue'
import AdminOverviewSection from './AdminOverviewSection.vue'
import AdminIssueInboxSection from './AdminIssueInboxSection.vue'
import AdminServiceReconciliationSection from './AdminServiceReconciliationSection.vue'
import AdminUserServiceSection from './AdminUserServiceSection.vue'

const emit = defineEmits([
  'activate-service',
  'activate-user',
  'delete-user',
  'disable-service',
  'load-api-logs',
  'load-issues',
  'load-logs',
  'export-issues',
  'notify-issue',
  'open-issue',
  'query-record',
  'reconcile-billing',
  'refresh-overview',
  'refresh-service-data',
  'refresh-users',
  'reset-service',
  'save-roles',
  'send-issue-digest-email',
  'set-user-page',
  'suspend-user',
  'toggle-all-issue-selection',
  'toggle-issue-selection',
  'update-audit-log-query',
  'update-issue-query',
  'update-issue-status',
  'update-log-query',
  'update-role-selection',
  'update-service-limits',
  'update:recordRequestId',
  'update:searchQuery',
  'update:statusFilter'
])

const props = defineProps({
  activeRouteSection: { type: String, default: 'overview' },
  overviewSection: { type: Object, default: () => ({}) },
  userServiceSection: { type: Object, default: () => ({}) },
  serviceReconciliationSection: { type: Object, default: () => ({}) },
  auditLogSection: { type: Object, default: () => ({}) },
  issueInboxSection: { type: Object, default: () => ({}) }
})

const omitSectionOnlyProps = (section, omittedKeys) => Object.fromEntries(
  Object.entries(section || {}).filter(([key]) => !omittedKeys.includes(key))
)

const userServiceContentProps = computed(() => omitSectionOnlyProps(props.userServiceSection, ['canReadUsers']))
const serviceReconciliationContentProps = computed(() => omitSectionOnlyProps(props.serviceReconciliationSection, ['showServiceSection']))
const auditLogContentProps = computed(() => omitSectionOnlyProps(props.auditLogSection, ['canReadAudit']))

const overviewRef = ref(null)
const usersRef = ref(null)
const serviceRef = ref(null)
const auditRef = ref(null)
const issuesRef = ref(null)

const getFramedSectionEl = (sectionRef) => sectionRef.value?.getSectionEl?.() || null

const getSectionEl = (key) => {
  if (key === 'users') return getFramedSectionEl(usersRef)
  if (key === 'service') return getFramedSectionEl(serviceRef)
  if (key === 'audit') return getFramedSectionEl(auditRef)
  if (key === 'issues') return getFramedSectionEl(issuesRef)
  return overviewRef.value
}

defineExpose({
  getSectionEl
})
</script>
