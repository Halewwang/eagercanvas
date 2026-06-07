<template>
  <div class="mt-4 space-y-2">
    <p class="text-xs uppercase tracking-[0.12em] text-white/40">Top 消耗用户</p>
    <div v-if="topSpenders.length === 0" class="text-xs text-white/45">暂无归因成本数据</div>
    <div v-for="item in topSpenders" :key="`spender-${item.id}`" class="insight-row">
      <div>
        <p class="text-sm text-white/88">{{ item.displayName || item.email || item.id }}</p>
        <p class="text-[11px] text-white/45">{{ item.service?.serviceIdentifier || '-' }}</p>
      </div>
      <strong>{{ formatUsageAmount(item, 2) }}</strong>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  formatUsd: {
    type: Function,
    default: () => '0.00'
  },
  topSpenders: {
    type: Array,
    default: () => []
  }
})

const formatUsageAmount = (item, digits = 2) => {
  const amount = props.formatUsd(item?.officialUsage?.totalCostAmount, digits)
  const currency = item?.officialUsage?.currency || 'PTC'
  return `${amount} ${currency}`
}
</script>

<style scoped>
.insight-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.02));
  padding: 10px 12px;
}
</style>
