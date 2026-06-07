<template>
  <AdminPanelCard
    title="用量趋势"
    caption="最近日级请求量视图"
    :meta="`更新于 ${nowLabel}`"
    panel-class="admin-panel-card admin-overview-usage-panel rounded-2xl p-4 md:p-5"
  >
    <AdminEmptyState v-if="!canReadUsage">
      当前角色没有全局用量读取权限，已跳过相关接口请求。
    </AdminEmptyState>
    <AdminEmptyState v-else-if="usageSeries.length === 0">
      暂无用量数据
    </AdminEmptyState>
    <div v-else class="admin-overview-usage-content">
      <div class="admin-overview-usage-list">
        <div
          v-for="row in visibleUsageSeries"
          :key="row.date"
          class="grid grid-cols-[90px_1fr_80px] items-center gap-3"
        >
          <span class="text-xs text-white/55">{{ row.date }}</span>
          <div class="h-2 overflow-hidden rounded bg-white/10">
            <div class="h-full rounded bg-white/50" :style="{ width: `${barWidth(row.total_calls)}%` }" />
          </div>
          <span class="text-right text-xs text-white/75">{{ row.total_calls }}</span>
        </div>
      </div>
      <AdminPaginationBar
        v-if="usageSeries.length > USAGE_TREND_PAGE_SIZE"
        :page="usageTrendPage"
        :limit="USAGE_TREND_PAGE_SIZE"
        :total="usageSeries.length"
        item-label="天"
        @set-page="setUsageTrendPage"
      />
    </div>
  </AdminPanelCard>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import AdminEmptyState from '@/components/admin/AdminEmptyState.vue'
import AdminPaginationBar from '@/components/admin/AdminPaginationBar.vue'
import AdminPanelCard from '@/components/admin/AdminPanelCard.vue'

const USAGE_TREND_PAGE_SIZE = 10
const props = defineProps({
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

const usageTrendPage = ref(1)
const usageTrendTotalPages = computed(() => Math.max(1, Math.ceil(props.usageSeries.length / USAGE_TREND_PAGE_SIZE)))
const visibleUsageSeries = computed(() => {
  const start = (usageTrendPage.value - 1) * USAGE_TREND_PAGE_SIZE
  return props.usageSeries.slice(start, start + USAGE_TREND_PAGE_SIZE)
})

const setUsageTrendPage = (page) => {
  const parsed = Number(page)
  usageTrendPage.value = Number.isFinite(parsed)
    ? Math.max(1, Math.min(usageTrendTotalPages.value, parsed))
    : 1
}

watch(() => props.usageSeries.length, () => {
  if (props.usageSeries.length <= USAGE_TREND_PAGE_SIZE) {
    usageTrendPage.value = 1
    return
  }
  if (usageTrendPage.value > usageTrendTotalPages.value) {
    usageTrendPage.value = usageTrendTotalPages.value
  }
})
</script>

<style scoped>
.admin-overview-usage-panel {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
}

.admin-overview-usage-content {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}

.admin-overview-usage-list {
  display: grid;
  gap: 12px;
}
</style>
