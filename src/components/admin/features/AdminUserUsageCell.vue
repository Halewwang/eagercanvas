<template>
  <td class="px-3 py-4 text-white/85">
    <p>{{ user.officialUsage?.totalCalls || 0 }} 次</p>
    <p class="mt-1 text-xs text-white/45">
      {{ formatUsd(user.officialUsage?.totalCostAmount, 4) }} {{ user.officialUsage?.currency || 'USD' }}
    </p>
    <p class="mt-1 text-[11px] text-white/35">{{ topModelLabel(user) }}</p>
  </td>
</template>

<script setup>
const {
  formatUsd,
  topModelLabel,
  user
} = defineProps({
  formatUsd: {
    type: Function,
    required: true
  },
  topModelLabel: {
    type: Function,
    required: true
  },
  user: {
    type: Object,
    default: () => ({})
  }
})
</script>
