<template>
  <section class="workspace-settings-panel">
    <form class="settings-section settings-form" @submit.prevent="emit('updateWorkspace')">
      <div class="settings-section-header">
        <div>
          <h2>Workspace settings</h2>
          <p>Rename this team workspace and adjust its avatar source.</p>
        </div>
        <button type="submit" class="settings-primary">Save</button>
      </div>
      <div class="settings-fields">
        <label>
          <span>Name</span>
          <input :value="editName" class="settings-input" autocomplete="off" @input="emit('update:editName', $event.target.value)" />
        </label>
        <label>
          <span>Avatar URL</span>
          <input :value="editAvatarUrl" class="settings-input" autocomplete="off" @input="emit('update:editAvatarUrl', $event.target.value)" />
        </label>
      </div>
    </form>

    <section class="settings-section">
      <div class="settings-section-header">
        <div>
          <h2>Members</h2>
          <p>{{ members.length }} workspace members can view team projects by default.</p>
        </div>
      </div>
      <div class="member-list">
        <div v-for="member in members" :key="member.userId" class="member-row">
          <div class="member-main">
            <strong>{{ member.displayName || member.email || member.userId }}</strong>
            <span>{{ member.email || member.username || member.userId }}</span>
          </div>
          <span class="role-chip">{{ member.role }}</span>
        </div>
      </div>
    </section>

    <section class="settings-section">
      <div class="settings-section-header">
        <div>
          <h2>Project permissions</h2>
          <p>Grant editors, revoke project-specific access, or transfer ownership.</p>
        </div>
      </div>

      <div class="project-permission-layout">
        <div class="project-list">
          <button
            v-for="project in projects"
            :key="project.id"
            type="button"
            class="project-row"
            :class="{ active: permissionDetail?.project?.id === project.id }"
            @click="emit('loadProjectPermissions', project.id)"
          >
            <span>{{ project.name }}</span>
            <small>{{ project.permission }}</small>
          </button>
        </div>

        <div class="permission-detail">
          <div v-if="loadingPermissions" class="settings-empty" role="status">Loading permissions</div>
          <template v-else-if="permissionDetail?.project">
            <div class="permission-detail-header">
              <h3>{{ permissionDetail.project.name }}</h3>
              <span>Owner: {{ permissionDetail.ownerUserId }}</span>
            </div>

            <div class="permission-table">
              <div v-for="member in permissionDetail.members" :key="member.userId" class="permission-row">
                <div class="member-main">
                  <strong>{{ member.displayName || member.email || member.userId }}</strong>
                  <span>{{ member.effectivePermission }} effective access</span>
                </div>
                <select :value="roleValue(member)" class="role-select" :disabled="savingPermission" @change="changeRole(member, $event.target.value)">
                  <option value="owner">Owner</option>
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
            </div>
          </template>
          <div v-else class="settings-empty">Select a team project to manage permissions.</div>
        </div>
      </div>
    </section>
  </section>
</template>

<script setup>
const props = defineProps({
  currentWorkspace: {
    type: Object,
    default: null
  },
  members: {
    type: Array,
    default: () => []
  },
  projects: {
    type: Array,
    default: () => []
  },
  permissionDetail: {
    type: Object,
    default: null
  },
  loadingPermissions: {
    type: Boolean,
    default: false
  },
  savingPermission: {
    type: Boolean,
    default: false
  },
  editName: {
    type: String,
    default: ''
  },
  editAvatarUrl: {
    type: String,
    default: ''
  }
})

const emit = defineEmits([
  'updateWorkspace',
  'loadProjectPermissions',
  'changeProjectPermission',
  'update:editName',
  'update:editAvatarUrl'
])

const roleValue = (member = {}) => {
  if (member.userId && member.userId === props.permissionDetail?.ownerUserId) return 'owner'
  if (member.projectRole === 'editor') return 'editor'
  return 'viewer'
}

const changeRole = (member, role) => {
  const projectId = props.permissionDetail?.project?.id || ''
  const userId = member?.userId || ''
  if (!projectId || !userId || !role) return
  emit('changeProjectPermission', { projectId, userId, role })
}
</script>

<style scoped>
.workspace-settings-panel {
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 1080px;
}

.settings-section {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding-top: 18px;
}

.settings-section:first-child {
  border-top: none;
  padding-top: 0;
}

.settings-section-header,
.member-row,
.permission-row,
.permission-detail-header {
  display: flex;
  align-items: center;
}

.settings-section-header,
.permission-detail-header {
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}

.settings-section h2,
.permission-detail h3 {
  margin: 0;
  font-weight: 600;
}

.settings-section h2 {
  font-size: 18px;
}

.permission-detail h3 {
  font-size: 15px;
}

.settings-section p,
.member-main span,
.permission-detail-header span,
.settings-empty {
  color: rgba(236, 238, 244, 0.62);
  font-size: 13px;
}

.settings-section p {
  margin: 4px 0 0;
}

.settings-fields {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 14px;
}

.settings-fields label,
.member-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.settings-fields label > span {
  color: rgba(236, 238, 244, 0.72);
  font-size: 12px;
}

.settings-input,
.role-select {
  height: 38px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  color: #f7f7f8;
  font-size: 13px;
}

.settings-input {
  min-width: 0;
  padding: 0 11px;
}

.settings-primary {
  height: 34px;
  border: 1px solid rgba(255, 255, 255, 0.92);
  border-radius: 8px;
  background: #fff;
  color: #0d0e10;
  padding: 0 13px;
  cursor: pointer;
  font-size: 13px;
}

.member-list,
.permission-table,
.project-list {
  display: flex;
  flex-direction: column;
}

.member-row,
.permission-row {
  justify-content: space-between;
  gap: 14px;
  min-height: 54px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.member-main strong {
  color: #f7f7f8;
  font-size: 14px;
  font-weight: 600;
}

.role-chip {
  color: rgba(236, 238, 244, 0.78);
  font-size: 12px;
  text-transform: capitalize;
}

.project-permission-layout {
  display: grid;
  grid-template-columns: minmax(220px, 300px) minmax(0, 1fr);
  gap: 22px;
}

.project-list {
  gap: 6px;
}

.project-row {
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: rgba(236, 238, 244, 0.82);
  min-height: 42px;
  padding: 8px 10px;
  display: flex;
  justify-content: space-between;
  gap: 10px;
  cursor: pointer;
  text-align: left;
}

.project-row.active,
.project-row:hover {
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
}

.project-row span,
.project-row small {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-row small {
  color: rgba(236, 238, 244, 0.52);
  text-transform: capitalize;
}

.permission-detail {
  min-width: 0;
}

.role-select {
  width: 112px;
  padding: 0 9px;
}

.settings-empty {
  margin: 0;
  padding: 14px 0;
}

@media (max-width: 820px) {
  .settings-section-header,
  .permission-detail-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .settings-fields,
  .project-permission-layout {
    grid-template-columns: 1fr;
  }
}
</style>
