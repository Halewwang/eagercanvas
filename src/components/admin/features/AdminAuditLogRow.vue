<template>
  <tr :class="rowClass">
    <td class="px-3 py-3 text-xs text-white/70">{{ formatDateTime(log.createdAt) }}</td>
    <td class="px-3 py-3 text-white/85">{{ log.action }}</td>
    <td class="px-3 py-3 text-white/75">{{ log.operator?.email || '-' }}</td>
    <td class="px-3 py-3 text-white/75">{{ log.target?.email || '-' }}</td>
    <td class="px-3 py-3">
      <pre class="max-w-[420px] whitespace-pre-wrap text-xs text-white/55">{{ toPrettyJson(log.metadata) }}</pre>
    </td>
  </tr>
</template>

<script setup>
defineProps({
  formatDateTime: {
    type: Function,
    default: (value) => value || '-'
  },
  log: {
    type: Object,
    default: () => ({})
  },
  rowClass: {
    type: String,
    default: ''
  },
  toPrettyJson: {
    type: Function,
    default: (value) => JSON.stringify(value, null, 2)
  }
})
</script>
