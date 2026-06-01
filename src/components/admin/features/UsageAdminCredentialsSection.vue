<template>
  <UsageAdminCredentialCreateForm
    :create-form="createForm"
    :creating-key="creatingKey"
    @create-api-key="emit('create-api-key')"
    @update-create-form-field="updateCreateFormField"
  />
  <UsageAdminCredentialTable
    :api-keys="apiKeys"
    :assign-selections="assignSelections"
    :format-expire="formatExpire"
    :mask-api-key="maskApiKey"
    :users="users"
    @assign-key-from-row="emit('assign-key-from-row', $event)"
    @delete-api-key="emit('delete-api-key', $event)"
    @update-assignment-selection="updateAssignmentSelection"
  />
</template>

<script setup>
import UsageAdminCredentialCreateForm from './UsageAdminCredentialCreateForm.vue'
import UsageAdminCredentialTable from './UsageAdminCredentialTable.vue'

const emit = defineEmits([
  'assign-key-from-row',
  'create-api-key',
  'delete-api-key',
  'update-assignment-selection',
  'update-create-form-field'
])

defineProps({
  apiKeys: {
    type: Array,
    default: () => []
  },
  assignSelections: {
    type: Object,
    default: () => ({})
  },
  createForm: {
    type: Object,
    required: true
  },
  creatingKey: {
    type: Boolean,
    default: false
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

const updateCreateFormField = (field, value) => {
  emit('update-create-form-field', field, value)
}

const updateAssignmentSelection = (apiName, userId) => {
  emit('update-assignment-selection', apiName, userId)
}
</script>
