<template>
  <td class="px-3 py-4">
    <p class="font-medium text-white/90">{{ user.displayName || '-' }}</p>
    <p class="text-xs text-white/50">{{ user.email }}</p>
    <p class="mt-1 text-[11px] text-white/35">ID: {{ user.id }}</p>
    <AdminUserIdentityMeta
      :role-label="roleLabel"
      :status-class="statusClass"
      :status-label="statusLabel"
      :user="user"
    />
  </td>
</template>

<script setup>
import AdminUserIdentityMeta from './AdminUserIdentityMeta.vue'

const {
  roleLabel,
  statusClass,
  statusLabel,
  user
} = defineProps({
  roleLabel: {
    type: Function,
    required: true
  },
  statusClass: {
    type: Function,
    required: true
  },
  statusLabel: {
    type: Function,
    required: true
  },
  user: {
    type: Object,
    default: () => ({})
  }
})
</script>
