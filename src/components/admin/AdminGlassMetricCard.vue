<template>
  <AdminGlassSurface tag="article" surface-class="rounded-xl p-4">
    <AdminMetricCard
      as="div"
      :label="label"
      :value="value"
      :note="note"
      card-class=""
      label-class="text-xs uppercase tracking-[0.12em] text-white/40"
      value-class="mt-2 text-2xl font-semibold text-white"
      note-class="mt-2 text-xs text-white/45"
    />
  </AdminGlassSurface>
</template>

<script setup>
import AdminGlassSurface from './AdminGlassSurface.vue'
import AdminMetricCard from './AdminMetricCard.vue'

defineProps({
  label: {
    type: String,
    required: true
  },
  note: {
    type: String,
    default: ''
  },
  value: {
    type: [String, Number],
    required: true
  }
})
</script>
