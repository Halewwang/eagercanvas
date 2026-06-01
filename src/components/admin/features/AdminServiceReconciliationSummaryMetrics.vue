<template>
  <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
    <AdminGlassMetricCard
      label="账户余额"
      :value="canReadUsage ? balanceDisplay : '--'"
      :note="canReadUsage ? '当前服务余额' : '需要权限：admin.usage.read_all'"
    />
    <AdminGlassMetricCard
      label="已开通服务"
      :value="canReadUsers ? activeServiceUsers : '--'"
      note="当前 active 服务凭证用户数"
    />
    <AdminGlassMetricCard
      label="日志结果数"
      :value="canReadUsage ? apiLogCount : '--'"
      :note="canReadUsage ? '当前日志查询返回行数' : '需要权限：admin.usage.read_all'"
    />
  </div>
</template>

<script setup>
import AdminGlassMetricCard from '@/components/admin/AdminGlassMetricCard.vue'

defineProps({
  activeServiceUsers: {
    type: Number,
    default: 0
  },
  apiLogCount: {
    type: Number,
    default: 0
  },
  balanceDisplay: {
    type: String,
    default: ''
  },
  canReadUsage: {
    type: Boolean,
    default: false
  },
  canReadUsers: {
    type: Boolean,
    default: false
  }
})
</script>
