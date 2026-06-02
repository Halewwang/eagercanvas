<template>
  <div ref="rootRef" class="workspace-switcher">
    <button class="switcher-trigger" type="button" @click="toggleOpen">
      <div class="workspace-avatar">
        <img v-if="currentWorkspace?.avatarUrl" :src="currentWorkspace.avatarUrl" alt="workspace avatar" />
        <span v-else>{{ workspaceInitial }}</span>
      </div>
      <div class="workspace-copy">
        <strong>{{ currentWorkspace?.name || fallbackName }}</strong>
        <span>{{ workspaceMeta }}</span>
      </div>
      <span class="switcher-chevron-stack" aria-hidden="true">
        <NIcon :size="9"><ChevronUpOutline /></NIcon>
        <NIcon :size="9"><ChevronDownOutline /></NIcon>
      </span>
    </button>

    <div v-if="open" class="switcher-menu">
      <label class="switcher-search">
        <NIcon :size="16"><SearchOutline /></NIcon>
        <input v-model="searchQuery" type="search" placeholder="Search workspaces" @keydown.stop />
      </label>

      <div v-if="personalWorkspaces.length" class="switcher-section">
        <div class="switcher-label">Personal</div>
        <button
          v-for="workspace in personalWorkspaces"
          :key="workspace.id"
          type="button"
          class="workspace-option"
          :class="{ active: workspace.id === currentWorkspace?.id }"
          @click="selectWorkspace(workspace.id)"
        >
          <div class="workspace-avatar option-avatar">
            <img v-if="workspace.avatarUrl" :src="workspace.avatarUrl" alt="workspace avatar" />
            <span v-else>{{ getInitial(workspace.name) }}</span>
          </div>
          <div class="workspace-copy">
            <strong>{{ workspace.name }}</strong>
            <span>{{ formatWorkspaceOptionMeta(workspace) }}</span>
          </div>
          <span v-if="workspace.id === currentWorkspace?.id" class="active-pill">Active</span>
        </button>
      </div>

      <div v-if="teamWorkspaces.length" class="switcher-section">
        <div class="switcher-label">Teams</div>
        <div
          v-for="workspace in teamWorkspaces"
          :key="workspace.id"
          class="workspace-option-row"
          :class="{ active: workspace.id === currentWorkspace?.id }"
        >
          <button
            type="button"
            class="workspace-option team-option"
            @click="selectWorkspace(workspace.id)"
          >
            <div class="workspace-avatar option-avatar">
              <img v-if="workspace.avatarUrl" :src="workspace.avatarUrl" alt="workspace avatar" />
              <span v-else>{{ getInitial(workspace.name) }}</span>
            </div>
            <div class="workspace-copy">
              <strong>{{ workspace.name }}</strong>
              <span>{{ formatWorkspaceOptionMeta(workspace) }}</span>
            </div>
            <span v-if="workspace.id === currentWorkspace?.id" class="active-pill">Active</span>
          </button>
          <button
            v-if="canManageWorkspace(workspace)"
            type="button"
            class="workspace-edit-button"
            aria-label="Edit team"
            title="Edit team"
            @click.stop="editWorkspace(workspace)"
          >
            <NIcon :size="15"><CreateOutline /></NIcon>
          </button>
        </div>
      </div>

      <div v-if="!hasFilteredWorkspaces" class="switcher-empty">
        No workspaces found
      </div>

      <div v-if="pendingInvites.length" class="switcher-section invite-section">
        <div class="switcher-label">Invites</div>
        <button
          v-for="invite in pendingInvites"
          :key="invite.id"
          type="button"
          class="action-row"
          @click="acceptInvite(invite.id)"
        >
          <span>{{ invite.workspace?.name || 'Workspace invite' }}</span>
          <strong>Accept</strong>
        </button>
      </div>

      <div class="switcher-actions">
        <button type="button" class="action-row" @click="emitAction('create')">
          <NIcon :size="16"><AddOutline /></NIcon>
          <span>Create team</span>
        </button>
        <button
          v-if="canManageCurrentWorkspace"
          type="button"
          class="action-row"
          @click="emitAction('invite')"
        >
          <NIcon :size="16"><SendOutline /></NIcon>
          <span>Invite members</span>
        </button>
        <button
          v-if="canManageCurrentWorkspace"
          type="button"
          class="action-row danger"
          @click="emitAction('delete')"
        >
          <NIcon :size="16"><TrashOutline /></NIcon>
          <span>Delete team</span>
        </button>
        <button
          v-else-if="currentWorkspace?.kind === 'team'"
          type="button"
          class="action-row danger"
          @click="emitAction('leave')"
        >
          <NIcon :size="16"><ChevronForwardOutline /></NIcon>
          <span>Leave team</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { NIcon } from 'naive-ui'
import {
  AddOutline,
  ChevronDownOutline,
  ChevronForwardOutline,
  ChevronUpOutline,
  CreateOutline,
  SearchOutline,
  SendOutline,
  TrashOutline
} from '@/icons/coolicons'

const props = defineProps({
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
  },
  fallbackName: {
    type: String,
    default: 'Shared Workspace'
  }
})

const emit = defineEmits(['select', 'create', 'invite', 'leave', 'edit', 'delete', 'acceptInvite'])
const rootRef = ref(null)
const open = ref(false)
const searchQuery = ref('')

const getInitial = (name = '') => {
  const raw = String(name || '').trim()
  return (raw[0] || 'W').toUpperCase()
}

const formatMemberCount = (count = 1) => {
  const memberCount = Math.max(1, Number(count || 1))
  return `${memberCount} ${memberCount === 1 ? 'member' : 'members'}`
}

const formatWorkspaceOptionMeta = (workspace) => {
  if (workspace?.kind === 'team') return formatMemberCount(workspace.memberCount)
  return 'Just you'
}

const canManageWorkspace = (workspace) => (
  workspace?.kind === 'team' && workspace?.role === 'owner'
)

const workspaceMatchesSearch = (workspace) => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return true
  return [
    workspace?.name,
    workspace?.slug,
    workspace?.kind
  ].some((value) => String(value || '').toLowerCase().includes(query))
}

const personalWorkspaces = computed(() => (
  props.workspaces.filter((workspace) => workspace?.kind !== 'team' && workspaceMatchesSearch(workspace))
))

const teamWorkspaces = computed(() => (
  props.workspaces.filter((workspace) => workspace?.kind === 'team' && workspaceMatchesSearch(workspace))
))

const hasFilteredWorkspaces = computed(() => (
  personalWorkspaces.value.length > 0 || teamWorkspaces.value.length > 0
))

const workspaceInitial = computed(() => getInitial(props.currentWorkspace?.name))

const workspaceMeta = computed(() => {
  const workspace = props.currentWorkspace
  if (!workspace) return 'Personal'
  if (workspace.kind === 'team') return formatMemberCount(workspace.memberCount)
  return 'Personal'
})

const canManageCurrentWorkspace = computed(() => canManageWorkspace(props.currentWorkspace))

const toggleOpen = () => {
  open.value = !open.value
}

const close = () => {
  open.value = false
  searchQuery.value = ''
}

const selectWorkspace = (workspaceId) => {
  emit('select', workspaceId)
  close()
}

const acceptInvite = (inviteId) => {
  emit('acceptInvite', inviteId)
  close()
}

const editWorkspace = (workspace) => {
  emit('edit', workspace)
  close()
}

const emitAction = (eventName) => {
  emit(eventName)
  close()
}

const handlePointerDown = (event) => {
  if (!open.value) return
  if (rootRef.value?.contains(event.target)) return
  close()
}

watch(open, (isOpen) => {
  if (isOpen) {
    document.addEventListener('pointerdown', handlePointerDown)
    return
  }
  document.removeEventListener('pointerdown', handlePointerDown)
}, { immediate: true })

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handlePointerDown)
})
</script>

<style scoped>
.workspace-switcher {
  position: relative;
  z-index: 40;
}

.switcher-trigger,
.workspace-option,
.action-row {
  width: 100%;
  border: none;
  color: rgba(236, 238, 244, 0.9);
  cursor: pointer;
  text-align: left;
}

.switcher-trigger {
  min-height: 68px;
  border-radius: 18px;
  padding: 10px;
  background: transparent;
  border: 1px solid transparent;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
}

.switcher-trigger:hover {
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(255, 255, 255, 0.08);
}

.workspace-avatar {
  width: 42px;
  height: 42px;
  border-radius: 999px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
}

.workspace-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.workspace-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.workspace-copy strong {
  color: #fff;
  font-size: 14px;
  font-weight: 650;
  line-height: 1.15;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workspace-copy span {
  color: rgba(236, 238, 244, 0.58);
  font-size: 12px;
  line-height: 1.2;
}

.switcher-chevron-stack {
  color: rgba(236, 238, 244, 0.64);
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0;
  line-height: 1;
}

.switcher-menu {
  position: absolute;
  left: 0;
  top: calc(100% + 10px);
  width: min(360px, calc(100vw - 32px));
  padding: 10px;
  border-radius: 22px;
  border: 1px solid rgba(255, 255, 255, 0.09);
  background: rgba(20, 20, 20, 0.96);
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(14px);
}

.switcher-search {
  height: 42px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(236, 238, 244, 0.58);
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  margin-bottom: 8px;
}

.switcher-search input {
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  color: #fff;
  font: inherit;
  font-size: 13px;
}

.switcher-search input::placeholder {
  color: rgba(236, 238, 244, 0.44);
}

.switcher-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.workspace-option {
  min-height: 58px;
  border-radius: 16px;
  padding: 8px;
  background: transparent;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
}

.workspace-option-row {
  min-height: 58px;
  border-radius: 16px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 4px;
}

.team-option {
  min-height: 58px;
}

.workspace-option:hover,
.workspace-option.active,
.workspace-option-row:hover,
.workspace-option-row.active {
  background: rgba(255, 255, 255, 0.08);
}

.option-avatar {
  width: 38px;
  height: 38px;
  border-radius: 999px;
}

.active-pill {
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  padding: 3px 8px;
  color: rgba(255, 255, 255, 0.82);
  font-size: 11px;
}

.workspace-edit-button {
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: rgba(236, 238, 244, 0.62);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.workspace-edit-button:hover {
  background: rgba(255, 255, 255, 0.09);
  color: #fff;
}

.switcher-label {
  padding: 8px 8px 2px;
  color: rgba(236, 238, 244, 0.45);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.switcher-empty {
  padding: 18px 10px;
  color: rgba(236, 238, 244, 0.5);
  font-size: 13px;
  text-align: center;
}

.invite-section,
.switcher-actions {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.switcher-actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.action-row {
  min-height: 42px;
  border-radius: 14px;
  padding: 0 10px;
  background: transparent;
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 13px;
}

.action-row:hover {
  background: rgba(255, 255, 255, 0.08);
}

.action-row strong {
  margin-left: auto;
  font-size: 12px;
  color: #fff;
}

.action-row.danger {
  color: rgba(255, 160, 160, 0.9);
}
</style>
