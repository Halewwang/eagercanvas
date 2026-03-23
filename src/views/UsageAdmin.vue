<template>
  <div class="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] px-6 py-10">
    <div class="max-w-7xl mx-auto space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-light">Usage Admin</h1>
          <p class="text-[var(--text-secondary)]">Independent admin login for Eager Service key management and user consumption view.</p>
        </div>
        <button class="flora-button-ghost px-4 py-2 rounded-xl" @click="goHome">Back</button>
      </div>

      <div v-if="!isAdminAuthenticated" class="flora-panel rounded-2xl p-6 max-w-md mx-auto">
        <h2 class="text-lg mb-4">Admin Login</h2>
        <div class="space-y-3">
          <input v-model="loginForm.username" class="w-full rounded-xl border border-[var(--border-color)] bg-transparent px-3 py-2" placeholder="Admin username" />
          <input v-model="loginForm.password" type="password" class="w-full rounded-xl border border-[var(--border-color)] bg-transparent px-3 py-2" placeholder="Admin password" />
          <button class="flora-button-primary w-full rounded-xl py-2" :disabled="loggingIn" @click="handleLogin">
            {{ loggingIn ? 'Signing in...' : 'Sign in' }}
          </button>
        </div>
      </div>

      <template v-else>
        <div class="flex items-center justify-between">
          <div class="text-sm text-[var(--text-secondary)]">Current admin: {{ adminSession?.admin?.username || 'admin' }}</div>
          <div class="flex gap-2">
            <button class="flora-button-ghost px-3 py-2 rounded-lg" :disabled="loadingAll" @click="loadAll">Refresh</button>
            <button class="flora-button-ghost px-3 py-2 rounded-lg" @click="logout">Logout</button>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="flora-panel rounded-2xl p-5">
            <p class="text-xs uppercase tracking-wider text-[var(--text-secondary)]">Eager Service Balance</p>
            <p class="text-3xl mt-2">{{ balanceDisplay }}</p>
          </div>
          <div class="flora-panel rounded-2xl p-5">
            <p class="text-xs uppercase tracking-wider text-[var(--text-secondary)]">Total Registered Users</p>
            <p class="text-3xl mt-2">{{ users.length }}</p>
          </div>
          <div class="flora-panel rounded-2xl p-5">
            <p class="text-xs uppercase tracking-wider text-[var(--text-secondary)]">Total Eager Service API Keys</p>
            <p class="text-3xl mt-2">{{ apiKeys.length }}</p>
          </div>
        </div>

        <div class="flora-panel rounded-2xl p-6 space-y-4">
          <h2 class="text-lg">Create Eager Service API Key</h2>
          <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input v-model="createForm.api_name" class="rounded-lg border border-[var(--border-color)] bg-transparent px-3 py-2" placeholder="api_name" />
            <input v-model.number="createForm.limit_cost" type="number" min="0" class="rounded-lg border border-[var(--border-color)] bg-transparent px-3 py-2" placeholder="limit_cost" />
            <input v-model.number="createForm.limit_daily_cost" type="number" min="0" class="rounded-lg border border-[var(--border-color)] bg-transparent px-3 py-2" placeholder="limit_daily_cost" />
            <input v-model.number="createForm.expired_on" type="number" min="0" class="rounded-lg border border-[var(--border-color)] bg-transparent px-3 py-2" placeholder="expired_on (unix sec)" />
          </div>
          <div class="flex items-center gap-4 text-sm">
            <label class="inline-flex items-center gap-2"><input v-model="createForm.allow_save_logs" type="checkbox" /> allow_save_logs</label>
            <label class="inline-flex items-center gap-2"><input v-model="createForm.allow_custom_model" type="checkbox" /> allow_custom_model</label>
            <label class="inline-flex items-center gap-2"><input v-model="createForm.allow_manage_key" type="checkbox" /> allow_manage_key</label>
          </div>
          <button class="flora-button-primary rounded-lg px-4 py-2" :disabled="creatingKey" @click="createApiKey">
            {{ creatingKey ? 'Creating...' : 'Create Key' }}
          </button>
        </div>

        <div class="flora-panel rounded-2xl p-6 space-y-4">
          <h2 class="text-lg">Eager Service API Keys</h2>
          <div v-if="apiKeys.length === 0" class="text-sm text-[var(--text-secondary)]">No API keys.</div>
          <div v-else class="overflow-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-[var(--text-secondary)] border-b border-[var(--border-color)]">
                  <th class="py-2 pr-2">api_name</th>
                  <th class="py-2 pr-2">api_key</th>
                  <th class="py-2 pr-2">cost</th>
                  <th class="py-2 pr-2">expire</th>
                  <th class="py-2 pr-2">assign user</th>
                  <th class="py-2">actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="keyItem in apiKeys" :key="keyItem.id || keyItem.api_name" class="border-b border-[var(--border-color)]/50">
                  <td class="py-2 pr-2">{{ keyItem.api_name }}</td>
                  <td class="py-2 pr-2">{{ maskApiKey(keyItem.api_key) }}</td>
                  <td class="py-2 pr-2">{{ keyItem.current_cost ?? 0 }} / {{ keyItem.limit_cost ?? 0 }}</td>
                  <td class="py-2 pr-2">{{ formatExpire(keyItem.expired_on) }}</td>
                  <td class="py-2 pr-2">
                    <div class="flex gap-2">
                      <select v-model="assignSelections[keyItem.api_name]" class="rounded-lg border border-[var(--border-color)] bg-transparent px-2 py-1">
                        <option value="">Select user</option>
                        <option v-for="user in users" :key="user.id" :value="user.id">{{ user.displayName || user.email }}</option>
                      </select>
                      <button class="flora-button-ghost px-2 py-1 rounded" @click="assignKeyFromRow(keyItem.api_name)">Assign</button>
                    </div>
                  </td>
                  <td class="py-2">
                    <button class="flora-button-ghost px-2 py-1 rounded" @click="deleteApiKey(keyItem.api_name)">Delete</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="flora-panel rounded-2xl p-6 space-y-4">
          <h2 class="text-lg">Registered Users & Consumption</h2>
          <div v-if="users.length === 0" class="text-sm text-[var(--text-secondary)]">No users.</div>
          <div v-else class="overflow-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-[var(--text-secondary)] border-b border-[var(--border-color)]">
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
                <tr v-for="user in users" :key="user.id" class="border-b border-[var(--border-color)]/50 align-top">
                  <td class="py-2 pr-2">
                    <div>{{ user.displayName || '-' }}</div>
                    <div class="text-xs text-[var(--text-secondary)]">{{ user.email }}</div>
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
                        class="inline-flex items-center gap-1 rounded-full border border-[var(--border-color)] px-2 py-1 text-xs"
                      >
                        {{ assigned.apiName }}
                        <button class="text-[var(--text-secondary)] hover:text-[var(--text-primary)]" @click="unassignKey(user.id, assigned.apiName)">x</button>
                      </span>
                      <span v-if="!(user.assignedApiKeys || []).length" class="text-xs text-[var(--text-secondary)]">No key assigned</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>
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
import { getErrorMessage } from '@/utils'

const router = useRouter()
let loadAllPromise = null

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

const hasToken = () => !!localStorage.getItem(STORAGE_KEYS.USAGE_ADMIN_TOKEN)

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

const loadAll = async ({ force = false } = {}) => {
  if (loadAllPromise && !force) return loadAllPromise
  loadingAll.value = true
  loadAllPromise = (async () => {
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
  })()
  try {
    return await loadAllPromise
  } finally {
    loadAllPromise = null
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
    await loadAll({ force: true })
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
    await loadAll({ force: true })
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
    await loadAll({ force: true })
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
    await loadAll({ force: true })
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
