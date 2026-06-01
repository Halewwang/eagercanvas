<template>
  <tr :class="rowClass">
    <td class="py-2 pr-2">{{ keyItem.api_name }}</td>
    <td class="py-2 pr-2">{{ maskApiKey(keyItem.api_key) }}</td>
    <td class="py-2 pr-2">{{ keyItem.current_cost ?? 0 }} / {{ keyItem.limit_cost ?? 0 }}</td>
    <td class="py-2 pr-2">{{ formatExpire(keyItem.expired_on) }}</td>
    <td class="py-2 pr-2">
      <UsageAdminCredentialAssignmentCell
        :api-name="keyItem.api_name"
        :selection="assignSelections[keyItem.api_name] || ''"
        :users="users"
        @assign="emit('assign-key-from-row', $event)"
        @update-selection="updateAssignmentSelection"
      />
    </td>
    <td class="py-2">
      <UsageAdminButton kind="micro" tone="danger" @click="emit('delete-api-key', keyItem.api_name)">Delete</UsageAdminButton>
    </td>
  </tr>
</template>

<script setup>
import UsageAdminCredentialAssignmentCell from './UsageAdminCredentialAssignmentCell.vue'
import UsageAdminButton from './UsageAdminButton.vue'

const emit = defineEmits(['assign-key-from-row', 'delete-api-key', 'update-assignment-selection'])

defineProps({
  assignSelections: {
    type: Object,
    default: () => ({})
  },
  formatExpire: {
    type: Function,
    required: true
  },
  keyItem: {
    type: Object,
    default: () => ({})
  },
  maskApiKey: {
    type: Function,
    required: true
  },
  rowClass: {
    type: String,
    default: ''
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
