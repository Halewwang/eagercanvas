<template>
  <aside class="workspace-sidebar">
    <WorkspaceSwitcher
      :current-workspace="currentWorkspace"
      :workspaces="workspaces"
      :pending-invites="pendingInvites"
      :fallback-name="workspaceBrand"
      @select="$emit('selectWorkspace', $event)"
      @create="$emit('createWorkspace')"
      @invite="$emit('inviteWorkspace')"
      @leave="$emit('leaveWorkspace')"
      @accept-invite="$emit('acceptWorkspaceInvite', $event)"
    />

    <section class="sidebar-group">
      <nav class="nav-menu">
        <button
          v-for="item in navItems"
          :key="item.key"
          class="nav-item"
          :class="{ active: activeSection === item.key }"
          @click="$emit('update:activeSection', item.key)"
        >
          <NIcon class="nav-icon" :size="18"><component :is="item.icon" /></NIcon>
          <span>{{ item.label }}</span>
        </button>
      </nav>
    </section>

    <footer class="sidebar-footer-tools">
      <template v-if="isAuthenticated">
        <div class="sidebar-tool-actions">
          <button class="sidebar-profile-btn" type="button" title="Profile settings" aria-label="Profile settings" @click="$emit('settings')">
            <img v-if="user?.avatarUrl" :src="user.avatarUrl" alt="user avatar" />
            <span v-else>{{ avatarInitial }}</span>
          </button>
          <button class="sidebar-tool-btn" type="button" title="Admin Dashboard" aria-label="Admin Dashboard" @click="$emit('admin')">
            <NIcon :size="18"><WindowSidebarOutline /></NIcon>
          </button>
          <button class="sidebar-tool-btn sidebar-tool-btn--logout" type="button" title="Logout" aria-label="Logout" @click="$emit('logout')">
            <NIcon :size="18"><LogOutOutline /></NIcon>
          </button>
        </div>
      </template>
      <template v-else>
        <div class="account-actions">
          <button class="account-action-btn" @click="$emit('login')">Login</button>
          <button class="account-action-btn account-action-btn-primary" @click="$emit('register')">Register</button>
        </div>
      </template>
    </footer>
  </aside>
</template>

<script setup>
import { NIcon } from 'naive-ui'
import { LogOutOutline, WindowSidebarOutline } from '@/icons/coolicons'
import WorkspaceSwitcher from './WorkspaceSwitcher.vue'

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
  },
  currentWorkspace: {
    type: Object,
    default: null
  },
  workspaces: {
    type: Array,
    default: () => []
  },
  pendingInvites: {
    type: Array,
    default: () => []
  }
})

defineEmits([
  'update:activeSection',
  'selectWorkspace',
  'createWorkspace',
  'inviteWorkspace',
  'leaveWorkspace',
  'acceptWorkspaceInvite',
  'uploadAvatar',
  'settings',
  'admin',
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

.nav-menu {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sidebar-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-item {
  height: 42px;
  border: none;
  background: transparent;
  color: rgba(236, 238, 244, 0.72);
  border-radius: 14px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 12px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.nav-icon {
  flex-shrink: 0;
}

.nav-item.active {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.sidebar-footer-tools {
  margin-top: auto;
  padding: 0 10px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 10px;
}

.sidebar-tool-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.sidebar-profile-btn {
  width: 30px;
  height: 30px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.92);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
  transition: border-color 0.2s ease, background-color 0.2s ease;
}

.sidebar-profile-btn img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.sidebar-profile-btn:hover {
  border-color: rgba(255, 255, 255, 0.22);
  background: rgba(255, 255, 255, 0.1);
}

.sidebar-tool-btn {
  width: 26px;
  height: 30px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: rgba(236, 238, 244, 0.7);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.sidebar-tool-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
}

.sidebar-tool-btn--logout {
  margin-left: auto;
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
