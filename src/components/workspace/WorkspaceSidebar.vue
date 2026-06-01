<template>
  <aside class="workspace-sidebar">
    <div class="brand">
      <img :src="aioncraftWordmark" alt="AionCraft" class="brand-logo" />
      <span class="brand-divider" aria-hidden="true"></span>
      <div class="brand-text">{{ workspaceBrand }}</div>
    </div>

    <section class="sidebar-group">
      <div class="sidebar-group-title">Workspace</div>
      <nav class="nav-menu">
        <button
          v-for="item in navItems"
          :key="item.key"
          class="nav-item"
          :class="{ active: activeSection === item.key }"
          @click="$emit('update:activeSection', item.key)"
        >
          <NIcon :size="16"><component :is="item.icon" /></NIcon>
          <span>{{ item.label }}</span>
        </button>
      </nav>
    </section>

    <div class="sidebar-account">
      <template v-if="isAuthenticated">
        <button class="account-profile" title="Upload avatar" @click="$emit('uploadAvatar')">
          <div class="account-avatar">
            <img v-if="user?.avatarUrl" :src="user.avatarUrl" alt="avatar" />
            <span v-else>{{ avatarInitial }}</span>
          </div>
          <div class="account-meta">
            <strong>{{ user?.displayName || 'Workspace Member' }}</strong>
            <span>{{ user?.email }}</span>
          </div>
        </button>
        <div class="account-actions">
          <button class="account-action-btn" @click="$emit('usage')">Usage</button>
          <button class="account-action-btn" @click="$emit('logout')">Logout</button>
        </div>
      </template>
      <template v-else>
        <div class="account-actions">
          <button class="account-action-btn" @click="$emit('login')">Login</button>
          <button class="account-action-btn account-action-btn-primary" @click="$emit('register')">Register</button>
        </div>
      </template>
    </div>
  </aside>
</template>

<script setup>
import { NIcon } from 'naive-ui'
import aioncraftWordmark from '@/assets/home-figma/aioncraft-wordmark.svg'

defineProps({
  workspaceBrand: {
    type: String,
    default: 'Shared Workspace'
  },
  navItems: {
    type: Array,
    default: () => []
  },
  activeSection: {
    type: String,
    default: 'projects'
  },
  isAuthenticated: {
    type: Boolean,
    default: false
  },
  user: {
    type: Object,
    default: null
  },
  avatarInitial: {
    type: String,
    default: ''
  }
})

defineEmits([
  'update:activeSection',
  'uploadAvatar',
  'usage',
  'logout',
  'login',
  'register'
])
</script>

<style scoped>
.workspace-sidebar {
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  background: rgba(255, 255, 255, 0.015);
}

.brand {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 10px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.brand-logo {
  width: 93px;
  height: 31px;
  object-fit: contain;
  flex-shrink: 0;
}

.brand-divider {
  width: 1px;
  height: 28px;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.16);
}

.brand-text {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.15;
  letter-spacing: -0.01em;
}

.nav-menu {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sidebar-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sidebar-group-title {
  padding: 0 12px;
  color: rgba(236, 238, 244, 0.45);
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.nav-item {
  height: 42px;
  border: none;
  background: transparent;
  color: rgba(236, 238, 244, 0.72);
  border-radius: 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 12px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.nav-item.active {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.sidebar-account {
  margin-top: auto;
  padding: 14px 10px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.account-profile {
  width: 100%;
  border: none;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 18px;
  padding: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  text-align: left;
  cursor: pointer;
}

.account-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  flex-shrink: 0;
}

.account-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.account-meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.account-meta strong {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
}

.account-meta span {
  font-size: 12px;
  color: rgba(236, 238, 244, 0.58);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.account-action-btn {
  height: 40px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  color: rgba(236, 238, 244, 0.85);
  font-size: 13px;
  cursor: pointer;
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}

.account-action-btn:hover {
  border-color: rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
}

.account-action-btn-primary {
  background: rgba(255, 255, 255, 0.9);
  color: #0d0e10;
}

.account-action-btn-primary:hover {
  background: #fff;
  color: #0d0e10;
}

@media (max-width: 900px) {
  .workspace-sidebar {
    border-right: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }
}
</style>
