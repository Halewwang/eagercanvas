<template>
  <td class="px-3 py-4">
    <AdminStatusPill :class-name="serviceStatusClass(user.service?.serviceStatus)">
      {{ serviceStatusLabel(user.service?.serviceStatus) }}
    </AdminStatusPill>
    <p class="mt-2 text-xs text-white/45">{{ user.service?.serviceIdentifier || '尚未开通' }}</p>
  </td>
</template>

<script setup>
import AdminStatusPill from '@/components/admin/AdminStatusPill.vue'

const {
  serviceStatusClass,
  serviceStatusLabel,
  user
} = defineProps({
  serviceStatusClass: {
    type: Function,
    required: true
  },
  serviceStatusLabel: {
    type: Function,
    required: true
  },
  user: {
    type: Object,
    default: () => ({})
  }
})
</script>
