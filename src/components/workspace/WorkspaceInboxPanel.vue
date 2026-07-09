<template>
  <section class="workspace-inbox-panel">
    <div class="panel-toolbar">
      <div>
        <h2>Inbox</h2>
        <p>Workspace invitations and project edit requests that need your decision.</p>
      </div>
      <button type="button" class="panel-action" :disabled="loading" @click="$emit('refresh')">
        Refresh
      </button>
    </div>

    <div v-if="loading" class="panel-empty" role="status">Loading inbox</div>

    <template v-else>
      <section class="message-section">
        <div class="message-section-header">
          <h3>Workspace invites</h3>
          <span>{{ workspaceInvites.length }}</span>
        </div>
        <div v-if="workspaceInvites.length" class="message-list">
          <article v-for="invite in workspaceInvites" :key="invite.id" class="message-row">
            <div class="message-main">
              <strong>{{ invite.workspace?.name || 'Workspace invite' }}</strong>
              <span>Invited by {{ invite.createdBy || 'workspace owner' }}</span>
            </div>
            <button type="button" class="message-primary" @click="acceptInvite(invite)">Accept</button>
          </article>
        </div>
        <p v-else class="panel-empty">No pending workspace invites.</p>
      </section>

      <section class="message-section">
        <div class="message-section-header">
          <h3>Project edit requests</h3>
          <span>{{ projectEditRequests.length }}</span>
        </div>
        <div v-if="projectEditRequests.length" class="message-list">
          <article v-for="request in projectEditRequests" :key="request.id" class="message-row">
            <div class="message-main">
              <strong>{{ request.projectName }}</strong>
              <span>{{ request.requesterDisplayName }} requested edit access</span>
              <p v-if="request.message">{{ request.message }}</p>
            </div>
            <div class="message-actions">
              <button type="button" class="message-primary" @click="reviewRequest(request, 'approve')">Approve</button>
              <button type="button" class="message-secondary" @click="reviewRequest(request, 'reject')">Reject</button>
            </div>
          </article>
        </div>
        <p v-else class="panel-empty">No project edit requests.</p>
      </section>
    </template>
  </section>
</template>

<script setup>
defineProps({
  workspaceInvites: {
    type: Array,
    default: () => []
  },
  projectEditRequests: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['acceptWorkspaceInvite', 'reviewProjectRequest', 'refresh'])

const acceptInvite = (invite) => {
  if (!invite?.id) return
  emit('acceptWorkspaceInvite', invite.id)
}

const reviewRequest = (request, decision) => {
  if (!request?.projectId || !request?.id) return
  emit('reviewProjectRequest', { projectId: request.projectId, requestId: request.id, decision })
}
</script>

<style scoped>
.workspace-inbox-panel {
  display: flex;
  flex-direction: column;
  gap: 22px;
  max-width: 980px;
}

.panel-toolbar,
.message-section-header,
.message-row,
.message-actions {
  display: flex;
  align-items: center;
}

.panel-toolbar {
  justify-content: space-between;
  gap: 18px;
}

.panel-toolbar h2,
.message-section h3 {
  margin: 0;
  font-weight: 600;
}

.panel-toolbar h2 {
  font-size: 18px;
}

.panel-toolbar p,
.message-main span,
.message-main p,
.panel-empty {
  color: rgba(236, 238, 244, 0.62);
  font-size: 13px;
}

.panel-toolbar p,
.message-main p,
.panel-empty {
  margin: 4px 0 0;
}

.message-section {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding-top: 18px;
}

.message-section-header {
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.message-section-header h3 {
  font-size: 14px;
}

.message-section-header span {
  color: rgba(236, 238, 244, 0.58);
  font-size: 12px;
}

.message-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.message-row {
  justify-content: space-between;
  gap: 16px;
  min-height: 64px;
  padding: 12px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.message-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.message-main strong {
  color: #f7f7f8;
  font-size: 14px;
  font-weight: 600;
}

.message-actions {
  flex-shrink: 0;
  gap: 8px;
}

.panel-action,
.message-primary,
.message-secondary {
  height: 34px;
  border-radius: 8px;
  padding: 0 12px;
  font-size: 13px;
  cursor: pointer;
}

.panel-action,
.message-secondary {
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(236, 238, 244, 0.82);
}

.message-primary {
  border: 1px solid rgba(255, 255, 255, 0.92);
  background: #fff;
  color: #0d0e10;
}

.panel-action:disabled {
  cursor: default;
  opacity: 0.55;
}

@media (max-width: 720px) {
  .panel-toolbar,
  .message-row {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
