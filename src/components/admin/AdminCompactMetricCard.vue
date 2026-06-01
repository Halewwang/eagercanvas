<template>
  <AdminMetricCard
    :label="label"
    :value="value"
    :note="note"
    card-class="admin-compact-metric-card"
    label-class="text-[11px] uppercase tracking-[0.12em] text-white/40"
    value-tag="strong"
    value-class="mt-2 block text-2xl font-semibold text-white/95"
    note-class="mt-2 text-xs text-white/45"
  />
</template>

<script setup>
import AdminMetricCard from './AdminMetricCard.vue'

defineProps({
  label: {
    type: String,
    required: true
  },
  value: {
    type: [String, Number],
    required: true
  },
  note: {
    type: String,
    default: ''
  }
})
</script>

<style scoped>
.admin-compact-metric-card {
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.035);
  padding: 14px;
}
</style>
