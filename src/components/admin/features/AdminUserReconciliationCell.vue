<template>
  <td class="px-3 py-4">
    <p class="mt-1 text-[11px]" :class="user.usageMeta?.pendingBillingCount ? 'text-amber-200/80' : 'text-white/35'">
      {{ user.reconciliation?.pendingCount ? `待对账 ${user.reconciliation.pendingCount} 条` : '无待对账' }}
    </p>
    <p class="mt-1 text-[11px]" :class="user.reconciliation?.unmatchedCount ? 'text-rose-200/80' : 'text-white/35'">
      {{ user.reconciliation?.unmatchedCount ? `异常 ${user.reconciliation.unmatchedCount} 条` : '无异常账单' }}
    </p>
    <p class="mt-1 text-[11px] text-white/35">最近活跃 {{ formatDateTime(user.usageMeta?.lastActivityAt) }}</p>
  </td>
</template>

<script setup>
const {
  formatDateTime,
  user
} = defineProps({
  formatDateTime: {
    type: Function,
    required: true
  },
  user: {
    type: Object,
    default: () => ({})
  }
})
</script>
