<template>
  <tr :class="rowClass">
    <td class="px-2 py-2 text-white/80">{{ item.request_id || item.requestId || item.id || '-' }}</td>
    <td class="px-2 py-2 text-white/80">{{ item.model || item.model_name || '-' }}</td>
    <td class="px-2 py-2 text-white/80">{{ item.cost ?? item.cost_usd ?? '-' }}</td>
    <td class="px-2 py-2 text-white/70">{{ item.status || item.code || '-' }}</td>
    <td class="px-2 py-2 text-white/60">{{ item.created_at || item.createdAt || item.time || '-' }}</td>
  </tr>
</template>

<script setup>
defineProps({
  index: {
    type: Number,
    default: 0
  },
  item: {
    type: Object,
    default: () => ({})
  },
  rowClass: {
    type: String,
    default: ''
  }
})
</script>
