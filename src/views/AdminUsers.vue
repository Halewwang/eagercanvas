<template>
  <div ref="adminShellRef" class="admin-shell min-h-screen overflow-y-auto px-3 py-4 md:px-6 md:py-6">
    <div class="admin-frame w-full rounded-[20px] border border-white/10">
      <div class="grid grid-cols-1 lg:grid-cols-[240px_1fr]">
        <aside class="admin-sidebar hidden self-start border-r border-white/10 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
          <div class="px-5 pt-5">
            <div class="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <p class="text-xs uppercase tracking-[0.18em] text-white/45">EagerCanvas</p>
              <p class="mt-1 text-sm font-medium text-white/90">Admin Console</p>
            </div>
          </div>

          <nav class="mt-6 space-y-1 px-4">
            <button
              v-for="item in navItems"
              :key="item.key"
              class="menu-item"
              :class="{ 'menu-item-active': activeSection === item.key }"
              @click="scrollToSection(item.key)"
            >
              {{ item.label }}
            </button>
          </nav>

          <div class="mt-auto p-4">
            <div class="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p class="text-sm font-medium text-white/90">Control Center</p>
              <p class="mt-2 text-xs leading-5 text-white/55">User lifecycle, role assignment and Eager Service governance.</p>
            </div>
          </div>
        </aside>

        <main class="admin-main p-5 md:p-7">
          <div class="mb-4 flex flex-wrap gap-2 lg:hidden">
            <button
              v-for="item in navItems"
              :key="`mobile-${item.key}`"
              class="ui-micro-btn"
              :class="{ 'ui-micro-btn-primary': activeSection === item.key }"
              @click="scrollToSection(item.key)"
            >
              {{ item.label }}
            </button>
          </div>

          <header class="mb-8 flex flex-col gap-4 border-b border-white/10 pb-6 md:flex-row md:items-start md:justify-between">
            <div>
              <p class="text-xs uppercase tracking-[0.2em] text-white/45">Admin Dashboard</p>
              <h1 class="mt-2 text-2xl font-semibold text-white md:text-3xl">Welcome Back, {{ displayName }}</h1>
              <p class="mt-2 text-sm text-white/55">
                {{ usageSummary.totalUsers || 0 }} active members · {{ usageSummary.totalCalls || 0 }} calls ·
                {{ Number(usageSummary.totalCostUsd || 0).toFixed(2) }} USD cost
              </p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <button class="ui-action-btn" :disabled="isRefreshing" @click="loadAll">
                {{ isRefreshing ? 'Refreshing...' : 'Refresh All' }}
              </button>
              <button class="ui-action-btn" @click="goHome">Back</button>
            </div>
          </header>

          <section ref="dashboardRef" class="mb-8 scroll-mt-6">
            <h2 class="section-title">Overview</h2>
            <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
              <article v-for="card in cards" :key="card.label" class="ui-glass-card rounded-2xl p-4">
                <p class="text-[11px] uppercase tracking-[0.16em] text-white/40">{{ card.label }}</p>
                <p class="mt-3 text-3xl font-semibold text-white">{{ card.value }}</p>
                <p class="mt-2 text-xs text-white/55">{{ card.note }}</p>
              </article>
            </div>

            <div class="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-[1.6fr_1fr]">
              <div class="ui-glass-card rounded-2xl p-4 md:p-5">
                <div class="mb-4 flex items-center justify-between">
                  <h3 class="text-lg font-medium text-white">Usage Trend (Daily)</h3>
                  <span class="text-xs text-white/45">Updated {{ new Date().toLocaleDateString() }}</span>
                </div>
                <div v-if="usageSeries.length === 0" class="rounded-xl border border-dashed border-white/15 p-6 text-sm text-white/50">
                  No usage data
                </div>
                <div v-else class="space-y-3">
                  <div v-for="row in usageSeries" :key="row.date" class="grid grid-cols-[90px_1fr_80px] items-center gap-3">
                    <span class="text-xs text-white/55">{{ row.date }}</span>
                    <div class="h-2 overflow-hidden rounded bg-white/10">
                      <div class="h-full rounded bg-white/50" :style="{ width: `${barWidth(row.total_calls)}%` }" />
                    </div>
                    <span class="text-right text-xs text-white/75">{{ row.total_calls }}</span>
                  </div>
                </div>
              </div>

              <div class="ui-glass-card rounded-2xl p-4 md:p-5">
                <h3 class="text-lg font-medium text-white">Admin Session</h3>
                <div class="mt-4 space-y-3 text-sm">
                  <div class="ui-info-line"><span>Account</span><strong>{{ auth.user.value?.email || '-' }}</strong></div>
                  <div class="ui-info-line"><span>Roles</span><strong>{{ auth.roles.value.join(', ') || '-' }}</strong></div>
                  <div class="ui-info-line"><span>Permissions</span><strong>{{ auth.permissions.value.length }}</strong></div>
                  <div class="ui-info-line"><span>Status</span><strong class="text-white">Active</strong></div>
                </div>
              </div>
            </div>
          </section>

          <section ref="usersRef" class="ui-glass-card mb-8 scroll-mt-6 rounded-2xl p-5 md:p-6">
            <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 class="section-title">Users & Roles</h2>
              <span class="text-xs text-white/45">Role assignment · account lifecycle</span>
            </div>

            <div class="mb-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <div>
                <p class="mb-2 text-xs uppercase tracking-[0.12em] text-white/45">Search User</p>
                <input
                  v-model.trim="userSearchQuery"
                  class="ui-text-input"
                  placeholder="Search by user id or email"
                />
              </div>
              <p class="text-xs text-white/55">
                Showing {{ userPageStart }}-{{ userPageEnd }} of {{ filteredUsers.length }} users
              </p>
            </div>

            <div v-if="filteredUsers.length === 0" class="rounded-xl border border-dashed border-white/15 p-6 text-sm text-white/50">
              {{ users.length === 0 ? 'No user data' : 'No matched users' }}
            </div>
            <div v-else class="overflow-x-auto">
              <table class="w-full min-w-[1100px] text-sm">
                <thead>
                  <tr class="border-b border-white/10 text-left text-xs uppercase tracking-[0.12em] text-white/40">
                    <th class="px-3 py-4">User</th>
                    <th class="px-3 py-4">Status</th>
                    <th class="px-3 py-4">Current Roles</th>
                    <th class="px-3 py-4">Role Select</th>
                    <th class="px-3 py-4">Calls</th>
                    <th class="px-3 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in pagedUsers" :key="item.id" class="border-b border-white/5 align-top hover:bg-white/[0.03]">
                    <td class="px-3 py-4">
                      <p class="font-medium text-white/90">{{ item.displayName || '-' }}</p>
                      <p class="text-xs text-white/50">{{ item.email }}</p>
                      <p class="mt-1 text-[11px] text-white/35">ID: {{ item.id }}</p>
                    </td>
                    <td class="px-3 py-4">
                      <span class="ui-status-pill" :class="statusClass(item.status)">{{ item.status || 'active' }}</span>
                    </td>
                    <td class="px-3 py-4">
                      <div class="flex flex-wrap gap-1.5">
                        <span v-for="role in item.roles || []" :key="`${item.id}-${role}`" class="ui-tag-pill">{{ role }}</span>
                      </div>
                    </td>
                    <td class="px-3 py-4">
                      <div class="flex max-w-[260px] flex-wrap gap-2">
                        <label
                          v-for="role in roleOptions"
                          :key="`${item.id}-${role}`"
                          class="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-xs text-white/65"
                        >
                          <input
                            type="checkbox"
                            :checked="isSelected(item.id, role)"
                            :disabled="item.status === 'deleted'"
                            @change="toggleRole(item.id, role, $event)"
                          />
                          {{ role }}
                        </label>
                      </div>
                    </td>
                    <td class="px-3 py-4 text-white/85">{{ item.usage?.totalCalls || 0 }}</td>
                    <td class="px-3 py-4">
                      <div class="flex flex-wrap gap-2">
                        <button class="ui-micro-btn ui-micro-btn-primary" :disabled="saving[item.id] || item.status === 'deleted'" @click="saveRoles(item)">
                          {{ saving[item.id] ? 'Saving...' : 'Save Roles' }}
                        </button>
                        <button v-if="item.status === 'active'" class="ui-micro-btn" :disabled="statusLoading[item.id]" @click="suspendUser(item)">Suspend</button>
                        <button v-if="item.status === 'suspended'" class="ui-micro-btn" :disabled="statusLoading[item.id]" @click="activateUser(item)">Activate</button>
                        <button class="ui-micro-btn ui-micro-btn-danger" :disabled="deleting[item.id] || item.status === 'deleted'" @click="deleteUser(item)">
                          {{ deleting[item.id] ? 'Deleting...' : 'Delete' }}
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div v-if="totalUserPages > 1" class="mt-5 flex flex-wrap items-center justify-end gap-2">
              <button class="ui-micro-btn" :disabled="userPage <= 1" @click="setUserPage(userPage - 1)">Prev</button>
              <button
                v-for="page in visibleUserPages"
                :key="`user-page-${page}`"
                class="ui-micro-btn"
                :class="{ 'ui-micro-btn-primary': page === userPage }"
                @click="setUserPage(page)"
              >
                {{ page }}
              </button>
              <button class="ui-micro-btn" :disabled="userPage >= totalUserPages" @click="setUserPage(userPage + 1)">Next</button>
            </div>
          </section>

          <section ref="ai302Ref" class="ui-glass-card mb-8 scroll-mt-6 rounded-2xl p-5 md:p-6 space-y-6">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h2 class="section-title">Eager Service Management</h2>
              <button class="ui-micro-btn" :disabled="loading302" @click="load302All">Refresh Service Data</button>
            </div>

            <div class="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div class="ui-glass-card rounded-xl p-4">
                <p class="text-xs uppercase tracking-[0.12em] text-white/40">Account Balance</p>
                <p class="mt-2 text-2xl font-semibold text-white">{{ balanceDisplay }}</p>
              </div>
              <div class="ui-glass-card rounded-xl p-4 md:col-span-3">
                <p class="text-xs uppercase tracking-[0.12em] text-white/40">Deduction Detail (request-id)</p>
                <div class="mt-2 flex flex-wrap gap-2">
                  <input v-model="recordRequestId" class="ui-text-input" placeholder="Paste request-id" />
                  <button class="ui-micro-btn" :disabled="loadingRecord" @click="queryRecord">{{ loadingRecord ? 'Querying...' : 'Query' }}</button>
                </div>
                <div v-if="recordData" class="mt-3 grid grid-cols-2 gap-2 text-xs text-white/75 md:grid-cols-5">
                  <div>Model: {{ recordData.model || '-' }}</div>
                  <div>Cost: {{ recordData.cost ?? '-' }}</div>
                  <div>Input: {{ recordData.input_token ?? '-' }}</div>
                  <div>Output: {{ recordData.output_token ?? '-' }}</div>
                  <div>Latency: {{ recordData.process_time ?? '-' }}</div>
                </div>
              </div>
            </div>

            <div>
              <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 class="text-sm font-medium text-white">API Log Query</h3>
                <div class="flex flex-wrap items-center gap-2">
                  <input v-model="log302Query.start" type="datetime-local" class="ui-text-input !w-[190px]" />
                  <input v-model="log302Query.end" type="datetime-local" class="ui-text-input !w-[190px]" />
                  <input v-model.number="log302Query.page" type="number" min="1" class="ui-number-input" />
                  <input v-model.number="log302Query.limit" type="number" min="1" max="50" class="ui-number-input" />
                  <button class="ui-micro-btn" :disabled="loadingApiLogs" @click="loadApiLogs">Search</button>
                </div>
              </div>
              <div v-if="apiLogs.length === 0" class="rounded-xl border border-dashed border-white/15 p-4 text-sm text-white/50">No API logs</div>
              <div v-else class="overflow-x-auto">
                <table class="w-full min-w-[860px] text-sm">
                  <thead>
                    <tr class="border-b border-white/10 text-left text-xs uppercase tracking-[0.12em] text-white/40">
                      <th class="px-2 py-2">Request ID</th>
                      <th class="px-2 py-2">Model</th>
                      <th class="px-2 py-2">Cost</th>
                      <th class="px-2 py-2">Status</th>
                      <th class="px-2 py-2">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(item, idx) in apiLogs" :key="item.request_id || item.id || idx" class="border-b border-white/5">
                      <td class="px-2 py-2 text-white/80">{{ item.request_id || item.requestId || item.id || '-' }}</td>
                      <td class="px-2 py-2 text-white/80">{{ item.model || item.model_name || '-' }}</td>
                      <td class="px-2 py-2 text-white/80">{{ item.cost ?? item.cost_usd ?? '-' }}</td>
                      <td class="px-2 py-2 text-white/70">{{ item.status || item.code || '-' }}</td>
                      <td class="px-2 py-2 text-white/60">{{ item.created_at || item.createdAt || item.time || '-' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h3 class="text-sm font-medium text-white">Create API Key</h3>
              <div class="mt-2 grid grid-cols-1 gap-2 md:grid-cols-4">
                <input v-model="createKeyForm.api_name" class="ui-text-input" placeholder="api_name" />
                <input v-model.number="createKeyForm.limit_cost" type="number" min="0" class="ui-text-input" placeholder="limit_cost" />
                <input v-model.number="createKeyForm.limit_daily_cost" type="number" min="0" class="ui-text-input" placeholder="limit_daily_cost" />
                <input v-model.number="createKeyForm.expired_on" type="number" min="0" class="ui-text-input" placeholder="expired_on(unix)" />
              </div>
              <div class="mt-2 flex flex-wrap gap-3 text-xs text-white/65">
                <label><input v-model="createKeyForm.allow_save_logs" type="checkbox" /> allow_save_logs</label>
                <label><input v-model="createKeyForm.allow_custom_model" type="checkbox" /> allow_custom_model</label>
                <label><input v-model="createKeyForm.allow_manage_key" type="checkbox" /> allow_manage_key</label>
              </div>
              <button class="ui-micro-btn ui-micro-btn-primary mt-2" :disabled="creatingApiKey" @click="createApiKey">
                {{ creatingApiKey ? 'Creating...' : 'Create Key' }}
              </button>
            </div>

            <div>
              <h3 class="text-sm font-medium text-white">API Keys (Create / Update / Delete)</h3>
              <div v-if="apiKeys.length === 0" class="mt-2 rounded-xl border border-dashed border-white/15 p-4 text-sm text-white/50">No API keys</div>
              <div v-else class="mt-2 overflow-x-auto">
                <table class="w-full min-w-[1100px] text-sm">
                  <thead>
                    <tr class="border-b border-white/10 text-left text-xs uppercase tracking-[0.12em] text-white/40">
                      <th class="px-2 py-2">Name</th>
                      <th class="px-2 py-2">API Key</th>
                      <th class="px-2 py-2">Current Cost</th>
                      <th class="px-2 py-2">Limit Cost</th>
                      <th class="px-2 py-2">Daily Limit</th>
                      <th class="px-2 py-2">Expire</th>
                      <th class="px-2 py-2">Flags</th>
                      <th class="px-2 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="item in apiKeys" :key="item.id || item.api_name" class="border-b border-white/5 align-top">
                      <td class="px-2 py-2 text-white/85">{{ item.api_name }}</td>
                      <td class="px-2 py-2 text-white/70">{{ maskApiKey(item.api_key) }}</td>
                      <td class="px-2 py-2 text-white/75">{{ item.current_cost ?? 0 }}</td>
                      <td class="px-2 py-2"><input v-model.number="keyDrafts[item.api_name].limit_cost" type="number" min="0" class="ui-text-input !w-[110px]" /></td>
                      <td class="px-2 py-2"><input v-model.number="keyDrafts[item.api_name].limit_daily_cost" type="number" min="0" class="ui-text-input !w-[110px]" /></td>
                      <td class="px-2 py-2"><input v-model.number="keyDrafts[item.api_name].expired_on" type="number" min="0" class="ui-text-input !w-[120px]" /></td>
                      <td class="px-2 py-2 text-xs text-white/65">
                        <label class="block"><input v-model="keyDrafts[item.api_name].allow_save_logs" type="checkbox" /> logs</label>
                        <label class="block"><input v-model="keyDrafts[item.api_name].allow_custom_model" type="checkbox" /> custom model</label>
                        <label class="block"><input v-model="keyDrafts[item.api_name].allow_manage_key" type="checkbox" /> manage key</label>
                      </td>
                      <td class="px-2 py-2">
                        <div class="flex flex-wrap gap-2">
                          <button class="ui-micro-btn" :disabled="updatingKeys[item.api_name]" @click="updateApiKey(item)">
                            {{ updatingKeys[item.api_name] ? 'Saving...' : 'Update' }}
                          </button>
                          <button class="ui-micro-btn ui-micro-btn-danger" :disabled="deletingKeys[item.api_name]" @click="removeApiKey(item)">
                            {{ deletingKeys[item.api_name] ? 'Deleting...' : 'Delete' }}
                          </button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section ref="auditRef" class="ui-glass-card scroll-mt-6 rounded-2xl p-5 md:p-6">
            <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 class="section-title">Admin Audit Logs</h2>
              <div class="flex items-center gap-2 text-xs">
                <input v-model.number="logQuery.page" type="number" min="1" class="ui-number-input" />
                <input v-model.number="logQuery.limit" type="number" min="1" max="100" class="ui-number-input" />
                <button class="ui-micro-btn" :disabled="loadingLogs" @click="loadLogs">Search</button>
              </div>
            </div>

            <div v-if="auditLogs.length === 0" class="rounded-xl border border-dashed border-white/15 p-6 text-sm text-white/50">No audit logs</div>
            <div v-else class="overflow-x-auto">
              <table class="w-full min-w-[980px] text-sm">
                <thead>
                  <tr class="border-b border-white/10 text-left text-xs uppercase tracking-[0.12em] text-white/40">
                    <th class="px-3 py-3">Time</th>
                    <th class="px-3 py-3">Action</th>
                    <th class="px-3 py-3">Operator</th>
                    <th class="px-3 py-3">Target</th>
                    <th class="px-3 py-3">Metadata</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="log in auditLogs" :key="log.id" class="border-b border-white/5 align-top hover:bg-white/[0.03]">
                    <td class="px-3 py-3 text-xs text-white/70">{{ formatDateTime(log.createdAt) }}</td>
                    <td class="px-3 py-3 text-white/85">{{ log.action }}</td>
                    <td class="px-3 py-3 text-white/75">{{ log.operator?.email || '-' }}</td>
                    <td class="px-3 py-3 text-white/75">{{ log.target?.email || '-' }}</td>
                    <td class="px-3 py-3"><pre class="max-w-[420px] whitespace-pre-wrap text-xs text-white/55">{{ toPrettyJson(log.metadata) }}</pre></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p class="mt-3 text-xs text-white/45">Page {{ pagination.page }} · Limit {{ pagination.limit }} · Total {{ pagination.total }}</p>
          </section>
        </main>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  createAdmin302ApiKey,
  deleteAdmin302ApiKey,
  deleteAdminUser,
  getAdmin302ApiKeys,
  getAdmin302ApiRecord,
  getAdmin302Balance,
  getAdmin302Record,
  getAdminAuditLogs,
  getAdminUsageSummary,
  getAdminUsageTimeseries,
  getAdminUsers,
  updateAdmin302ApiKey,
  updateAdminUserRoles,
  updateAdminUserStatus
} from '@/api/admin'
import { useAuthStore } from '@/stores/auth'
import { getErrorMessage } from '@/utils'

const router = useRouter()
const auth = useAuthStore()

const navItems = [
  { key: 'overview', label: 'Overview' },
  { key: 'users', label: 'Users & Roles' },
  { key: 'ai302', label: 'Eager Service' },
  { key: 'audit', label: 'Audit Logs' }
]
const activeSection = ref('overview')
const adminShellRef = ref(null)

const dashboardRef = ref(null)
const usersRef = ref(null)
const ai302Ref = ref(null)
const auditRef = ref(null)

const roleOptions = ['super_admin', 'admin', 'ops', 'support', 'user']
const users = ref([])
const userSearchQuery = ref('')
const userPage = ref(1)
const userPageSize = 10
const selectedRoles = ref({})
const saving = ref({})
const statusLoading = ref({})
const deleting = ref({})
const loadingUsers = ref(false)

const usageSummary = ref({
  totalCalls: 0,
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalImages: 0,
  totalVideoSeconds: 0,
  totalCostUsd: 0,
  totalUsers: 0
})
const usageSeries = ref([])
const loadingUsage = ref(false)

const auditLogs = ref([])
const loadingLogs = ref(false)
const pagination = ref({ page: 1, limit: 20, total: 0 })
const logQuery = ref({ page: 1, limit: 20 })

const balance = ref('')
const loadingBalance = ref(false)
const recordRequestId = ref('')
const recordData = ref(null)
const loadingRecord = ref(false)
const log302Query = reactive({ page: 1, limit: 20, start: '', end: '' })
const apiLogs = ref([])
const loadingApiLogs = ref(false)
const apiKeys = ref([])
const keyDrafts = ref({})
const loadingKeys = ref(false)
const creatingApiKey = ref(false)
const updatingKeys = ref({})
const deletingKeys = ref({})
const createKeyForm = reactive({
  api_name: '',
  allow_save_logs: false,
  allow_custom_model: false,
  allow_manage_key: false,
  limit_cost: 0,
  limit_daily_cost: 0,
  expired_on: 0
})

const isRefreshing = computed(() => loadingUsage.value || loadingUsers.value || loadingLogs.value || loading302.value)
const loading302 = computed(() => loadingBalance.value || loadingRecord.value || loadingApiLogs.value || loadingKeys.value)
const balanceDisplay = computed(() => (balance.value ? `$${balance.value}` : '--'))

const displayName = computed(() => {
  const name = auth.user.value?.displayName || ''
  return name.trim() || auth.user.value?.email || 'Admin'
})

const cards = computed(() => [
  { label: 'Total Calls', value: usageSummary.value.totalCalls || 0, note: 'Global request volume' },
  { label: 'Active Users', value: usageSummary.value.totalUsers || 0, note: 'User base in scope' },
  { label: 'Input Tokens', value: usageSummary.value.totalInputTokens || 0, note: 'Prompt consumption' },
  { label: 'Output Tokens', value: usageSummary.value.totalOutputTokens || 0, note: 'Generation volume' },
  { label: 'Images', value: usageSummary.value.totalImages || 0, note: 'Rendered images' },
  { label: 'Cost (USD)', value: Number(usageSummary.value.totalCostUsd || 0).toFixed(4), note: 'Aggregated spend' }
])

const filteredUsers = computed(() => {
  const keyword = String(userSearchQuery.value || '').trim().toLowerCase()
  if (!keyword) return users.value
  return users.value.filter((item) => {
    const id = String(item.id || '').toLowerCase()
    const email = String(item.email || '').toLowerCase()
    return id.includes(keyword) || email.includes(keyword)
  })
})

const totalUserPages = computed(() => Math.max(1, Math.ceil(filteredUsers.value.length / userPageSize)))

const pagedUsers = computed(() => {
  const start = (userPage.value - 1) * userPageSize
  return filteredUsers.value.slice(start, start + userPageSize)
})

const userPageStart = computed(() => {
  if (filteredUsers.value.length === 0) return 0
  return (userPage.value - 1) * userPageSize + 1
})

const userPageEnd = computed(() => {
  if (filteredUsers.value.length === 0) return 0
  return Math.min(userPage.value * userPageSize, filteredUsers.value.length)
})

const visibleUserPages = computed(() => {
  const total = totalUserPages.value
  const current = userPage.value
  if (total <= 5) return Array.from({ length: total }, (_, idx) => idx + 1)
  if (current <= 3) return [1, 2, 3, 4, 5]
  if (current >= total - 2) return [total - 4, total - 3, total - 2, total - 1, total]
  return [current - 2, current - 1, current, current + 1, current + 2]
})

const goHome = () => router.push('/')

const getSectionEl = (key) => {
  if (key === 'users') return usersRef.value
  if (key === 'ai302') return ai302Ref.value
  if (key === 'audit') return auditRef.value
  return dashboardRef.value
}

const scrollToSection = (key) => {
  activeSection.value = key
  const el = getSectionEl(key)
  if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const onMainScroll = () => {
  const sections = [
    { key: 'overview', el: dashboardRef.value },
    { key: 'users', el: usersRef.value },
    { key: 'ai302', el: ai302Ref.value },
    { key: 'audit', el: auditRef.value }
  ].filter((item) => !!item.el)

  let candidate = sections[0]?.key || 'overview'
  let min = Number.POSITIVE_INFINITY
  for (const item of sections) {
    const top = Math.abs(item.el.getBoundingClientRect().top - 120)
    if (top < min) {
      min = top
      candidate = item.key
    }
  }
  activeSection.value = candidate
}

const setUserPage = (page) => {
  const next = Math.min(Math.max(Number(page) || 1, 1), totalUserPages.value)
  userPage.value = next
}

watch(userSearchQuery, () => {
  userPage.value = 1
})

watch(filteredUsers, () => {
  if (userPage.value > totalUserPages.value) {
    userPage.value = totalUserPages.value
  }
})

const statusClass = (status) => {
  const val = String(status || 'active')
  if (val === 'suspended') return 'ui-status-pill-suspended'
  if (val === 'deleted') return 'ui-status-pill-deleted'
  return 'ui-status-pill-active'
}

const formatDateTime = (value) => {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString()
}

const barWidth = (value) => {
  const max = Math.max(...usageSeries.value.map((item) => Number(item.total_calls || 0)), 1)
  return Math.round((Number(value || 0) / max) * 100)
}

const toPrettyJson = (value) => {
  try {
    return JSON.stringify(value || {}, null, 2)
  } catch {
    return '{}'
  }
}

const isSelected = (userId, role) => {
  const list = selectedRoles.value[userId] || []
  return list.includes(role)
}

const toggleRole = (userId, role, event) => {
  const checked = !!event?.target?.checked
  const list = [...(selectedRoles.value[userId] || [])]
  const set = new Set(list)
  if (checked) set.add(role)
  else set.delete(role)
  selectedRoles.value[userId] = [...set]
}

const maskApiKey = (value) => {
  const key = String(value || '')
  if (key.length <= 10) return key || '-'
  return `${key.slice(0, 6)}...${key.slice(-4)}`
}

const toUnixSeconds = (value) => {
  if (!value) return undefined
  const ts = Date.parse(value)
  return Number.isFinite(ts) ? Math.floor(ts / 1000) : undefined
}

const buildDraft = (item) => ({
  api_name: item.api_name,
  allow_save_logs: !!item.allow_save_logs,
  allow_custom_model: !!item.allow_custom_model,
  allow_manage_key: !!item.allow_manage_key,
  limit_cost: Number(item.limit_cost || 0),
  limit_daily_cost: Number(item.limit_daily_cost || 0),
  expired_on: Number(item.expired_on || 0)
})

const loadUsage = async () => {
  loadingUsage.value = true
  try {
    const [summaryRsp, seriesRsp] = await Promise.all([getAdminUsageSummary(), getAdminUsageTimeseries()])
    usageSummary.value = summaryRsp?.data || usageSummary.value
    usageSeries.value = Array.isArray(seriesRsp?.data) ? seriesRsp.data : []
  } catch (error) {
    if (!error?.__handled) window.$message?.error(getErrorMessage(error, 'Failed to load usage dashboard'))
  } finally {
    loadingUsage.value = false
  }
}

const loadUsers = async () => {
  loadingUsers.value = true
  try {
    const rsp = await getAdminUsers()
    const list = Array.isArray(rsp?.data) ? rsp.data : []
    users.value = list
    const nextSelection = {}
    for (const item of list) nextSelection[item.id] = Array.isArray(item.roles) ? [...item.roles] : ['user']
    selectedRoles.value = nextSelection
  } catch (error) {
    if (!error?.__handled) window.$message?.error(getErrorMessage(error, 'Failed to load users'))
  } finally {
    loadingUsers.value = false
  }
}

const saveRoles = async (user) => {
  const roles = [...new Set((selectedRoles.value[user.id] || []).filter(Boolean))]
  if (!roles.length) return window.$message?.warning('At least one role is required')
  saving.value = { ...saving.value, [user.id]: true }
  try {
    await updateAdminUserRoles(user.id, roles)
    window.$message?.success('Roles updated')
    await Promise.all([loadUsers(), loadLogs()])
  } catch (error) {
    if (!error?.__handled) window.$message?.error(getErrorMessage(error, 'Failed to update roles'))
  } finally {
    saving.value = { ...saving.value, [user.id]: false }
  }
}

const suspendUser = async (user) => {
  const reason = window.prompt('Suspend reason (optional):', '') || ''
  statusLoading.value = { ...statusLoading.value, [user.id]: true }
  try {
    await updateAdminUserStatus(user.id, 'suspended', reason)
    window.$message?.success('User suspended')
    await Promise.all([loadUsers(), loadLogs()])
  } catch (error) {
    if (!error?.__handled) window.$message?.error(getErrorMessage(error, 'Failed to suspend user'))
  } finally {
    statusLoading.value = { ...statusLoading.value, [user.id]: false }
  }
}

const activateUser = async (user) => {
  statusLoading.value = { ...statusLoading.value, [user.id]: true }
  try {
    await updateAdminUserStatus(user.id, 'active')
    window.$message?.success('User activated')
    await Promise.all([loadUsers(), loadLogs()])
  } catch (error) {
    if (!error?.__handled) window.$message?.error(getErrorMessage(error, 'Failed to activate user'))
  } finally {
    statusLoading.value = { ...statusLoading.value, [user.id]: false }
  }
}

const deleteUser = async (user) => {
  const ok = window.confirm(`Delete user ${user.email}? This will disable account access.`)
  if (!ok) return
  deleting.value = { ...deleting.value, [user.id]: true }
  try {
    await deleteAdminUser(user.id)
    window.$message?.success('User deleted')
    await Promise.all([loadUsers(), loadLogs()])
  } catch (error) {
    if (!error?.__handled) window.$message?.error(getErrorMessage(error, 'Failed to delete user'))
  } finally {
    deleting.value = { ...deleting.value, [user.id]: false }
  }
}

const load302Balance = async () => {
  loadingBalance.value = true
  try {
    const rsp = await getAdmin302Balance()
    balance.value = String(rsp?.data?.balance ?? '')
  } catch (error) {
    if (!error?.__handled) window.$message?.error(getErrorMessage(error, 'Failed to load Eager Service balance'))
  } finally {
    loadingBalance.value = false
  }
}

const queryRecord = async () => {
  const id = String(recordRequestId.value || '').trim()
  if (!id) return window.$message?.warning('Please input request-id')
  loadingRecord.value = true
  try {
    const rsp = await getAdmin302Record(id)
    recordData.value = rsp?.data || null
  } catch (error) {
    if (!error?.__handled) window.$message?.error(getErrorMessage(error, 'Failed to query record'))
  } finally {
    loadingRecord.value = false
  }
}

const loadApiLogs = async () => {
  loadingApiLogs.value = true
  try {
    const rsp = await getAdmin302ApiRecord({
      page: log302Query.page,
      limit: log302Query.limit,
      start_time: toUnixSeconds(log302Query.start),
      end_time: toUnixSeconds(log302Query.end)
    })
    apiLogs.value = Array.isArray(rsp?.data?.items) ? rsp.data.items : []
  } catch (error) {
    if (!error?.__handled) window.$message?.error(getErrorMessage(error, 'Failed to load API logs'))
  } finally {
    loadingApiLogs.value = false
  }
}

const loadApiKeys = async () => {
  loadingKeys.value = true
  try {
    const rsp = await getAdmin302ApiKeys()
    const list = Array.isArray(rsp?.data) ? rsp.data : []
    apiKeys.value = list
    const drafts = {}
    for (const item of list) drafts[item.api_name] = buildDraft(item)
    keyDrafts.value = drafts
  } catch (error) {
    if (!error?.__handled) window.$message?.error(getErrorMessage(error, 'Failed to load API keys'))
  } finally {
    loadingKeys.value = false
  }
}

const createApiKey = async () => {
  if (!String(createKeyForm.api_name || '').trim()) return window.$message?.warning('api_name is required')
  creatingApiKey.value = true
  try {
    await createAdmin302ApiKey({ ...createKeyForm, api_name: createKeyForm.api_name.trim() })
    window.$message?.success('API key created')
    createKeyForm.api_name = ''
    createKeyForm.allow_save_logs = false
    createKeyForm.allow_custom_model = false
    createKeyForm.allow_manage_key = false
    createKeyForm.limit_cost = 0
    createKeyForm.limit_daily_cost = 0
    createKeyForm.expired_on = 0
    await loadApiKeys()
  } catch (error) {
    if (!error?.__handled) window.$message?.error(getErrorMessage(error, 'Failed to create API key'))
  } finally {
    creatingApiKey.value = false
  }
}

const updateApiKey = async (item) => {
  const name = item.api_name
  const draft = keyDrafts.value[name]
  if (!draft) return
  updatingKeys.value = { ...updatingKeys.value, [name]: true }
  try {
    await updateAdmin302ApiKey(name, { ...draft, api_name: name })
    window.$message?.success('API key updated')
    await loadApiKeys()
  } catch (error) {
    if (!error?.__handled) window.$message?.error(getErrorMessage(error, 'Failed to update API key'))
  } finally {
    updatingKeys.value = { ...updatingKeys.value, [name]: false }
  }
}

const removeApiKey = async (item) => {
  const name = item.api_name
  const ok = window.confirm(`Delete API key ${name}?`)
  if (!ok) return
  deletingKeys.value = { ...deletingKeys.value, [name]: true }
  try {
    await deleteAdmin302ApiKey(name)
    window.$message?.success('API key deleted')
    await loadApiKeys()
  } catch (error) {
    if (!error?.__handled) window.$message?.error(getErrorMessage(error, 'Failed to delete API key'))
  } finally {
    deletingKeys.value = { ...deletingKeys.value, [name]: false }
  }
}

const load302All = async () => {
  await Promise.all([load302Balance(), loadApiLogs(), loadApiKeys()])
}

const loadLogs = async () => {
  loadingLogs.value = true
  try {
    const rsp = await getAdminAuditLogs({ page: logQuery.value.page, limit: logQuery.value.limit })
    auditLogs.value = Array.isArray(rsp?.data) ? rsp.data : []
    pagination.value = {
      page: Number(rsp?.pagination?.page || logQuery.value.page || 1),
      limit: Number(rsp?.pagination?.limit || logQuery.value.limit || 20),
      total: Number(rsp?.pagination?.total || 0)
    }
  } catch (error) {
    if (!error?.__handled) window.$message?.error(getErrorMessage(error, 'Failed to load audit logs'))
  } finally {
    loadingLogs.value = false
  }
}

const loadAll = async () => {
  await Promise.all([loadUsage(), loadUsers(), load302All(), loadLogs()])
}

onMounted(async () => {
  await loadAll()
  await nextTick()
  onMainScroll()
  const scrollTarget = adminShellRef.value || window
  scrollTarget.addEventListener('scroll', onMainScroll, { passive: true })
})

onBeforeUnmount(() => {
  const scrollTarget = adminShellRef.value || window
  scrollTarget.removeEventListener('scroll', onMainScroll)
})
</script>

<style scoped>
.admin-shell {
  background:
    radial-gradient(900px 420px at 16% -10%, rgba(255, 255, 255, 0.05), transparent 60%),
    radial-gradient(900px 420px at 88% -12%, rgba(255, 255, 255, 0.04), transparent 60%),
    linear-gradient(180deg, #0a0a0b 0%, #09090a 100%);
  font-family: 'Sora', 'Avenir Next', 'SF Pro Text', sans-serif;
}

.admin-frame {
  background: linear-gradient(180deg, #141416 0%, #101012 100%);
  box-shadow: 0 22px 80px rgba(0, 0, 0, 0.45);
}

.admin-sidebar {
  background: linear-gradient(180deg, rgba(8, 8, 9, 0.72) 0%, rgba(12, 12, 14, 0.8) 100%);
}

.admin-main {
  background: linear-gradient(180deg, rgba(18, 18, 20, 0.72) 0%, rgba(11, 11, 13, 0.84) 100%);
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
}

.menu-item {
  width: 100%;
  border-radius: 12px;
  border: 1px solid transparent;
  padding: 10px 12px;
  text-align: left;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.62);
  transition: all 0.2s ease;
}

.menu-item:hover {
  color: rgba(255, 255, 255, 0.92);
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.12);
}

.menu-item-active {
  color: rgba(255, 255, 255, 0.94);
  background: rgba(255, 255, 255, 0.09);
  border-color: rgba(255, 255, 255, 0.2);
}

</style>
