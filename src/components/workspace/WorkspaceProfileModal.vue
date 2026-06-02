<template>
  <BaseModal
    :show="show"
    title="Profile settings"
    description="Update the identity shown across shared projects and templates."
    size="sm"
    @update:show="$emit('update:show', $event)"
  >
    <div class="profile-settings">
      <button class="profile-avatar-button" type="button" aria-label="Change avatar" @click="$emit('uploadAvatar')">
        <img v-if="user?.avatarUrl" :src="user.avatarUrl" alt="user avatar" />
        <span v-else>{{ avatarInitial }}</span>
      </button>

      <div class="profile-form">
        <BaseInput
          v-model="displayNameModel"
          label="Display Name"
          placeholder="Enter display name"
          @keyup.enter="$emit('saveProfile')"
        />
        <BaseInput label="Email" :model-value="user?.email || ''" readonly />
        <BaseInput label="User ID" :model-value="user?.id || ''" readonly />
      </div>
    </div>
    <template #footer>
      <BaseModalActions>
        <BaseButton variant="ghost" @click="$emit('update:show', false)">Cancel</BaseButton>
        <BaseButton :loading="saving" :disabled="displayNameModel.trim().length < 2" @click="$emit('saveProfile')">
          Save
        </BaseButton>
      </BaseModalActions>
    </template>
  </BaseModal>
</template>

<script setup>
import { computed } from 'vue'
import { BaseButton, BaseInput, BaseModal, BaseModalActions } from '@/components/ui'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  user: {
    type: Object,
    default: null
  },
  avatarInitial: {
    type: String,
    default: 'U'
  },
  displayName: {
    type: String,
    default: ''
  },
  saving: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'update:show',
  'update:displayName',
  'uploadAvatar',
  'saveProfile'
])

const displayNameModel = computed({
  get: () => props.displayName,
  set: (value) => emit('update:displayName', value)
})
</script>

<style scoped>
.profile-settings {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 18px;
  align-items: flex-start;
}

.profile-avatar-button {
  width: 76px;
  height: 76px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: pointer;
  font-size: 24px;
  font-weight: 700;
}

.profile-avatar-button img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.profile-form {
  display: grid;
  gap: 12px;
  min-width: 0;
}

@media (max-width: 560px) {
  .profile-settings {
    grid-template-columns: 1fr;
  }
}
</style>
