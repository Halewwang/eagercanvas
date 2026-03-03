<template>
  <div class="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] px-6 py-10">
    <div class="max-w-7xl mx-auto space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-light">Admin Console</h1>
          <p class="text-[var(--text-secondary)]">User roles, permissions and admin operation logs.</p>
        </div>
        <div class="flex items-center gap-2">
          <button class="flora-button-ghost px-3 py-2 rounded-lg" :disabled="loadingUsers" @click="loadUsers">
            {{ loadingUsers ? 'Refreshing...' : 'Refresh Users' }}
          </button>
          <button class="flora-button-ghost px-3 py-2 rounded-lg" :disabled="loadingLogs" @click="loadLogs">
            {{ loadingLogs ? 'Refreshing...' : 'Refresh Logs' }}
          </button>
          <button class="flora-button-ghost px-3 py-2 rounded-lg" @click="goHome">Back</button>
        </div>
      </div>

      <div class="flora-panel rounded-2xl p-5 text-sm">
        <div>Current user: {{ auth.user.value?.email || '-' }}</div>
        <div class="text-[var(--text-secondary)]">Roles: {{ auth.roles.value.join(', ') || '-' }}</div>
        <div class="text-[var(--text-secondary)]">Permissions: {{ auth.permissions.value.length }}</div>
      </div>

      <div class="flora-panel rounded-2xl p-6 space-y-4">
        <h2 class="text-lg">Users & Roles</h2>
        <div v-if="users.length === 0" class="text-sm text-[var(--text-secondary)]">No user data.</div>
        <div v-else class="overflow-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-[var(--text-secondary)] border-b border-[var(--border-color)]">
                <th class="py-2 pr-2">User</th>
                <th class="py-2 pr-2">Current Roles</th>
                <th class="py-2 pr-2">Select Roles</th>
                <th class="py-2 pr-2">Usage Calls</th>
                <th class="py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in users" :key="item.id" class="border-b border-[var(--border-color)]/50 align-top">
                <td class="py-2 pr-2">
                  <div>{{ item.displayName || '-' }}</div>
                  <div class="text-xs text-[var(--text-secondary)]">{{ item.email }}</div>
                </td>
                <td class="py-2 pr-2">
                  <div class="flex flex-wrap gap-2">
                    <span
                      v-for="role in item.roles || []"
                      :key="`${item.id}-${role}`"
                      class="inline-flex rounded-full border border-[var(--border-color)] px-2 py-1 text-xs"
                    >
                      {{ role }}
                    </span>
                  </div>
                </td>
                <td class="py-2 pr-2">
                  <div class="flex flex-wrap gap-2">
                    <label
                      v-for="role in roleOptions"
                      :key="`${item.id}-${role}`"
                      class="inline-flex items-center gap-1 text-xs text-[var(--text-secondary)]"
                    >
                      <input
                        type="checkbox"
                        :checked="isSelected(item.id, role)"
                        @change="toggleRole(item.id, role, $event)"
                      />
                      {{ role }}
                    </label>
                  </div>
                </td>
                <td class="py-2 pr-2">{{ item.usage?.totalCalls || 0 }}</td>
                <td class="py-2">
                  <button class="flora-button-primary rounded-lg px-3 py-1" :disabled="saving[item.id]" @click="saveRoles(item)">
                    {{ saving[item.id] ? 'Saving...' : 'Save Roles' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="flora-panel rounded-2xl p-6 space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-lg">Admin Audit Logs</h2>
          <div class="flex items-center gap-2 text-xs">
            <input
              v-model.number="logQuery.page"
              type="number"
              min="1"
              class="w-20 rounded-lg border border-[var(--border-color)] bg-transparent px-2 py-1"
            />
            <input
              v-model.number="logQuery.limit"
              type="number"
              min="1"
              max="100"
              class="w-20 rounded-lg border border-[var(--border-color)] bg-transparent px-2 py-1"
            />
            <button class="flora-button-ghost rounded-lg px-3 py-1" :disabled="loadingLogs" @click="loadLogs">Search</button>
          </div>
        </div>

        <div v-if="auditLogs.length === 0" class="text-sm text-[var(--text-secondary)]">No audit logs.</div>
        <div v-else class="overflow-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-[var(--text-secondary)] border-b border-[var(--border-color)]">
                <th class="py-2 pr-2">Time</th>
                <th class="py-2 pr-2">Action</th>
                <th class="py-2 pr-2">Operator</th>
                <th class="py-2 pr-2">Target</th>
                <th class="py-2">Metadata</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="log in auditLogs" :key="log.id" class="border-b border-[var(--border-color)]/50 align-top">
                <td class="py-2 pr-2 whitespace-nowrap">{{ formatDateTime(log.createdAt) }}</td>
                <td class="py-2 pr-2">{{ log.action }}</td>
                <td class="py-2 pr-2">{{ log.operator?.email || '-' }}</td>
                <td class="py-2 pr-2">{{ log.target?.email || '-' }}</td>
                <td class="py-2">
                  <pre class="text-xs whitespace-pre-wrap text-[var(--text-secondary)]">{{ toPrettyJson(log.metadata) }}</pre>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="text-xs text-[var(--text-secondary)]">
          Page {{ pagination.page }} · Limit {{ pagination.limit }} · Total {{ pagination.total }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getAdminAuditLogs, getAdminUsers, updateAdminUserRoles } from '@/api/admin'
import { useAuthStore } from '@/stores/auth'
import { getErrorMessage } from '@/utils'

const router = useRouter()
const auth = useAuthStore()

const roleOptions = ['super_admin', 'admin', 'ops', 'support', 'user']
const users = ref([])
const selectedRoles = ref({})
const saving = ref({})
const loadingUsers = ref(false)

const auditLogs = ref([])
const loadingLogs = ref(false)
const pagination = ref({ page: 1, limit: 20, total: 0 })
const logQuery = ref({ page: 1, limit: 20 })

const goHome = () => router.push('/')

const formatDateTime = (value) => {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString()
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

const loadUsers = async () => {
  loadingUsers.value = true
  try {
    const rsp = await getAdminUsers()
    const list = Array.isArray(rsp?.data) ? rsp.data : []
    users.value = list

    const nextSelection = {}
    for (const item of list) {
      nextSelection[item.id] = Array.isArray(item.roles) ? [...item.roles] : ['user']
    }
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

const loadLogs = async () => {
  loadingLogs.value = true
  try {
    const rsp = await getAdminAuditLogs({
      page: logQuery.value.page,
      limit: logQuery.value.limit
    })
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

onMounted(async () => {
  await Promise.all([loadUsers(), loadLogs()])
})
</script>
