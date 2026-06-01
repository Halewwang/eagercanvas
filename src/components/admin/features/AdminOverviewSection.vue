<template>
  <AdminSectionHeader
    class="mb-4"
    title="概览"
    caption="核心指标、权限摘要和常用操作入口。"
  >
    <template #actions>
      <AdminMicroButton :disabled="loadingOverview" @click="$emit('refresh-overview')">
        {{ loadingOverview ? '刷新中...' : '刷新概览' }}
      </AdminMicroButton>
    </template>
  </AdminSectionHeader>

  <AdminOverviewMetricGrid :cards="cards" />

  <div class="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-[1.5fr_1fr]">
    <AdminOverviewUsageTrendPanel
      :bar-width="barWidth"
      :can-read-usage="canReadUsage"
      :now-label="nowLabel"
      :usage-series="usageSeries"
    />

    <div class="space-y-5">
      <AdminOverviewSessionPanel
        :admin-account-label="adminAccountLabel"
        :format-role-list="formatRoleList"
        :permission-count="permissionCount"
        :roles="roles"
      />

      <AdminOverviewInsightPanel
        :active-service-users="activeServiceUsers"
        :format-usd="formatUsd"
        :not-enabled-active-users="notEnabledActiveUsers"
        :pending-billing-users="pendingBillingUsers"
        :top-spenders="topSpenders"
      />
    </div>
  </div>
</template>

<script setup>
import AdminMicroButton from '@/components/admin/AdminMicroButton.vue'
import AdminSectionHeader from '@/components/admin/AdminSectionHeader.vue'
import AdminOverviewInsightPanel from './AdminOverviewInsightPanel.vue'
import AdminOverviewMetricGrid from './AdminOverviewMetricGrid.vue'
import AdminOverviewSessionPanel from './AdminOverviewSessionPanel.vue'
import AdminOverviewUsageTrendPanel from './AdminOverviewUsageTrendPanel.vue'

defineEmits(['refresh-overview'])

defineProps({
  activeServiceUsers: {
    type: Number,
    default: 0
  },
  adminAccountLabel: {
    type: String,
    default: '-'
  },
  barWidth: {
    type: Function,
    default: () => 0
  },
  canReadUsage: {
    type: Boolean,
    default: false
  },
  cards: {
    type: Array,
    default: () => []
  },
  formatRoleList: {
    type: Function,
    default: () => ''
  },
  formatUsd: {
    type: Function,
    default: () => '$0.00'
  },
  loadingOverview: {
    type: Boolean,
    default: false
  },
  notEnabledActiveUsers: {
    type: Array,
    default: () => []
  },
  nowLabel: {
    type: String,
    default: ''
  },
  pendingBillingUsers: {
    type: Number,
    default: 0
  },
  permissionCount: {
    type: Number,
    default: 0
  },
  roles: {
    type: Array,
    default: () => []
  },
  topSpenders: {
    type: Array,
    default: () => []
  },
  usageSeries: {
    type: Array,
    default: () => []
  }
})
</script>
