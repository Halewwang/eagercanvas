<template>
  <UsageAdminSurface surface-class="mb-8 rounded-2xl p-5 md:p-6">
    <AdminSectionHeader
      class="mb-5"
      title="Eager Service Credentials"
      caption="Credential limits, assignment, and deletion."
    />
    <AdminEmptyState v-if="apiKeys.length === 0">No service credentials.</AdminEmptyState>
    <AdminTableShell v-else overflow-class="overflow-auto" min-width-class="min-w-[980px]">
      <template #header>
        <th class="py-2 pr-2">api_name</th>
        <th class="py-2 pr-2">api_key</th>
        <th class="py-2 pr-2">cost</th>
        <th class="py-2 pr-2">expire</th>
        <th class="py-2 pr-2">assign user</th>
        <th class="py-2">actions</th>
      </template>
      <template #default="{ rowClass }">
        <UsageAdminCredentialRow
          v-for="keyItem in apiKeys"
          :key="keyItem.id || keyItem.api_name"
          :assign-selections="assignSelections"
          :format-expire="formatExpire"
          :key-item="keyItem"
          :mask-api-key="maskApiKey"
          :row-class="rowClass"
          :users="users"
          @assign-key-from-row="emit('assign-key-from-row', $event)"
          @delete-api-key="emit('delete-api-key', $event)"
          @update-assignment-selection="updateAssignmentSelection"
        />
      </template>
    </AdminTableShell>
  </UsageAdminSurface>
</template>

<script setup>
import AdminEmptyState from '@/components/admin/AdminEmptyState.vue'
import AdminSectionHeader from '@/components/admin/AdminSectionHeader.vue'
import AdminTableShell from '@/components/admin/AdminTableShell.vue'
import UsageAdminCredentialRow from './UsageAdminCredentialRow.vue'
import UsageAdminSurface from './UsageAdminSurface.vue'

const emit = defineEmits(['assign-key-from-row', 'delete-api-key', 'update-assignment-selection'])

defineProps({
  apiKeys: {
    type: Array,
    default: () => []
  },
  assignSelections: {
    type: Object,
    default: () => ({})
  },
  formatExpire: {
    type: Function,
    required: true
  },
  maskApiKey: {
    type: Function,
    required: true
  },
  users: {
    type: Array,
    default: () => []
  }
})

const updateAssignmentSelection = (apiName, userId) => {
  emit('update-assignment-selection', apiName, userId)
}
</script>
