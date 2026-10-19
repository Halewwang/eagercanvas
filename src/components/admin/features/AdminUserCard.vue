<template>
  <article class="admin-user-card" :aria-label="user.displayName || user.email">
    <header class="admin-user-card-heading">
      <div class="admin-user-card-identity">
        <h2>{{ user.displayName || '-' }}</h2>
        <p>{{ user.email }}</p>
      </div>
      <span class="admin-user-service-badge" :class="{ 'is-active': user.service?.serviceStatus === 'active' }">
        服务{{ getAdminServiceStatusLabel(user.service?.serviceStatus) }}
      </span>
    </header>
    <AdminUserIdentityMeta
      :user="user"
      :role-label="getAdminRoleLabel"
      :status-class="getAdminUserStatusClass"
      :status-label="getAdminUserStatusLabel"
    />
    <dl class="admin-user-card-dates">
      <div><dt>注册</dt><dd>{{ formatAdminDateTime(user.createdAt) }}</dd></div>
      <div><dt>最近登录</dt><dd>{{ formatAdminDateTime(user.lastLoginAt) }}</dd></div>
    </dl>
    <div class="admin-user-card-actions"><slot /></div>
  </article>
</template>

<script setup>
import AdminUserIdentityMeta from './AdminUserIdentityMeta.vue'
import {
  formatAdminDateTime, getAdminRoleLabel, getAdminServiceStatusLabel,
  getAdminUserStatusClass, getAdminUserStatusLabel
} from '@/utils/adminDisplay'

defineProps({ user: { type: Object, required: true } })
</script>

<style scoped>
.admin-user-card { display: flex; min-width: 0; flex-direction: column; border: 1px solid rgba(255,255,255,.1); border-radius: 16px; padding: 18px; background: rgba(255,255,255,.025); }
.admin-user-card-heading { display: flex; align-items: start; justify-content: space-between; gap: 12px; }
.admin-user-card-identity { min-width: 0; overflow-wrap: anywhere; }
.admin-user-card-identity h2 { color: rgba(255,255,255,.94); font-size: 15px; font-weight: 600; line-height: 1.4; }
.admin-user-card-identity p { margin-top: 3px; color: rgba(255,255,255,.5); font-size: 12px; line-height: 1.5; }
.admin-user-service-badge { flex: 0 0 auto; border: 1px solid rgba(255,255,255,.12); border-radius: 999px; padding: 4px 8px; color: rgba(255,255,255,.56); font-size: 11px; line-height: 1.4; }
.admin-user-service-badge.is-active { color: rgba(255,255,255,.9); background: rgba(255,255,255,.09); }
.admin-user-card-dates { display: grid; gap: 4px; margin-block: 14px 16px; color: rgba(255,255,255,.43); font-size: 11px; }
.admin-user-card-dates div { display: flex; flex-wrap: wrap; gap: 6px; }
.admin-user-card-dates dt { min-width: 48px; }
.admin-user-card-actions { margin-top: auto; }
</style>
