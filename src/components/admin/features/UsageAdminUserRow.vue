<template>
  <tr :class="rowClass">
    <td class="py-2 pr-2">
      <div>{{ user.displayName || '-' }}</div>
      <div class="text-xs text-white/45">{{ user.email }}</div>
    </td>
    <td class="py-2 pr-2">{{ formatDateTime(user.registeredAt || user.createdAt) }}</td>
    <td class="py-2 pr-2">{{ formatDateTime(user.lastLoginAt) }}</td>
    <td class="py-2 pr-2">{{ user.usage?.totalCalls ?? 0 }}</td>
    <td class="py-2 pr-2">{{ user.usage?.totalTokens ?? 0 }}</td>
    <td class="py-2 pr-2">{{ Number(user.officialUsage?.totalCostAmount || 0).toFixed(4) }}</td>
    <td class="py-2">
      <UsageAdminAssignedCredentialsCell
        :assigned-api-keys="user.assignedApiKeys || []"
        :user-id="user.id"
        @unassign="emit('unassign-key', $event.userId, $event.apiName)"
      />
    </td>
  </tr>
</template>

<script setup>
import UsageAdminAssignedCredentialsCell from './UsageAdminAssignedCredentialsCell.vue'

const emit = defineEmits(['unassign-key'])

defineProps({
  formatDateTime: {
    type: Function,
    required: true
  },
  rowClass: {
    type: String,
    default: ''
  },
  user: {
    type: Object,
    default: () => ({})
  }
})
</script>
