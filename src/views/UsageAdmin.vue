<template>
  <div class="usage-admin-shell min-h-screen overflow-x-hidden px-3 py-4 text-white md:px-6 md:py-6">
    <div class="usage-admin-frame w-full rounded-[20px] border border-white/10">
      <div class="usage-admin-layout relative">
        <aside class="usage-admin-sidebar hidden lg:fixed lg:bottom-6 lg:left-6 lg:top-6 lg:flex lg:w-[232px] lg:flex-col lg:overflow-hidden lg:rounded-[20px]">
          <div class="px-5 pt-5">
            <div class="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
              <p class="text-xs uppercase tracking-[0.18em] text-white/45">EagerCanvas</p>
              <p class="mt-1 text-sm font-medium text-white/90">Usage Admin</p>
              <p class="mt-3 text-xs leading-5 text-white/55">Eager Service key management and consumption review.</p>
            </div>
          </div>

          <nav class="mt-6 space-y-1 px-4">
            <a class="usage-nav-item usage-nav-item-active" href="#overview">
              <span>Overview</span>
              <span>Live</span>
            </a>
            <a class="usage-nav-item" href="#keys">
              <span>API Keys</span>
              <span>{{ apiKeys.length }}</span>
            </a>
            <a class="usage-nav-item" href="#users">
              <span>Users</span>
              <span>{{ users.length }}</span>
            </a>
          </nav>

          <div class="mt-auto p-4">
            <div class="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p class="text-sm font-medium text-white/90">Current session</p>
              <p class="mt-2 text-xs text-white/55">{{ adminSession?.admin?.username || 'Not signed in' }}</p>
              <p class="mt-1 text-xs text-white/45">{{ isAdminAuthenticated ? 'Usage admin access' : 'Login required' }}</p>
            </div>
          </div>
        </aside>

        <main class="usage-admin-main w-full min-w-0 p-5 md:p-7 lg:pl-[260px]">
          <header class="mb-8 border-b border-white/10 pb-6">
            <div class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div class="max-w-3xl">
                <p class="text-xs uppercase tracking-[0.2em] text-white/45">管理控制台</p>
                <h1 class="mt-2 text-2xl font-semibold text-white md:text-3xl">Usage Admin</h1>
                <p class="mt-3 text-sm leading-6 text-white/55">
                  Eager Service key management, assignment, and user consumption are grouped in one control surface.
                </p>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <button v-if="isAdminAuthenticated" class="usage-action-btn" :disabled="loadingAll" @click="loadAll">
                  {{ loadingAll ? 'Refreshing...' : 'Refresh data' }}
                </button>
                <button v-if="isAdminAuthenticated" class="usage-action-btn" @click="logout">Logout</button>
                <button class="usage-action-btn" @click="goHome">Home</button>
              </div>
            </div>
          </header>

          <div v-if="!isAdminAuthenticated" class="usage-card mx-auto max-w-md rounded-2xl p-6">
            <h2 class="text-lg font-medium text-white">Admin Login</h2>
            <p class="mt-2 text-sm text-white/50">Sign in to manage service keys and user consumption.</p>
            <div class="mt-5 space-y-3">
              <input v-model="loginForm.username" class="usage-input w-full" placeholder="Admin username" />
              <input v-model="loginForm.password" type="password" class="usage-input w-full" placeholder="Admin password" />
              <button class="usage-primary-btn w-full" :disabled="loggingIn" @click="handleLogin">
                {{ loggingIn ? 'Signing in...' : 'Sign in' }}
              </button>
            </div>
          </div>

          <template v-else>
            <section id="overview" class="mb-8 scroll-mt-6">
              <div class="mb-4">
                <h2 class="usage-section-title">Overview</h2>
                <p class="usage-section-caption">Balance, user coverage, and key inventory.</p>
              </div>
              <div class="grid grid-cols-1 gap-4 md:grid-cols-4">
                <article class="usage-card rounded-2xl p-5">
                  <p class="usage-card-label">Eager Service Balance</p>
                  <p class="mt-3 text-3xl font-semibold text-white">{{ balanceDisplay }}</p>
                </article>
                <article class="usage-card rounded-2xl p-5">
                  <p class="usage-card-label">Registered Users</p>
                  <p class="mt-3 text-3xl font-semibold text-white">{{ users.length }}</p>
                </article>
                <article class="usage-card rounded-2xl p-5">
                  <p class="usage-card-label">API Keys</p>
                  <p class="mt-3 text-3xl font-semibold text-white">{{ apiKeys.length }}</p>
                </article>
                <article class="usage-card rounded-2xl p-5">
                  <p class="usage-card-label">Users With Keys</p>
                  <p class="mt-3 text-3xl font-semibold text-white">{{ usersWithKeys }}</p>
                </article>
              </div>
            </section>

            <section id="keys" class="usage-card mb-8 scroll-mt-6 rounded-2xl p-5 md:p-6">
              <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 class="usage-section-title">Create Eager Service API Key</h2>
                  <p class="usage-section-caption">Create a key, set budget limits, and assign it to users below.</p>
                </div>
                <button class="usage-micro-btn usage-micro-btn-primary" :disabled="creatingKey" @click="createApiKey">
                  {{ creatingKey ? 'Creating...' : 'Create Key' }}
                </button>
              </div>
              <div class="grid grid-cols-1 gap-3 md:grid-cols-4">
                <input v-model="createForm.api_name" class="usage-input" placeholder="api_name" />
                <input v-model.number="createForm.limit_cost" type="number" min="0" class="usage-input" placeholder="limit_cost" />
                <input v-model.number="createForm.limit_daily_cost" type="number" min="0" class="usage-input" placeholder="limit_daily_cost" />
                <input v-model.number="createForm.expired_on" type="number" min="0" class="usage-input" placeholder="expired_on (unix sec)" />
              </div>
              <div class="mt-4 flex flex-wrap gap-3 text-sm text-white/70">
                <label class="usage-check"><input v-model="createForm.allow_save_logs" type="checkbox" /> allow_save_logs</label>
                <label class="usage-check"><input v-model="createForm.allow_custom_model" type="checkbox" /> allow_custom_model</label>
                <label class="usage-check"><input v-model="createForm.allow_manage_key" type="checkbox" /> allow_manage_key</label>
              </div>
            </section>

            <section class="usage-card mb-8 rounded-2xl p-5 md:p-6">
              <div class="mb-5">
                <h2 class="usage-section-title">Eager Service API Keys</h2>
                <p class="usage-section-caption">Key limits, assignment, and deletion.</p>
              </div>
              <div v-if="apiKeys.length === 0" class="usage-empty">No API keys.</div>
              <div v-else class="overflow-auto">
                <table class="w-full min-w-[980px] text-sm">
              <thead>
                <tr class="border-b border-white/10 text-left text-xs uppercase tracking-[0.12em] text-white/40">
                  <th class="py-2 pr-2">api_name</th>
                  <th class="py-2 pr-2">api_key</th>
                  <th class="py-2 pr-2">cost</th>
                  <th class="py-2 pr-2">expire</th>
                  <th class="py-2 pr-2">assign user</th>
                  <th class="py-2">actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="keyItem in apiKeys" :key="keyItem.id || keyItem.api_name" class="border-b border-white/5 align-top hover:bg-white/[0.03]">
                  <td class="py-2 pr-2">{{ keyItem.api_name }}</td>
                  <td class="py-2 pr-2">{{ maskApiKey(keyItem.api_key) }}</td>
                  <td class="py-2 pr-2">{{ keyItem.current_cost ?? 0 }} / {{ keyItem.limit_cost ?? 0 }}</td>
                  <td class="py-2 pr-2">{{ formatExpire(keyItem.expired_on) }}</td>
                  <td class="py-2 pr-2">
                    <div class="flex gap-2">
                      <select v-model="assignSelections[keyItem.api_name]" class="usage-input usage-table-select">
                        <option value="">Select user</option>
                        <option v-for="user in users" :key="user.id" :value="user.id">{{ user.displayName || user.email }}</option>
                      </select>
                      <button class="usage-micro-btn" @click="assignKeyFromRow(keyItem.api_name)">Assign</button>
                    </div>
                  </td>
                  <td class="py-2">
                    <button class="usage-micro-btn usage-micro-btn-danger" @click="deleteApiKey(keyItem.api_name)">Delete</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
            </section>

            <section id="users" class="usage-card scroll-mt-6 rounded-2xl p-5 md:p-6">
              <div class="mb-5">
                <h2 class="usage-section-title">Registered Users & Consumption</h2>
                <p class="usage-section-caption">User activity, total usage, cost, and assigned keys.</p>
              </div>
              <div v-if="users.length === 0" class="usage-empty">No users.</div>
              <div v-else class="overflow-auto">
                <table class="w-full min-w-[940px] text-sm">
              <thead>
                <tr class="border-b border-white/10 text-left text-xs uppercase tracking-[0.12em] text-white/40">
                  <th class="py-2 pr-2">User</th>
                  <th class="py-2 pr-2">Registered</th>
                  <th class="py-2 pr-2">Last Login</th>
                  <th class="py-2 pr-2">Calls</th>
                  <th class="py-2 pr-2">Tokens</th>
                  <th class="py-2 pr-2">Cost</th>
                  <th class="py-2">Assigned Keys</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="user in users" :key="user.id" class="border-b border-white/5 align-top hover:bg-white/[0.03]">
                  <td class="py-2 pr-2">
                    <div>{{ user.displayName || '-' }}</div>
                    <div class="text-xs text-white/45">{{ user.email }}</div>
                  </td>
                  <td class="py-2 pr-2">{{ formatDateTime(user.registeredAt || user.createdAt) }}</td>
                  <td class="py-2 pr-2">{{ formatDateTime(user.lastLoginAt) }}</td>
                  <td class="py-2 pr-2">{{ user.usage?.totalCalls ?? 0 }}</td>
                  <td class="py-2 pr-2">{{ user.usage?.totalTokens ?? 0 }}</td>
                  <td class="py-2 pr-2">{{ Number(user.usage?.totalCostUsd || 0).toFixed(4) }}</td>
                  <td class="py-2">
                    <div class="flex flex-wrap gap-2">
                      <span
                        v-for="assigned in user.assignedApiKeys || []"
                        :key="assigned.apiName"
                        class="usage-key-pill"
                      >
                        {{ assigned.apiName }}
                        <button @click="unassignKey(user.id, assigned.apiName)">x</button>
                      </span>
                      <span v-if="!(user.assignedApiKeys || []).length" class="text-xs text-white/40">No key assigned</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
            </section>
          </template>
        </main>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  assignUsageAdminUserKey,
  clearUsageAdminToken,
  createUsageAdminApiKey,
  deleteUsageAdminApiKey,
  getUsageAdminApiKeys,
  getUsageAdminBalance,
  getUsageAdminUsers,
  setUsageAdminToken,
  unassignUsageAdminUserKey,
  usageAdminLogin,
  usageAdminSession
} from '@/api/usageAdmin'
import { STORAGE_KEYS } from '@/utils/constants'
import { getErrorMessage, getStoredValue } from '@/utils'

const router = useRouter()

const loginForm = ref({ username: '', password: '' })
const loggingIn = ref(false)
const adminSession = ref(null)

const balance = ref('')
const users = ref([])
const apiKeys = ref([])
const loadingAll = ref(false)
const creatingKey = ref(false)
const assignSelections = ref({})

const createForm = ref({
  api_name: '',
  allow_save_logs: false,
  allow_custom_model: false,
  allow_manage_key: false,
  limit_cost: 0,
  limit_daily_cost: 0,
  expired_on: 0
})

const isAdminAuthenticated = computed(() => !!adminSession.value)
const balanceDisplay = computed(() => (balance.value ? `$${balance.value}` : '--'))
const usersWithKeys = computed(() =>
  users.value.filter((item) => (item.assignedApiKeys || []).length > 0).length
)

const hasToken = () => !!getStoredValue(STORAGE_KEYS.USAGE_ADMIN_TOKEN)

const goHome = () => router.push('/')

const formatDateTime = (value) => {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString()
}

const formatExpire = (value) => {
  const n = Number(value)
  if (!n || n <= 0) return '-'
  return new Date(n * 1000).toLocaleString()
}

const maskApiKey = (value) => {
  const key = String(value || '')
  if (key.length <= 10) return key || '-'
  return `${key.slice(0, 6)}...${key.slice(-4)}`
}

const loadAll = async () => {
  loadingAll.value = true
  try {
    const [balanceRsp, usersRsp, keysRsp] = await Promise.all([
      getUsageAdminBalance(),
      getUsageAdminUsers(),
      getUsageAdminApiKeys()
    ])

    balance.value = String(balanceRsp?.data?.balance ?? '')
    users.value = Array.isArray(usersRsp?.data) ? usersRsp.data : []
    apiKeys.value = Array.isArray(keysRsp?.data) ? keysRsp.data : []
  } finally {
    loadingAll.value = false
  }
}

const handleLogin = async () => {
  if (!loginForm.value.username || !loginForm.value.password) {
    window.$message?.warning('Please input admin username and password')
    return
  }

  loggingIn.value = true
  try {
    const rsp = await usageAdminLogin(loginForm.value)
    setUsageAdminToken(rsp?.token)
    const session = await usageAdminSession()
    adminSession.value = session
    await loadAll()
    window.$message?.success('Admin login success')
  } catch (error) {
    clearUsageAdminToken()
    adminSession.value = null
    if (!error?.__handled) window.$message?.error(getErrorMessage(error, 'Admin login failed'))
  } finally {
    loggingIn.value = false
  }
}

const logout = () => {
  clearUsageAdminToken()
  adminSession.value = null
  window.$message?.success('Logged out')
}

const createApiKey = async () => {
  if (!createForm.value.api_name.trim()) {
    window.$message?.warning('api_name is required')
    return
  }

  creatingKey.value = true
  try {
    await createUsageAdminApiKey({
      ...createForm.value,
      api_name: createForm.value.api_name.trim()
    })
    window.$message?.success('API key created')
    createForm.value.api_name = ''
    await loadAll()
  } catch (error) {
    if (!error?.__handled) window.$message?.error(getErrorMessage(error, 'Failed to create API key'))
  } finally {
    creatingKey.value = false
  }
}

const deleteApiKey = async (apiName) => {
  if (!apiName) return
  try {
    await deleteUsageAdminApiKey(apiName)
    window.$message?.success('API key deleted')
    await loadAll()
  } catch (error) {
    if (!error?.__handled) window.$message?.error(getErrorMessage(error, 'Failed to delete API key'))
  }
}

const assignKeyFromRow = async (apiName) => {
  const userId = assignSelections.value[apiName]
  if (!userId) {
    window.$message?.warning('Select user first')
    return
  }

  try {
    await assignUsageAdminUserKey(userId, apiName)
    window.$message?.success('Assigned')
    await loadAll()
  } catch (error) {
    if (!error?.__handled) window.$message?.error(getErrorMessage(error, 'Failed to assign key'))
  }
}

const unassignKey = async (userId, apiName) => {
  try {
    await unassignUsageAdminUserKey(userId, apiName)
    window.$message?.success('Unassigned')
    await loadAll()
  } catch (error) {
    if (!error?.__handled) window.$message?.error(getErrorMessage(error, 'Failed to unassign key'))
  }
}

onMounted(async () => {
  if (!hasToken()) return

  try {
    const session = await usageAdminSession()
    adminSession.value = session
    await loadAll()
  } catch {
    clearUsageAdminToken()
    adminSession.value = null
  }
})
</script>

<style scoped>
.usage-admin-shell {
  background:
    radial-gradient(900px 420px at 16% -10%, rgba(255, 255, 255, 0.05), transparent 60%),
    radial-gradient(900px 420px at 88% -12%, rgba(255, 255, 255, 0.04), transparent 60%),
    linear-gradient(180deg, #0a0a0b 0%, #09090a 100%);
  font-family: 'Sora', 'Avenir Next', 'SF Pro Text', sans-serif;
}

.usage-admin-frame {
  min-height: calc(100vh - 48px);
  overflow: hidden;
  background: linear-gradient(180deg, #141416 0%, #101012 100%);
  box-shadow: 0 22px 80px rgba(0, 0, 0, 0.45);
}

.usage-admin-sidebar {
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: linear-gradient(180deg, rgba(8, 8, 9, 0.72) 0%, rgba(12, 12, 14, 0.8) 100%);
}

.usage-admin-main {
  min-height: calc(100vh - 48px);
  background: linear-gradient(180deg, rgba(18, 18, 20, 0.72) 0%, rgba(11, 11, 13, 0.84) 100%);
}

.usage-nav-item {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-radius: 12px;
  border: 1px solid transparent;
  padding: 10px 12px;
  text-align: left;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.62);
  transition: all 0.2s ease;
}

.usage-nav-item:hover,
.usage-nav-item-active {
  border-color: rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.07);
  color: rgba(255, 255, 255, 0.94);
}

.usage-card {
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.055), rgba(255, 255, 255, 0.026));
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.22);
}

.usage-section-title {
  font-size: 18px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
}

.usage-section-caption {
  margin-top: 6px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.48);
}

.usage-card-label {
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.4);
}

.usage-input {
  min-height: 38px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
  padding: 0 12px;
  color: rgba(255, 255, 255, 0.88);
  outline: none;
}

.usage-input:focus {
  border-color: rgba(255, 255, 255, 0.28);
  background: rgba(255, 255, 255, 0.065);
}

.usage-table-select {
  min-width: 190px;
  height: 34px;
  min-height: 34px;
}

.usage-action-btn,
.usage-micro-btn,
.usage-primary-btn {
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.055);
  color: rgba(255, 255, 255, 0.84);
  transition: all 0.2s ease;
}

.usage-action-btn {
  height: 38px;
  padding: 0 14px;
  font-size: 13px;
}

.usage-micro-btn {
  height: 32px;
  padding: 0 12px;
  font-size: 12px;
}

.usage-primary-btn,
.usage-micro-btn-primary {
  border-color: rgba(255, 255, 255, 0.78);
  background: rgba(255, 255, 255, 0.88);
  color: #0b0b0c;
}

.usage-primary-btn {
  height: 42px;
}

.usage-micro-btn-danger {
  border-color: rgba(244, 114, 114, 0.26);
  color: rgba(254, 202, 202, 0.92);
}

.usage-action-btn:hover:not(:disabled),
.usage-micro-btn:hover:not(:disabled),
.usage-primary-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  border-color: rgba(255, 255, 255, 0.26);
  background: rgba(255, 255, 255, 0.1);
}

.usage-primary-btn:hover:not(:disabled),
.usage-micro-btn-primary:hover:not(:disabled) {
  background: #fff;
  color: #09090a;
}

.usage-action-btn:disabled,
.usage-micro-btn:disabled,
.usage-primary-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.usage-check {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.035);
  padding: 7px 10px;
}

.usage-empty {
  border-radius: 12px;
  border: 1px dashed rgba(255, 255, 255, 0.15);
  padding: 18px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
}

.usage-key-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.05);
  padding: 4px 8px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.82);
}

.usage-key-pill button {
  border: 0;
  background: transparent;
  color: rgba(255, 255, 255, 0.58);
}
</style>
