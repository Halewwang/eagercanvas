<template>
  <div class="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] px-6 py-10">
    <div class="max-w-6xl mx-auto">
      <div class="flex items-center justify-between mb-8">
        <div>
          <h1 class="text-3xl font-light">Usage Dashboard</h1>
          <p class="text-[var(--text-secondary)]">Calls, tokens, media output and estimated cost.</p>
        </div>
        <button class="flora-button-ghost px-4 py-2 rounded-xl" @click="goHome">Back</button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <div v-for="card in cards" :key="card.label" class="flora-panel rounded-2xl p-5">
          <p class="text-xs uppercase tracking-wider text-[var(--text-secondary)]">{{ card.label }}</p>
          <p class="text-2xl mt-2">{{ card.value }}</p>
        </div>
      </div>

      <div class="flora-panel rounded-2xl p-6">
        <h2 class="text-lg mb-4">Daily Trend</h2>
        <div v-if="series.length === 0" class="text-sm text-[var(--text-secondary)]">No usage data yet.</div>
        <div v-else class="space-y-2">
          <div
            v-for="row in series"
            :key="row.date"
            class="grid grid-cols-[120px_1fr_100px] items-center gap-3"
          >
            <span class="text-sm text-[var(--text-secondary)]">{{ row.date }}</span>
            <div class="h-2 rounded bg-[var(--bg-tertiary)] overflow-hidden">
              <div class="h-full bg-[var(--accent-color)]" :style="{ width: `${barWidth(row.total_calls)}%` }" />
            </div>
            <span class="text-sm text-right">{{ row.total_calls }} calls</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getUsageSummary, getUsageTimeseries } from '@/api/usage'

const router = useRouter()
const summary = ref({
  totalCalls: 0,
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalImages: 0,
  totalVideoSeconds: 0,
  totalCostUsd: 0
})
const series = ref([])

const cards = computed(() => [
  { label: 'Calls', value: summary.value.totalCalls },
  { label: 'Input Tokens', value: summary.value.totalInputTokens },
  { label: 'Output Tokens', value: summary.value.totalOutputTokens },
  { label: 'Images', value: summary.value.totalImages },
  { label: 'Cost (USD)', value: summary.value.totalCostUsd.toFixed(4) }
])

const barWidth = (value) => {
  const max = Math.max(...series.value.map((r) => r.total_calls || 0), 1)
  return Math.round((value / max) * 100)
}

const goHome = () => router.push('/')

onMounted(async () => {
  try {
    const sum = await getUsageSummary()
    summary.value = sum.data || summary.value
    const ts = await getUsageTimeseries('day')
    series.value = ts.data || []
  } catch (error) {
    window.$message?.error(error?.message || 'Failed to load usage data')
  }
})
</script>
