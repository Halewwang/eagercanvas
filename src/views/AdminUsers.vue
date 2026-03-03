<template>
  <div class="admin-shell min-h-screen overflow-y-auto px-3 py-4 md:px-6 md:py-6">
    <div class="admin-frame w-full rounded-[20px] border border-white/10">
      <div class="grid grid-cols-1 lg:grid-cols-[240px_1fr]">
        <aside class="admin-sidebar hidden border-r border-white/10 lg:flex lg:flex-col">
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
              @click="goSection(item.route)"
            >
              {{ item.label }}
            </button>
          </nav>

          <div class="mt-auto p-4">
            <div class="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p class="text-sm font-medium text-white/90">Control Center</p>
              <p class="mt-2 text-xs leading-5 text-white/55">User lifecycle, role assignment and global usage governance.</p>
            </div>
          </div>
        </aside>

        <main class="admin-main p-4 md:p-6">
          <div class="mb-4 flex flex-wrap gap-2 lg:hidden">
            <button
              v-for="item in navItems"
              :key="`mobile-${item.key}`"
              class="tiny-btn"
              :class="{ 'tiny-btn-primary': activeSection === item.key }"
              @click="goSection(item.route)"
            >
              {{ item.label }}
            </button>
          </div>

          <header class="mb-6 flex flex-col gap-4 border-b border-white/10 pb-5 md:flex-row md:items-start md:justify-between">
            <div>
              <p class="text-xs uppercase tracking-[0.2em] text-white/45">{{ sectionTitle }}</p>
              <h1 class="mt-2 text-2xl font-semibold text-white md:text-3xl">Welcome Back, {{ displayName }}</h1>
              <p class="mt-2 text-sm text-white/55">
                {{ usageSummary.totalUsers || 0 }} active members · {{ usageSummary.totalCalls || 0 }} calls ·
                {{ Number(usageSummary.totalCostUsd || 0).toFixed(2) }} USD cost
              </p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <button class="action-btn" :disabled="loadingUsage || loadingUsers || loadingLogs" @click="loadAll">
                {{ loadingUsage || loadingUsers || loadingLogs ? 'Refreshing...' : 'Refresh All' }}
              </button>
              <button class="action-btn" @click="goHome">Back</button>
            </div>
          </header>

          <template v-if="activeSection === 'dashboard'">
            <section class="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <article v-for="card in cards" :key="card.label" class="stat-card rounded-2xl p-4">
                <p class="text-[11px] uppercase tracking-[0.16em] text-white/40">{{ card.label }}</p>
                <p class="mt-3 text-3xl font-semibold text-white">{{ card.value }}</p>
                <p class="mt-2 text-xs text-white/55">{{ card.note }}</p>
              </article>
            </section>

            <section class="grid grid-cols-1 gap-4 xl:grid-cols-[1.6fr_1fr]">
              <div class="panel-card rounded-2xl p-4 md:p-5">
                <div class="mb-4 flex items-center justify-between">
                  <h2 class="text-lg font-medium text-white">Usage Trend (Daily)</h2>
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

              <div class="panel-card rounded-2xl p-4 md:p-5">
                <h2 class="text-lg font-medium text-white">Admin Session</h2>
                <div class="mt-4 space-y-3 text-sm">
                  <div class="info-line"><span>Account</span><strong>{{ auth.user.value?.email || '-' }}</strong></div>
                  <div class="info-line"><span>Roles</span><strong>{{ auth.roles.value.join(', ') || '-' }}</strong></div>
                  <div class="info-line"><span>Permissions</span><strong>{{ auth.permissions.value.length }}</strong></div>
                  <div class="info-line"><span>Status</span><strong class="text-white">Active</strong></div>
                </div>
              </div>
            </section>
          </template>

          <section v-if="activeSection === 'users'" class="panel-card rounded-2xl p-4 md:p-5">
            <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 class="text-lg font-medium text-white">Users & Roles</h2>
              <span class="text-xs text-white/45">Role assignment · account lifecycle</span>
            </div>

            <div v-if="users.length === 0" class="rounded-xl border border-dashed border-white/15 p-6 text-sm text-white/50">No user data</div>
            <div v-else class="overflow-x-auto">
              <table class="w-full min-w-[1100px] text-sm">
                <thead>
                  <tr class="border-b border-white/10 text-left text-xs uppercase tracking-[0.12em] text-white/40">
                    <th class="px-3 py-3">User</th>
                    <th class="px-3 py-3">Status</th>
                    <th class="px-3 py-3">Current Roles</th>
                    <th class="px-3 py-3">Role Select</th>
                    <th class="px-3 py-3">Calls</th>
                    <th class="px-3 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in users" :key="item.id" class="border-b border-white/5 align-top hover:bg-white/[0.03]">
                    <td class="px-3 py-3">
                      <p class="font-medium text-white/90">{{ item.displayName || '-' }}</p>
                      <p class="text-xs text-white/50">{{ item.email }}</p>
                    </td>
                    <td class="px-3 py-3">
                      <span class="status-pill" :class="statusClass(item.status)">{{ item.status || 'active' }}</span>
                    </td>
                    <td class="px-3 py-3">
                      <div class="flex flex-wrap gap-1.5">
                        <span v-for="role in item.roles || []" :key="`${item.id}-${role}`" class="tag-pill">{{ role }}</span>
                      </div>
                    </td>
                    <td class="px-3 py-3">
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
                    <td class="px-3 py-3 text-white/85">{{ item.usage?.totalCalls || 0 }}</td>
                    <td class="px-3 py-3">
                      <div class="flex flex-wrap gap-2">
                        <button class="tiny-btn tiny-btn-primary" :disabled="saving[item.id] || item.status === 'deleted'" @click="saveRoles(item)">
                          {{ saving[item.id] ? 'Saving...' : 'Save Roles' }}
                        </button>
                        <button v-if="item.status === 'active'" class="tiny-btn" :disabled="statusLoading[item.id]" @click="suspendUser(item)">
                          Suspend
                        </button>
                        <button v-if="item.status === 'suspended'" class="tiny-btn" :disabled="statusLoading[item.id]" @click="activateUser(item)">
                          Activate
                        </button>
                        <button class="tiny-btn tiny-btn-danger" :disabled="deleting[item.id] || item.status === 'deleted'" @click="deleteUser(item)">
                          {{ deleting[item.id] ? 'Deleting...' : 'Delete' }}
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section v-if="activeSection === 'audit'" class="panel-card rounded-2xl p-4 md:p-5">
            <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 class="text-lg font-medium text-white">Admin Audit Logs</h2>
              <div class="flex items-center gap-2 text-xs">
                <input v-model.number="logQuery.page" type="number" min="1" class="query-input" />
                <input v-model.number="logQuery.limit" type="number" min="1" max="100" class="query-input" />
                <button class="tiny-btn" :disabled="loadingLogs" @click="loadLogs">Search</button>
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
                    <td class="px-3 py-3">
                      <pre class="max-w-[420px] whitespace-pre-wrap text-xs text-white/55">{{ toPrettyJson(log.metadata) }}</pre>
                    </td>
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
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  deleteAdminUser,
  getAdminAuditLogs,
  getAdminUsageSummary,
  getAdminUsageTimeseries,
  getAdminUsers,
  updateAdminUserRoles,
  updateAdminUserStatus
} from '@/api/admin'
import { useAuthStore } from '@/stores/auth'
import { getErrorMessage } from '@/utils'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const navItems = [
  { key: 'dashboard', label: 'Dashboard', route: '/admin/dashboard' },
  { key: 'users', label: 'Users & Roles', route: '/admin/users' },
  { key: 'audit', label: 'Audit Logs', route: '/admin/audit' }
]

const roleOptions = ['super_admin', 'admin', 'ops', 'support', 'user']
const users = ref([])
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

const activeSection = computed(() => String(route.meta?.adminSection || 'dashboard'))
const sectionTitle = computed(() => {
  if (activeSection.value === 'users') return 'Users'
  if (activeSection.value === 'audit') return 'Audit Logs'
  return 'Dashboard'
})

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

const goHome = () => router.push('/')
const goSection = (path) => router.push(path)

const statusClass = (status) => {
  const val = String(status || 'active')
  if (val === 'suspended') return 'status-pill-suspended'
  if (val === 'deleted') return 'status-pill-deleted'
  return 'status-pill-active'
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

const loadUsage = async () => {
  loadingUsage.value = true
  try {
    const [summaryRsp, seriesRsp] = await Promise.all([
      getAdminUsageSummary(),
      getAdminUsageTimeseries()
    ])
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
  if (!roles.length) {
    window.$message?.warning('At least one role is required')
    return
  }
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
  await Promise.all([loadUsage(), loadUsers(), loadLogs()])
}

onMounted(async () => {
  await loadAll()
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

.admin-main {
  background: linear-gradient(180deg, rgba(18, 18, 20, 0.72) 0%, rgba(11, 11, 13, 0.84) 100%);
}

.action-btn {
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.06);
  padding: 9px 14px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.9);
}

.action-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.panel-card,
.stat-card {
  border: 1px solid rgba(255, 255, 255, 0.11);
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.015) 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.info-line {
  display: flex;
  justify-content: space-between;
  border-bottom: 1px dashed rgba(255, 255, 255, 0.12);
  padding-bottom: 8px;
  color: rgba(255, 255, 255, 0.6);
}

.info-line strong {
  color: rgba(255, 255, 255, 0.9);
}

.tag-pill {
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  padding: 3px 9px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.85);
}

.status-pill {
  border-radius: 999px;
  border: 1px solid transparent;
  padding: 4px 10px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.status-pill-active {
  border-color: rgba(255, 255, 255, 0.35);
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.95);
}

.status-pill-suspended {
  border-color: rgba(180, 180, 180, 0.4);
  background: rgba(180, 180, 180, 0.16);
  color: rgba(232, 232, 232, 0.95);
}

.status-pill-deleted {
  border-color: rgba(110, 110, 110, 0.48);
  background: rgba(110, 110, 110, 0.18);
  color: rgba(210, 210, 210, 0.92);
}

.tiny-btn {
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.06);
  padding: 5px 10px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.9);
}

.tiny-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.tiny-btn-primary {
  border-color: rgba(255, 255, 255, 0.4);
  background: rgba(255, 255, 255, 0.16);
}

.tiny-btn-danger {
  border-color: rgba(120, 120, 120, 0.45);
  background: rgba(90, 90, 90, 0.2);
}

.query-input {
  width: 72px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.06);
  padding: 6px 8px;
  color: rgba(255, 255, 255, 0.9);
}
</style>
