<template>
  <section id="overview" class="mb-8 scroll-mt-6">
    <AdminSectionHeader
      class="mb-4"
      title="Overview"
      caption="Balance, user coverage, and credential inventory."
    />
    <div class="grid grid-cols-1 gap-4 md:grid-cols-4">
      <UsageAdminMetricCard
        v-for="metric in metrics"
        :key="metric.label"
        :label="metric.label"
        :value="metric.value"
      />
    </div>
  </section>
</template>

<script setup>
import AdminSectionHeader from '@/components/admin/AdminSectionHeader.vue'
import UsageAdminMetricCard from './UsageAdminMetricCard.vue'

defineProps({
  metrics: {
    type: Array,
    default: () => []
  }
})
</script>
