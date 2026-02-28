<template>
  <n-modal v-model:show="showModal" :mask-closable="true" :auto-focus="false" :trap-focus="true">
    <div class="profile-modal">
      <div class="profile-header">
        <h2 class="profile-title">Profile</h2>
        <button class="close-btn" @click="showModal = false" aria-label="Close">
          <n-icon :size="20"><CloseOutline /></n-icon>
        </button>
      </div>

      <div class="profile-body">
        <div class="avatar-column">
          <button class="avatar-wrap" @click="triggerAvatarUpload" title="Edit avatar">
            <img v-if="avatarPreview" :src="avatarPreview" alt="avatar" class="avatar-image" />
            <div v-else class="avatar-fallback">{{ avatarInitial }}</div>
          </button>
          <button class="avatar-edit-btn" @click="triggerAvatarUpload">Edit</button>
          <input ref="avatarInputRef" type="file" accept="image/*" class="hidden" @change="handleAvatarChange" />
        </div>

        <div class="form-column">
          <div class="field-grid">
            <div class="field-card">
              <label class="field-label">ID</label>
              <n-input v-model:value="formData.profileId" placeholder="Enter your ID" />
            </div>
            <div class="field-card">
              <label class="field-label">Email</label>
              <n-input :value="formData.email" readonly />
            </div>
          </div>

          <div class="field-card field-card-full">
            <label class="field-label">User UID</label>
            <n-input :value="formData.userId" readonly />
          </div>

          <div class="actions-row">
            <n-button class="save-btn" :loading="saving" :disabled="saving" @click="handleSave">Save changes</n-button>
          </div>
        </div>
      </div>
    </div>
  </n-modal>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { NButton, NIcon, NInput, NModal } from 'naive-ui'
import { useAuthStore } from '@/stores/auth'
import { CloseOutline } from '../icons/coolicons'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:show', 'saved'])

const { user, updateProfile } = useAuthStore()

const showModal = ref(props.show)
const saving = ref(false)
const avatarInputRef = ref(null)
const avatarPreview = ref('')
const hasAvatarChange = ref(false)

const formData = reactive({
  profileId: '',
  email: '',
  userId: ''
})

const avatarInitial = computed(() => (formData.profileId || formData.email || 'U').charAt(0).toUpperCase())

const syncForm = () => {
  const current = user.value || {}
  formData.profileId = current.displayName || ''
  formData.email = current.email || ''
  formData.userId = current.id || ''
  avatarPreview.value = current.avatarUrl || ''
  hasAvatarChange.value = false
}

watch(
  () => props.show,
  (val) => {
    showModal.value = val
    if (val) syncForm()
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
    window.$message?.warning('Please choose an image file')
    return
  }

  if (file.size > 2 * 1024 * 1024) {
    window.$message?.warning('Avatar must be <= 2MB')
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
    window.$message?.warning('ID must be at least 2 characters')
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
    window.$message?.info('No changes to save')
    return
  }

  saving.value = true
  try {
    await updateProfile(payload)
    window.$message?.success('Profile updated')
    emit('saved')
    showModal.value = false
  } catch (err) {
    window.$message?.error(err?.response?.data?.message || err?.message || 'Failed to update profile')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.profile-modal {
  width: min(760px, calc(100vw - 48px));
  min-height: 400px;
  padding: 18px 18px;
  border-radius: 14px;
  border: 1px solid rgba(143, 143, 143, 0.24);
  background: radial-gradient(120% 120% at 80% 45%, rgba(114, 40, 40, 0.16), transparent 60%), #090a0d;
  box-shadow: 0 28px 60px rgba(0, 0, 0, 0.5);
}

.profile-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.profile-title {
  margin: 0;
  color: #f3f4f7;
  font-size: 18px;
  line-height: 1;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.close-btn {
  width: 34px;
  height: 34px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #8f939e;
  border: 1px solid transparent;
}

.close-btn:hover {
  border-color: rgba(143, 143, 143, 0.3);
  color: #d7dbe3;
}

.profile-body {
  display: grid;
  grid-template-columns: 128px minmax(0, 1fr);
  gap: 14px;
}

.avatar-column {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.avatar-wrap {
  width: 100px;
  height: 100px;
  border-radius: 999px;
  border: 1px solid rgba(143, 143, 143, 0.28);
  overflow: hidden;
  background: #101218;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.avatar-wrap:hover {
  border-color: rgba(226, 229, 235, 0.5);
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
  font-size: 32px;
  font-weight: 600;
}

.avatar-edit-btn {
  color: #8f939e;
  font-size: 13px;
  line-height: 1;
}

.avatar-edit-btn:hover {
  color: #f2f3f5;
}

.form-column {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.field-card {
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid rgba(143, 143, 143, 0.24);
  background: rgba(9, 11, 15, 0.85);
}

.field-card-full {
  width: 100%;
}

.field-label {
  display: block;
  color: #9ea4af;
  font-size: 11px;
  margin-bottom: 4px;
  line-height: 1;
}

.actions-row {
  margin-top: auto;
  display: flex;
  justify-content: flex-end;
}

:deep(.n-input .n-input__input-el) {
  color: #f2f3f5;
  font-size: 13px;
  font-weight: 500;
}

:deep(.n-input.n-input--disabled .n-input__input-el) {
  color: #7f8590;
}

:deep(.n-input .n-input__border),
:deep(.n-input .n-input__state-border) {
  display: none;
}

:deep(.n-input) {
  background: transparent;
}

.save-btn {
  min-width: 112px;
  height: 34px;
  border-radius: 8px;
  font-size: 12px;
  color: #ffffff;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(143, 143, 143, 0.36);
}

.save-btn:hover {
  border-color: rgba(226, 229, 235, 0.72);
  background: rgba(255, 255, 255, 0.14);
}

@media (max-width: 1200px) {
  .profile-modal {
    width: min(620px, calc(100vw - 24px));
    min-height: auto;
    padding: 14px;
  }

  .profile-title {
    font-size: 16px;
  }

  .profile-body {
    grid-template-columns: 1fr;
  }

  .avatar-column {
    align-items: flex-start;
  }

  .field-grid {
    grid-template-columns: 1fr;
  }

  .avatar-wrap {
    width: 88px;
    height: 88px;
  }

  .field-label {
    font-size: 10px;
  }

  :deep(.n-input .n-input__input-el) {
    font-size: 12px;
  }

  .save-btn {
    min-width: 102px;
    height: 32px;
    font-size: 11px;
  }
}
</style>
