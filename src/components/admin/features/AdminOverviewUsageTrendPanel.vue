<template>
  <AdminPanelCard
    title="用量趋势"
    caption="最近日级请求量视图"
    :meta="`更新于 ${nowLabel}`"
  >
    <AdminEmptyState v-if="!canReadUsage">
      当前角色没有全局用量读取权限，已跳过相关接口请求。
    </AdminEmptyState>
    <AdminEmptyState v-else-if="usageSeries.length === 0">
      暂无用量数据
    </AdminEmptyState>
    <div v-else class="space-y-3">
      <div v-for="row in usageSeries" :key="row.date" class="grid grid-cols-[90px_1fr_80px] items-center gap-3">
        <span class="text-xs text-white/55">{{ row.date }}</span>
        <div class="h-2 overflow-hidden rounded bg-white/10">
          <div class="h-full rounded bg-white/50" :style="{ width: `${barWidth(row.total_calls)}%` }" />
        </div>
        <span class="text-right text-xs text-white/75">{{ row.total_calls }}</span>
      </div>
    </div>
  </AdminPanelCard>
</template>

<script setup>
import AdminEmptyState from '@/components/admin/AdminEmptyState.vue'
import AdminPanelCard from '@/components/admin/AdminPanelCard.vue'

defineProps({
  barWidth: {
    type: Function,
    default: () => 0
  },
  canReadUsage: {
    type: Boolean,
    default: false
  },
  nowLabel: {
    type: String,
    default: ''
  },
  usageSeries: {
    type: Array,
    default: () => []
  }
})
</script>
