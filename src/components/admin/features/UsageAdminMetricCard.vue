<template>
  <UsageAdminSurface tag="article" surface-class="rounded-2xl p-5">
    <p class="text-[11px] uppercase tracking-[0.16em] text-white/40">{{ label }}</p>
    <p class="mt-3 text-3xl font-semibold text-white">{{ value }}</p>
  </UsageAdminSurface>
</template>

<script setup>
import UsageAdminSurface from './UsageAdminSurface.vue'

defineProps({
  label: {
    type: String,
    required: true
  },
  value: {
    type: [String, Number],
    required: true
  }
})
</script>
