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
      @edit="$emit('editWorkspace', $event)"
      @delete="$emit('deleteWorkspace')"
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
        <div class="sidebar-user-row">
          <button class="sidebar-profile-btn" type="button" title="Profile settings" aria-label="Profile settings" @click="$emit('settings')">
            <img v-if="user?.avatarUrl" :src="user.avatarUrl" alt="user avatar" />
            <span v-else>{{ avatarInitial }}</span>
          </button>
          <span class="sidebar-user-divider" aria-hidden="true"></span>
          <div class="sidebar-usage-meter" aria-live="polite">
            <span class="sidebar-usage-calls">{{ usageCallsLabel }}</span>
            <span class="sidebar-usage-cost">{{ usageCostLabel }}</span>
          </div>
          <BaseDropdown :options="accountMenuOptions" placement="top-end" compact @select="handleAccountMenuSelect">
            <button class="sidebar-settings-btn" type="button" title="Account menu" aria-label="Account menu">
              <NIcon :size="18"><SettingsOutline /></NIcon>
            </button>
          </BaseDropdown>
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
import { computed } from 'vue'
import { NIcon } from 'naive-ui'
import { LogOutOutline, SettingsOutline, WindowSidebarOutline } from '@/icons/coolicons'
import { BaseDropdown } from '@/components/ui'
import WorkspaceSwitcher from './WorkspaceSwitcher.vue'

const props = defineProps({
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
  usageSummary: {
    type: Object,
    default: null
  },
  usageLoading: {
    type: Boolean,
    default: false
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

const emit = defineEmits([
  'update:activeSection',
  'selectWorkspace',
  'createWorkspace',
  'inviteWorkspace',
  'leaveWorkspace',
  'editWorkspace',
  'deleteWorkspace',
  'acceptWorkspaceInvite',
  'uploadAvatar',
  'settings',
  'admin',
  'logout',
  'login',
  'register'
])

const accountMenuOptions = computed(() => [
  { key: 'admin', label: 'Admin Dashboard', icon: WindowSidebarOutline },
  { key: 'divider', type: 'divider' },
  { key: 'logout', label: 'Logout', icon: LogOutOutline, danger: true }
])

const formatCompactNumber = (value) => {
  const numericValue = Number(value || 0)
  if (!Number.isFinite(numericValue)) return '0'
  return new Intl.NumberFormat('en', {
    notation: numericValue >= 10000 ? 'compact' : 'standard',
    maximumFractionDigits: numericValue >= 10000 ? 1 : 0
  }).format(numericValue)
}

const formatUsageCost = (value) => {
  const numericValue = Number(value || 0)
  if (!Number.isFinite(numericValue) || numericValue <= 0) return '0.0000'
  if (numericValue < 1) return numericValue.toFixed(4)
  return numericValue.toFixed(2)
}

const usageCallsLabel = computed(() => {
  if (props.usageLoading && !props.usageSummary) return 'Loading usage'
  return `${formatCompactNumber(props.usageSummary?.totalCalls)} calls`
})

const usageCostLabel = computed(() => {
  if (props.usageLoading && !props.usageSummary) return 'Fetching cost'
  return `$${formatUsageCost(props.usageSummary?.totalCostUsd)} used`
})

const handleAccountMenuSelect = (key) => {
  if (key === 'admin') {
    emit('admin')
    return
  }
  if (key === 'logout') {
    emit('logout')
  }
}
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
  width: 100%;
}

.sidebar-user-row {
  display: grid;
  grid-template-columns: 30px 1px minmax(0, 1fr) 30px;
  align-items: center;
  column-gap: 12px;
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

.sidebar-user-divider {
  width: 1px;
  height: 24px;
  background: rgba(255, 255, 255, 0.18);
  border-radius: 999px;
}

.sidebar-usage-meter {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  line-height: 1.15;
}

.sidebar-usage-calls,
.sidebar-usage-cost {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar-usage-calls {
  color: rgba(255, 255, 255, 0.92);
  font-size: 12px;
  font-weight: 700;
}

.sidebar-usage-cost {
  color: rgba(236, 238, 244, 0.48);
  font-size: 10px;
  font-weight: 500;
}

.sidebar-settings-btn {
  width: 30px;
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

.sidebar-settings-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
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
