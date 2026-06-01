<template>
  <UsageAdminSurface id="users" surface-class="scroll-mt-6 rounded-2xl p-5 md:p-6">
    <AdminSectionHeader
      class="mb-5"
      title="Registered Users & Consumption"
      caption="User activity, total usage, cost, and assigned credentials."
    />
    <AdminEmptyState v-if="users.length === 0">No users.</AdminEmptyState>
    <AdminTableShell v-else overflow-class="overflow-auto" min-width-class="min-w-[940px]">
      <template #header>
        <th class="py-2 pr-2">User</th>
        <th class="py-2 pr-2">Registered</th>
        <th class="py-2 pr-2">Last Login</th>
        <th class="py-2 pr-2">Calls</th>
        <th class="py-2 pr-2">Tokens</th>
        <th class="py-2 pr-2">Official Cost</th>
        <th class="py-2">Assigned Credentials</th>
      </template>
      <template #default="{ rowClass }">
        <UsageAdminUserRow
          v-for="user in users"
          :key="user.id"
          :format-date-time="formatDateTime"
          :row-class="rowClass"
          :user="user"
          @unassign-key="forwardUnassignKey"
        />
      </template>
    </AdminTableShell>
  </UsageAdminSurface>
</template>

<script setup>
import AdminEmptyState from '@/components/admin/AdminEmptyState.vue'
import AdminSectionHeader from '@/components/admin/AdminSectionHeader.vue'
import AdminTableShell from '@/components/admin/AdminTableShell.vue'
import UsageAdminSurface from './UsageAdminSurface.vue'
import UsageAdminUserRow from './UsageAdminUserRow.vue'

const emit = defineEmits(['unassign-key'])

defineProps({
  formatDateTime: {
    type: Function,
    required: true
  },
  users: {
    type: Array,
    default: () => []
  }
})

const forwardUnassignKey = (userId, apiName) => {
  emit('unassign-key', userId, apiName)
}
</script>
