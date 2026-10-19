<template>
  <td class="admin-user-identity-cell px-3 py-4">
    <button type="button" class="admin-user-identity-stack text-left" @click="emit('open-detail')">
      <p class="admin-user-name">{{ user.displayName || '-' }}</p>
      <p class="admin-user-email">{{ user.email }}</p>
      <div class="admin-user-id-line">
        <span class="admin-user-id-value">ID: {{ user.id }}</span>
      </div>
      <div class="admin-user-service-state">
        <span>{{ serviceStatusLabel(user.service?.serviceStatus) }}</span>
      </div>
      <div class="admin-user-meta-group">
        <AdminUserIdentityMeta
          :role-label="roleLabel"
          :status-class="statusClass"
          :status-label="statusLabel"
          :user="user"
        />
      </div>
    </button>
  </td>
</template>

<script setup>
import AdminUserIdentityMeta from './AdminUserIdentityMeta.vue'

const emit = defineEmits(['open-detail'])

const {
  roleLabel,
  serviceStatusLabel,
  statusClass,
  statusLabel,
  user
} = defineProps({
  roleLabel: {
    type: Function,
    required: true
  },
  serviceStatusLabel: {
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

<style scoped>
.admin-user-identity-cell {
  min-width: 220px;
}

.admin-user-identity-stack {
  display: flex;
  min-height: 108px;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  width: 100%;
  border-radius: 10px;
  padding: 4px;
}

.admin-user-identity-stack:focus-visible {
  outline: 2px solid rgba(103, 232, 249, 0.8);
  outline-offset: 2px;
}

.admin-user-name {
  margin: 0;
  color: rgba(255, 255, 255, 0.92);
  font-weight: 600;
  line-height: 1.25;
}

.admin-user-email {
  margin: 0;
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  line-height: 1.35;
}

.admin-user-id-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 2px;
  min-width: 0;
}

.admin-user-id-value {
  color: rgba(255, 255, 255, 0.34);
  font-size: 11px;
  line-height: 1.4;
}

.admin-user-service-state {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 2px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 11px;
  line-height: 1.45;
}

.admin-user-meta-group {
  margin-top: auto;
  padding-top: 8px;
}

.admin-user-meta-group :deep(.mt-2) {
  margin-top: 0;
}
</style>
