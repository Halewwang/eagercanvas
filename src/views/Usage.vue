<template>
  <div class="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] px-6 py-10">
    <div class="max-w-6xl mx-auto space-y-8">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-light">Usage Dashboard</h1>
          <p class="text-[var(--text-secondary)]">Calls, tokens, media output and 302.AI management data.</p>
        </div>
        <div class="flex items-center gap-2">
          <button class="flora-button-ghost px-4 py-2 rounded-xl" @click="goUsageAdmin">Admin Console</button>
          <button class="flora-button-ghost px-4 py-2 rounded-xl" @click="goHome">Back</button>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
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

      <div class="flora-panel rounded-2xl p-6 space-y-6">
        <div class="flex items-center justify-between">
          <h2 class="text-lg">302.AI Management</h2>
          <button class="flora-button-ghost px-3 py-1 rounded-lg" :disabled="loadingManagement" @click="loadManagementData">
            {{ loadingManagement ? 'Refreshing...' : 'Refresh All' }}
          </button>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div class="rounded-xl border border-[var(--border-color)] p-4 space-y-3">
            <div class="flex items-center justify-between">
              <h3 class="text-sm uppercase tracking-wider text-[var(--text-secondary)]">Account Balance</h3>
              <button class="flora-button-ghost px-2 py-1 rounded" :disabled="loadingBalance" @click="loadBalance">
                {{ loadingBalance ? 'Loading...' : 'Refresh' }}
              </button>
            </div>
            <p class="text-3xl">{{ balanceDisplay }}</p>
            <p class="text-xs text-[var(--text-secondary)]">Source: /dashboard/balance</p>
          </div>

          <div class="rounded-xl border border-[var(--border-color)] p-4 space-y-3">
            <h3 class="text-sm uppercase tracking-wider text-[var(--text-secondary)]">Record Lookup (request-id)</h3>
            <div class="flex gap-2">
              <input
                v-model="recordRequestId"
                class="w-full rounded-lg border border-[var(--border-color)] bg-transparent px-3 py-2 text-sm"
                placeholder="Paste request-id"
              />
              <button class="flora-button-ghost px-3 py-2 rounded-lg" :disabled="loadingRecord" @click="queryRecord">
                {{ loadingRecord ? 'Querying...' : 'Query' }}
              </button>
            </div>
            <div v-if="recordData" class="text-sm grid grid-cols-2 gap-2">
              <div>Model: {{ recordData.model || '-' }}</div>
              <div>Cost: {{ recordData.cost ?? '-' }}</div>
              <div>Input Tokens: {{ recordData.input_token ?? '-' }}</div>
              <div>Output Tokens: {{ recordData.output_token ?? '-' }}</div>
              <div class="col-span-2">Process Time: {{ recordData.process_time ?? '-' }}</div>
            </div>
            <p v-else class="text-xs text-[var(--text-secondary)]">No record queried yet.</p>
          </div>
        </div>

        <div class="rounded-xl border border-[var(--border-color)] p-4 space-y-3">
          <div class="flex items-center justify-between gap-4 flex-wrap">
            <h3 class="text-sm uppercase tracking-wider text-[var(--text-secondary)]">API Log Query</h3>
            <div class="flex items-center gap-2 flex-wrap">
              <input v-model="logQuery.start" type="datetime-local" class="rounded-lg border border-[var(--border-color)] bg-transparent px-2 py-1 text-xs" />
              <input v-model="logQuery.end" type="datetime-local" class="rounded-lg border border-[var(--border-color)] bg-transparent px-2 py-1 text-xs" />
              <input v-model.number="logQuery.page" type="number" min="1" class="w-20 rounded-lg border border-[var(--border-color)] bg-transparent px-2 py-1 text-xs" placeholder="page" />
              <input v-model.number="logQuery.limit" type="number" min="1" max="50" class="w-20 rounded-lg border border-[var(--border-color)] bg-transparent px-2 py-1 text-xs" placeholder="limit" />
              <button class="flora-button-ghost px-3 py-1 rounded-lg" :disabled="loadingLogs" @click="loadApiLogs">
                {{ loadingLogs ? 'Loading...' : 'Search' }}
              </button>
            </div>
          </div>

          <div v-if="apiLogs.length === 0" class="text-sm text-[var(--text-secondary)]">No logs.</div>
          <div v-else class="overflow-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-[var(--text-secondary)] border-b border-[var(--border-color)]">
                  <th class="py-2 pr-2">Request ID</th>
                  <th class="py-2 pr-2">Model</th>
                  <th class="py-2 pr-2">Cost</th>
                  <th class="py-2 pr-2">Status</th>
                  <th class="py-2">Time</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, idx) in apiLogs" :key="item.request_id || item.id || idx" class="border-b border-[var(--border-color)]/50">
                  <td class="py-2 pr-2">{{ item.request_id || item.requestId || item.id || '-' }}</td>
                  <td class="py-2 pr-2">{{ item.model || item.model_name || '-' }}</td>
                  <td class="py-2 pr-2">{{ item.cost ?? item.cost_usd ?? '-' }}</td>
                  <td class="py-2 pr-2">{{ item.status || item.code || '-' }}</td>
                  <td class="py-2">{{ item.created_at || item.createdAt || item.time || '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="text-xs text-[var(--text-secondary)]">
            Page {{ apiLogPagination?.cur_page || logQuery.page }} / {{ apiLogPagination?.total_page || '-' }} · limit {{ apiLogPagination?.limit || logQuery.limit }}
          </p>
        </div>

        <div class="rounded-xl border border-[var(--border-color)] p-4 space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-sm uppercase tracking-wider text-[var(--text-secondary)]">User API Keys</h3>
            <button class="flora-button-ghost px-3 py-1 rounded-lg" :disabled="loadingKeys" @click="loadApiKeys">
              {{ loadingKeys ? 'Loading...' : 'Refresh' }}
            </button>
          </div>

          <div v-if="apiKeys.length === 0" class="text-sm text-[var(--text-secondary)]">No API key data.</div>
          <div v-else class="overflow-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-[var(--text-secondary)] border-b border-[var(--border-color)]">
                  <th class="py-2 pr-2">Name</th>
                  <th class="py-2 pr-2">API Key</th>
                  <th class="py-2 pr-2">Current Cost</th>
                  <th class="py-2 pr-2">Daily Cost</th>
                  <th class="py-2">Expire</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in apiKeys" :key="item.id" class="border-b border-[var(--border-color)]/50">
                  <td class="py-2 pr-2">{{ item.api_name || '-' }}</td>
                  <td class="py-2 pr-2">{{ maskApiKey(item.api_key) }}</td>
                  <td class="py-2 pr-2">{{ item.current_cost ?? '-' }}</td>
                  <td class="py-2 pr-2">{{ item.current_date_cost ?? '-' }}</td>
                  <td class="py-2">{{ formatExpire(item.expired_on) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  get302ApiKeys,
  get302ApiRecord,
  get302Balance,
  get302Record,
  getUsageSummary,
  getUsageTimeseries
} from '@/api/usage'
import { getErrorMessage } from '@/utils'

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

const balance = ref('')
const loadingBalance = ref(false)

const recordRequestId = ref('')
const recordData = ref(null)
const loadingRecord = ref(false)

const logQuery = ref({
  page: 1,
  limit: 20,
  start: '',
  end: ''
})
const apiLogs = ref([])
const apiLogPagination = ref(null)
const loadingLogs = ref(false)

const apiKeys = ref([])
const loadingKeys = ref(false)

const loadingManagement = computed(() =>
  loadingBalance.value || loadingRecord.value || loadingLogs.value || loadingKeys.value
)

const balanceDisplay = computed(() => (balance.value ? `$${balance.value}` : '--'))

const cards = computed(() => [
  { label: 'Calls', value: summary.value.totalCalls },
  { label: 'Input Tokens', value: summary.value.totalInputTokens },
  { label: 'Output Tokens', value: summary.value.totalOutputTokens },
  { label: 'Images', value: summary.value.totalImages },
  { label: 'Cost (USD)', value: summary.value.totalCostUsd.toFixed(4) },
  { label: '302 Balance', value: balanceDisplay.value }
])

const barWidth = (value) => {
  const max = Math.max(...series.value.map((r) => r.total_calls || 0), 1)
  return Math.round((value / max) * 100)
}

const toUnixSeconds = (value) => {
  if (!value) return undefined
  const ts = Date.parse(value)
  return Number.isFinite(ts) ? Math.floor(ts / 1000) : undefined
}

const formatExpire = (value) => {
  const num = Number(value)
  if (!num || num <= 0) return '-'
  return new Date(num * 1000).toLocaleString()
}

const maskApiKey = (value) => {
  const key = String(value || '')
  if (key.length <= 10) return key || '-'
  return `${key.slice(0, 6)}...${key.slice(-4)}`
}

const goHome = () => router.push('/')
const goUsageAdmin = () => router.push('/admin/users')

const loadUsageData = async () => {
  const [sum, ts] = await Promise.all([
    getUsageSummary(),
    getUsageTimeseries('day')
  ])
  summary.value = sum.data || summary.value
  series.value = ts.data || []
}

const loadBalance = async () => {
  loadingBalance.value = true
  try {
    const rsp = await get302Balance()
    balance.value = String(rsp?.data?.balance ?? '')
  } finally {
    loadingBalance.value = false
  }
}

const queryRecord = async () => {
  if (!recordRequestId.value.trim()) {
    window.$message?.warning('Please input request-id')
    return
  }
  loadingRecord.value = true
  try {
    const rsp = await get302Record(recordRequestId.value.trim())
    recordData.value = rsp?.data || null
  } finally {
    loadingRecord.value = false
  }
}

const loadApiLogs = async () => {
  loadingLogs.value = true
  try {
    const rsp = await get302ApiRecord({
      page: logQuery.value.page,
      limit: Math.min(50, Math.max(1, Number(logQuery.value.limit || 20))),
      start_time: toUnixSeconds(logQuery.value.start),
      end_time: toUnixSeconds(logQuery.value.end)
    })

    apiLogs.value = Array.isArray(rsp?.data?.items) ? rsp.data.items : []
    apiLogPagination.value = rsp?.data?.pagination || null
  } finally {
    loadingLogs.value = false
  }
}

const loadApiKeys = async () => {
  loadingKeys.value = true
  try {
    const rsp = await get302ApiKeys()
    apiKeys.value = Array.isArray(rsp?.data) ? rsp.data : []
  } finally {
    loadingKeys.value = false
  }
}

const loadManagementData = async () => {
  await Promise.allSettled([
    loadBalance(),
    loadApiLogs(),
    loadApiKeys()
  ])
}

onMounted(async () => {
  try {
    await loadUsageData()
    await loadManagementData()
  } catch (error) {
    if (!error?.__handled) {
      window.$message?.error(getErrorMessage(error, 'Failed to load usage data'))
    }
  }
})
</script>
