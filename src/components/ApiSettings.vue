<template>
  <BaseModal
    v-model:show="showModal"
    title="Profile"
    description="Update your public identity and avatar."
    size="lg"
  >
    <div class="profile-shell">
      <aside class="profile-aside">
        <button class="avatar-wrap" @click="triggerAvatarUpload" title="Edit avatar">
          <img v-if="avatarPreview" :src="avatarPreview" alt="avatar" class="avatar-image" />
          <div v-else class="avatar-fallback">{{ avatarInitial }}</div>
        </button>
        <button class="avatar-link" @click="triggerAvatarUpload">Change avatar</button>
        <input ref="avatarInputRef" type="file" accept="image/*" class="hidden" @change="handleAvatarChange" />
      </aside>

      <section class="form-panel">
        <div class="field-grid">
          <label class="field-block">
            <span class="field-label ui-label">ID</span>
            <BaseInput v-model="formData.profileId" placeholder="Enter your ID" />
          </label>
          <label class="field-block">
            <span class="field-label ui-label">Email</span>
            <BaseInput :model-value="formData.email" readonly />
          </label>
        </div>

        <label class="field-block field-block-full">
          <span class="field-label ui-label">User UID</span>
          <BaseInput :model-value="formData.userId" readonly />
        </label>

        <label class="field-block field-block-full">
          <span class="field-label ui-label">Service Status</span>
          <BaseInput :model-value="formData.serviceStatusLabel" readonly />
        </label>
      </section>
    </div>

    <template #footer>
      <div class="ui-modal-actions">
        <BaseButton variant="ghost" @click="showModal = false">Cancel</BaseButton>
        <BaseButton :loading="saving" :disabled="saving" @click="handleSave">{{ saving ? 'Saving...' : 'Save changes' }}</BaseButton>
      </div>
    </template>
  </BaseModal>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { BaseButton, BaseInput, BaseModal } from '@/components/ui'
import { useAuthStore } from '@/stores/auth'
import { getErrorMessage } from '@/utils'
import { notifier } from '@/utils/notifier'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:show', 'saved'])

const { user, updateProfile, refreshUser } = useAuthStore()

const showModal = ref(props.show)
const saving = ref(false)
const avatarInputRef = ref(null)
const avatarPreview = ref('')
const hasAvatarChange = ref(false)

const formData = reactive({
  profileId: '',
  email: '',
  userId: '',
  serviceStatusLabel: ''
})

const avatarInitial = computed(() => (formData.profileId || formData.email || 'U').charAt(0).toUpperCase())

const syncForm = () => {
  const current = user.value || {}
  formData.profileId = current.displayName || ''
  formData.email = current.email || ''
  formData.userId = current.id || ''
  formData.serviceStatusLabel = current.serviceStatus === 'active'
    ? 'Enabled'
    : current.serviceStatus === 'disabled'
      ? 'Disabled'
      : 'Not enabled'
  avatarPreview.value = current.avatarUrl || ''
  hasAvatarChange.value = false
}

watch(
  () => props.show,
  async (val) => {
    showModal.value = val
    if (val) {
      try {
        await refreshUser()
      } catch {
        // ignore refresh failures and fall back to current store snapshot
      }
      syncForm()
    }
  }
)

watch(showModal, (val) => {
  emit('update:show', val)
})

watch(
  () => user.value,
  () => {
    if (showModal.value) syncForm()
  },
  { deep: true }
)

const triggerAvatarUpload = () => {
  avatarInputRef.value?.click()
}

const handleAvatarChange = (event) => {
  const file = event.target?.files?.[0]
  if (!file) return

  if (!file.type.startsWith('image/')) {
    notifier.warning('Please choose an image file')
    return
  }

  if (file.size > 2 * 1024 * 1024) {
    notifier.warning('Avatar must be <= 2MB')
    return
  }

  const reader = new FileReader()
  reader.onload = () => {
    avatarPreview.value = String(reader.result || '')
    hasAvatarChange.value = true
  }
  reader.readAsDataURL(file)
  event.target.value = ''
}

const handleSave = async () => {
  const nextId = formData.profileId.trim()
  const currentUser = user.value || {}

  if (!nextId || nextId.length < 2) {
    notifier.warning('ID must be at least 2 characters')
    return
  }

  const payload = {}
  if (nextId !== (currentUser.displayName || '')) {
    payload.displayName = nextId
  }
  if (hasAvatarChange.value) {
    payload.avatarUrl = avatarPreview.value || null
  }

  if (Object.keys(payload).length === 0) {
    notifier.info('No changes to save')
    return
  }

  saving.value = true
  try {
    await updateProfile(payload)
    notifier.success('Profile updated')
    emit('saved')
    showModal.value = false
  } catch (err) {
    if (!err?.__handled) {
      notifier.error(getErrorMessage(err, 'Failed to update profile'))
    }
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.profile-shell {
  display: grid;
  grid-template-columns: 132px minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}

.profile-aside {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding-top: 10px;
}

.avatar-wrap {
  width: 104px;
  height: 104px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  overflow: hidden;
  background: linear-gradient(180deg, #111111 0%, #080808 100%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.avatar-wrap:hover {
  border-color: rgba(255, 255, 255, 0.18);
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-fallback {
  width: 100%;
  height: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #f2f3f5;
  font-size: 42px;
  font-weight: 600;
}

.avatar-link {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-muted);
  transition: color 0.2s ease;
}

.avatar-link:hover {
  color: var(--text);
}

.form-panel {
  display: flex;
  flex-direction: column;
  gap: 22px;
  padding-top: 10px;
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}

.field-block {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.field-block-full {
  width: 100%;
}

.field-label {
  color: var(--text-muted);
}

@media (max-width: 1200px) {
  .profile-shell {
    grid-template-columns: 1fr;
  }

  .profile-aside {
    align-items: center;
    padding-top: 0;
  }

  .field-grid {
    grid-template-columns: 1fr;
  }

  .avatar-wrap {
    width: 88px;
    height: 88px;
  }

  .field-label {
    font-size: 12px;
  }
}
</style>
