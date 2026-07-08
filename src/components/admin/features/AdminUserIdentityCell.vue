<template>
  <td class="admin-user-identity-cell px-3 py-4">
    <div class="admin-user-identity-stack">
      <p class="admin-user-name">{{ user.displayName || '-' }}</p>
      <p class="admin-user-email">{{ user.email }}</p>
      <div class="admin-user-id-line">
        <span class="admin-user-id-value">ID: {{ user.id }}</span>
      </div>
      <div class="admin-user-api-line">
        <span class="admin-user-api-prefix">API:</span>
        <span class="admin-user-service-id">{{ user.service?.serviceIdentifier || '尚未开通' }}</span>
      </div>
      <div class="admin-user-service-state">
        <span>{{ serviceStatusLabel(user.service?.serviceStatus) }}</span>
        <span v-if="user.service?.apiKeyLast4" class="admin-user-key-last4">
          Key 尾号 {{ user.service?.apiKeyLast4 }}
        </span>
      </div>
      <p v-if="user.service?.lastError" class="admin-user-service-error">
        {{ user.service.lastError }}
      </p>
      <div class="admin-user-meta-group">
        <AdminUserIdentityMeta
          :role-label="roleLabel"
          :status-class="statusClass"
          :status-label="statusLabel"
          :user="user"
        />
      </div>
    </div>
  </td>
</template>

<script setup>
import AdminUserIdentityMeta from './AdminUserIdentityMeta.vue'

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
  min-height: 138px;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
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

.admin-user-api-line {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  min-width: 0;
  color: rgba(255, 255, 255, 0.42);
  font-size: 11px;
  line-height: 1.45;
}

.admin-user-api-prefix {
  flex: 0 0 auto;
  color: rgba(255, 255, 255, 0.32);
  font-weight: 600;
}

.admin-user-service-id {
  min-width: 0;
  max-width: 168px;
  overflow: hidden;
  color: rgba(255, 255, 255, 0.46);
  font-size: 11px;
  line-height: 1.45;
  text-overflow: ellipsis;
  white-space: nowrap;
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

.admin-user-key-last4 {
  color: rgba(255, 255, 255, 0.68);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.admin-user-service-error {
  max-width: 220px;
  margin-top: 5px;
  color: rgba(255, 205, 215, 0.72);
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
