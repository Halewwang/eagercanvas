<template>
  <div class="mt-2 flex flex-wrap gap-1.5">
    <AdminStatusPill :class-name="statusClass(user.status)">{{ statusLabel(user.status) }}</AdminStatusPill>
    <AdminTagPill v-for="role in user.roles || []" :key="`${user.id}-${role}`">{{ roleLabel(role) }}</AdminTagPill>
  </div>
  <p v-if="user.suspendedReason" class="mt-2 max-w-[180px] text-[11px] leading-5 text-white/45">
    {{ user.suspendedReason }}
  </p>
</template>

<script setup>
import AdminStatusPill from '@/components/admin/AdminStatusPill.vue'
import AdminTagPill from '@/components/admin/AdminTagPill.vue'

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
