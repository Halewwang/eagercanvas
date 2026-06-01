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
      v-bind="userServiceSection"
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
      v-bind="serviceReconciliationSection"
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
    :show="auditLogSection.canReadAudit"
  >
    <AdminAuditLogSection
      v-bind="auditLogSection"
      @load-logs="emit('load-logs')"
      @update-log-query="(key, value) => emit('update-audit-log-query', key, value)"
    />
  </AdminDashboardSectionFrame>
</template>

<script setup>
import { ref } from 'vue'
import AdminDashboardSectionFrame from '@/components/admin/AdminDashboardSectionFrame.vue'
import AdminAuditLogSection from './AdminAuditLogSection.vue'
import AdminOverviewSection from './AdminOverviewSection.vue'
import AdminServiceReconciliationSection from './AdminServiceReconciliationSection.vue'
import AdminUserServiceSection from './AdminUserServiceSection.vue'

const emit = defineEmits([
  'activate-service',
  'activate-user',
  'delete-user',
  'disable-service',
  'load-api-logs',
  'load-logs',
  'query-record',
  'reconcile-billing',
  'refresh-overview',
  'refresh-service-data',
  'refresh-users',
  'reset-service',
  'save-roles',
  'set-user-page',
  'suspend-user',
  'update-audit-log-query',
  'update-log-query',
  'update-role-selection',
  'update-service-limits',
  'update:recordRequestId',
  'update:searchQuery',
  'update:statusFilter'
])

defineProps({
  overviewSection: { type: Object, default: () => ({}) },
  userServiceSection: { type: Object, default: () => ({}) },
  serviceReconciliationSection: { type: Object, default: () => ({}) },
  auditLogSection: { type: Object, default: () => ({}) }
})

const overviewRef = ref(null)
const usersRef = ref(null)
const serviceRef = ref(null)
const auditRef = ref(null)

const getFramedSectionEl = (sectionRef) => sectionRef.value?.getSectionEl?.() || sectionRef.value

const getSectionEl = (key) => {
  if (key === 'users') return getFramedSectionEl(usersRef)
  if (key === 'service') return getFramedSectionEl(serviceRef)
  if (key === 'audit') return getFramedSectionEl(auditRef)
  return overviewRef.value
}

defineExpose({
  getSectionEl
})
</script>
