<template>
  <div class="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] px-6 py-10">
    <div class="max-w-6xl mx-auto space-y-8">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-semibold">My Usage</h1>
          <p class="text-[var(--text-secondary)]">Personal calls, tokens and media output.</p>
        </div>
        <div class="flex items-center gap-2">
          <UsageNavButton class="px-4 py-2 rounded-xl" @click="goAdmin">Admin Console</UsageNavButton>
          <UsageNavButton class="px-4 py-2 rounded-xl" @click="goHome">Home</UsageNavButton>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <UsageSurface v-for="card in cards" :key="card.label" class="rounded-2xl p-5">
          <p class="text-xs uppercase tracking-wider text-[var(--text-secondary)]">{{ card.label }}</p>
          <p class="text-2xl mt-2">{{ card.value }}</p>
        </UsageSurface>
      </div>

      <UsageSurface class="rounded-2xl p-6">
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
      </UsageSurface>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getUsageSummary, getUsageTimeseries } from '@/api/usage'
import UsageNavButton from '@/components/usage/UsageNavButton.vue'
import UsageSurface from '@/components/usage/UsageSurface.vue'
import { getErrorMessage } from '@/utils'

const isLocalPreviewMode = () => import.meta.env.DEV && import.meta.env.VITE_BYPASS_AUTH === 'true'

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
  { label: 'Cost (USD)', value: Number(summary.value.totalCostUsd || 0).toFixed(4) }
])

const barWidth = (value) => {
  const max = Math.max(...series.value.map((r) => r.total_calls || 0), 1)
  return Math.round((Number(value || 0) / max) * 100)
}

const goHome = () => router.push('/')
const goAdmin = () => router.push('/admin/users')

const loadUsageData = async () => {
  const [sum, ts] = await Promise.all([
    getUsageSummary(),
    getUsageTimeseries('day')
  ])
  summary.value = sum.data || summary.value
  series.value = ts.data || []
}

onMounted(async () => {
  if (isLocalPreviewMode()) return

  try {
    await loadUsageData()
  } catch (error) {
    if (!error?.__handled) window.$message?.error(getErrorMessage(error, 'Failed to load usage dashboard'))
  }
})
</script>
