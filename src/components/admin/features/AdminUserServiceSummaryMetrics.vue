<template>
  <div class="mb-5 grid grid-cols-1 gap-3 md:grid-cols-4">
    <AdminCompactMetricCard
      label="服务开通率"
      :value="`${serviceActivationRate}%`"
    />
    <AdminCompactMetricCard
      label="待处理服务"
      :value="notEnabledActiveCount"
    />
    <AdminCompactMetricCard
      label="待对账用户"
      :value="pendingBillingUsers"
    />
    <AdminCompactMetricCard
      label="当前显示"
      :value="filteredUserCount"
    />
  </div>
</template>

<script setup>
import AdminCompactMetricCard from '@/components/admin/AdminCompactMetricCard.vue'

defineProps({
  filteredUserCount: {
    type: Number,
    default: 0
  },
  notEnabledActiveCount: {
    type: Number,
    default: 0
  },
  pendingBillingUsers: {
    type: Number,
    default: 0
  },
  serviceActivationRate: {
    type: Number,
    default: 0
  }
})
</script>
