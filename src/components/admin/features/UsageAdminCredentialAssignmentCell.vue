<template>
  <div class="usage-admin-credential-assignment-cell">
    <UsageAdminFormControl
      as="select"
      :value="selection"
      table
      @change="$emit('update-selection', apiName, $event.target.value)"
    >
      <option value="">Select user</option>
      <option v-for="user in users" :key="user.id" :value="user.id">{{ user.displayName || user.email }}</option>
    </UsageAdminFormControl>
    <UsageAdminButton kind="micro" @click="$emit('assign', apiName)">Assign</UsageAdminButton>
  </div>
</template>

<script setup>
import UsageAdminButton from './UsageAdminButton.vue'
import UsageAdminFormControl from './UsageAdminFormControl.vue'

defineEmits(['assign', 'update-selection'])

defineProps({
  apiName: {
    type: String,
    required: true
  },
  selection: {
    type: [String, Number],
    default: ''
  },
  users: {
    type: Array,
    default: () => []
  }
})
</script>

<style scoped>
.usage-admin-credential-assignment-cell {
  display: flex;
  gap: 0.5rem;
}
</style>
