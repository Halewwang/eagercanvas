<template>
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
    <AdminGlassSurface
      v-for="card in cards"
      :key="card.label"
      tag="article"
      surface-class="rounded-2xl p-4"
    >
      <AdminMetricCard
        as="div"
        :label="card.label"
        :value="card.value"
        :note="card.note"
        card-class=""
        label-class="text-[11px] uppercase tracking-[0.16em] text-white/40"
        value-class="mt-3 text-3xl font-semibold text-white"
        note-class="mt-2 text-xs text-white/55"
      />
    </AdminGlassSurface>
  </div>
</template>

<script setup>
import AdminGlassSurface from '@/components/admin/AdminGlassSurface.vue'
import AdminMetricCard from '@/components/admin/AdminMetricCard.vue'

defineProps({
  cards: {
    type: Array,
    default: () => []
  }
})
</script>
