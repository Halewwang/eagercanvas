<template>
  <AdminPanelCard title="重点观察">
    <div class="space-y-3 text-sm">
      <AdminInfoLine label="未开通服务用户" :value="notEnabledActiveUsers.length" value-class="text-amber-100" />
      <AdminInfoLine label="待对账用户" :value="pendingBillingUsers" value-class="text-amber-100" />
      <AdminInfoLine label="已开通服务" :value="activeServiceUsers" />
    </div>
    <AdminOverviewTopSpendersList :format-usd="formatUsd" :top-spenders="topSpenders" />
  </AdminPanelCard>
</template>

<script setup>
import AdminInfoLine from '@/components/admin/AdminInfoLine.vue'
import AdminPanelCard from '@/components/admin/AdminPanelCard.vue'
import AdminOverviewTopSpendersList from './AdminOverviewTopSpendersList.vue'

defineProps({
  activeServiceUsers: {
    type: Number,
    default: 0
  },
  formatUsd: {
    type: Function,
    default: () => '$0.00'
  },
  notEnabledActiveUsers: {
    type: Array,
    default: () => []
  },
  pendingBillingUsers: {
    type: Number,
    default: 0
  },
  topSpenders: {
    type: Array,
    default: () => []
  }
})
</script>
