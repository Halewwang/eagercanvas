<template>
  <BaseModal
    :show="showCreate"
    title="Create Workspace"
    description="Create a team space for shared projects and templates."
    size="sm"
    @update:show="$emit('update:showCreate', $event)"
  >
    <template #header>
      <div class="create-modal-heading">
        <h2 class="ui-title-lg truncate text-[var(--text)]">Create Workspace</h2>
        <p class="ui-body max-w-2xl text-[var(--text-muted)]">
          Create a team space for shared projects and templates.
        </p>
      </div>
    </template>

    <div class="create-workspace-layout">
      <div class="avatar-panel">
        <button class="avatar-upload" type="button" aria-label="Choose team avatar" @click="avatarInputRef?.click()">
          <img v-if="createAvatarUrl" :src="createAvatarUrl" alt="team avatar" />
          <span v-else>{{ createName?.[0]?.toUpperCase() || 'W' }}</span>
        </button>
        <input ref="avatarInputRef" type="file" accept="image/*" class="hidden" @change="handleAvatarFile" />
      </div>

      <div class="create-form-stack">
        <BaseInput
          :model-value="createName"
          label="Workspace Name"
          placeholder="Design Team"
          @update:model-value="$emit('update:createName', $event)"
        />

        <label class="slug-field">
          <span>URL Slug</span>
          <div class="slug-preview">
            <input :value="generatedSlug" readonly aria-label="URL Slug" />
            <span class="slug-check">✓</span>
          </div>
        </label>

        <div v-if="createdInviteUrl" class="generated-link">
          <span>Invite link · 7 days</span>
          <button type="button" @click="$emit('copyInviteUrl', createdInviteUrl)">{{ createdInviteUrl }}</button>
        </div>
      </div>
    </div>
    <template #footer>
      <BaseModalActions>
        <BaseButton variant="ghost" @click="$emit('update:showCreate', false)">Cancel</BaseButton>
        <BaseButton :loading="createLoading" :disabled="!createName.trim()" @click="$emit('confirmCreate')">
          {{ createdInviteUrl ? 'Regenerate Link' : 'Create' }}
        </BaseButton>
      </BaseModalActions>
    </template>
  </BaseModal>

  <BaseModal
    :show="showInvite"
    title="Invite Members"
    description="Invite by username, email, or a 7-day workspace link."
    size="sm"
    @update:show="$emit('update:showInvite', $event)"
  >
    <div class="team-modal-stack">
      <BaseInput
        :model-value="directInviteValue"
        label="Username or email"
        placeholder="hale@example.com"
        @update:model-value="$emit('update:directInviteValue', $event)"
        @keyup.enter="$emit('sendDirectInvite')"
      />
      <div class="split-actions">
        <BaseButton variant="secondary" :loading="directInviteLoading" :disabled="!directInviteValue.trim()" @click="$emit('sendDirectInvite')">
          Send Invite
        </BaseButton>
        <BaseButton :loading="inviteLinkLoading" @click="$emit('generateInviteLink')">
          Create Link
        </BaseButton>
      </div>
      <div v-if="inviteUrl" class="generated-link">
        <span>Invite link · 7 days</span>
        <button type="button" @click="$emit('copyInviteUrl', inviteUrl)">{{ inviteUrl }}</button>
      </div>
    </div>
  </BaseModal>

  <BaseModal
    :show="showLeave"
    title="Leave Workspace"
    description="Transfer owned team projects before leaving this workspace."
    size="sm"
    @update:show="$emit('update:showLeave', $event)"
  >
    <div class="team-modal-stack">
      <p class="modal-copy">
        You will return to Personal Workspace. If you own team projects, choose a team member to manage them.
      </p>
      <label class="select-field">
        <span>Transfer to</span>
        <select :value="transferToUserId" @change="$emit('update:transferToUserId', $event.target.value)">
          <option value="">Select member</option>
          <option
            v-for="member in transferMembers"
            :key="member.userId"
            :value="member.userId"
          >
            {{ member.displayName || member.email || member.userId }}
          </option>
        </select>
      </label>
    </div>
    <template #footer>
      <BaseModalActions>
        <BaseButton variant="ghost" @click="$emit('update:showLeave', false)">Cancel</BaseButton>
        <BaseButton variant="danger" :loading="leaveLoading" @click="$emit('confirmLeave')">Leave</BaseButton>
      </BaseModalActions>
    </template>
  </BaseModal>
</template>

<script setup>
import { computed, ref } from 'vue'
import { BaseButton, BaseInput, BaseModal, BaseModalActions } from '@/components/ui'

const props = defineProps({
  showCreate: Boolean,
  showInvite: Boolean,
  showLeave: Boolean,
  createName: {
    type: String,
    default: ''
  },
  createAvatarUrl: {
    type: String,
    default: ''
  },
  createdInviteUrl: {
    type: String,
    default: ''
  },
  createLoading: Boolean,
  directInviteValue: {
    type: String,
    default: ''
  },
  directInviteLoading: Boolean,
  inviteUrl: {
    type: String,
    default: ''
  },
  inviteLinkLoading: Boolean,
  transferToUserId: {
    type: String,
    default: ''
  },
  transferMembers: {
    type: Array,
    default: () => []
  },
  leaveLoading: Boolean
})

const emit = defineEmits([
  'update:showCreate',
  'update:showInvite',
  'update:showLeave',
  'update:createName',
  'update:createAvatarUrl',
  'update:directInviteValue',
  'update:transferToUserId',
  'confirmCreate',
  'sendDirectInvite',
  'generateInviteLink',
  'copyInviteUrl',
  'confirmLeave'
])

const avatarInputRef = ref(null)

const generatedSlug = computed(() => {
  const slug = String(props.createName || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return slug || 'workspace'
})

const handleAvatarFile = (event) => {
  const file = event.target?.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => emit('update:createAvatarUrl', String(reader.result || ''))
  reader.readAsDataURL(file)
}
</script>

<style scoped>
.team-modal-stack {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.create-modal-heading {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.create-workspace-layout {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr);
  align-items: center;
  gap: 22px;
}

.avatar-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 150px;
}

.create-form-stack {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

.create-form-stack :deep(input.ui-body) {
  padding-left: 10px;
  padding-right: 10px;
  font-size: 14px;
}

.avatar-upload {
  width: 100px;
  height: 100px;
  border-radius: 60px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: pointer;
  font-size: 25px;
  font-weight: 700;
}

.avatar-upload img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.generated-link {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.generated-link span,
.slug-field > span,
.select-field span,
.modal-copy {
  color: var(--text-muted);
  font-size: 13px;
}

.slug-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.slug-preview {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  height: 44px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface);
  padding: 0 12px;
}

.slug-preview input {
  width: 100%;
  border: none;
  background: transparent;
  color: var(--text);
  outline: none;
  font: inherit;
}

.slug-check {
  color: #8b80ff;
  font-weight: 700;
}

.generated-link button {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface);
  color: var(--text);
  padding: 11px 14px;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.split-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.modal-copy {
  margin: 0;
  line-height: 1.5;
}

.select-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.select-field select {
  height: 44px;
  border-radius: 16px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  padding: 0 14px;
  outline: none;
}

@media (max-width: 640px) {
  .create-workspace-layout {
    grid-template-columns: 1fr;
  }

  .avatar-panel {
    flex-direction: row;
    align-items: center;
  }
}
</style>
