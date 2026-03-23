<template>
  <n-modal v-model:show="showModal" :mask-closable="true" :auto-focus="false" :trap-focus="true">
    <div class="profile-modal ec-modal">
      <div class="profile-header ec-modal-header">
        <h2 class="profile-title ec-modal-title">Profile</h2>
        <button class="close-btn ec-modal-close" @click="showModal = false" aria-label="Close">
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
            <button class="ec-btn ec-btn-primary" :disabled="saving" @click="handleSave">{{ saving ? 'Saving...' : 'Save changes' }}</button>
          </div>
        </div>
      </div>
    </div>
  </n-modal>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { NIcon, NInput, NModal } from 'naive-ui'
import { useAuthStore } from '@/stores/auth'
import { isDataImageUrl, uploadImageFile } from '@/utils/media'
import { CloseOutline } from '../icons/coolicons'
import { getErrorMessage } from '@/utils'

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
const avatarFile = ref(null)

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
  avatarFile.value = null
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
    avatarFile.value = file
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
    if (avatarPreview.value) {
      if (isDataImageUrl(avatarPreview.value)) {
        if (!avatarFile.value) {
          throw new Error('Avatar file is missing')
        }

        const uploadedAvatarUrl = await uploadImageFile(avatarFile.value)
        if (!uploadedAvatarUrl) {
          throw new Error('Avatar upload returned empty URL')
        }
        payload.avatarUrl = uploadedAvatarUrl
      } else {
        payload.avatarUrl = avatarPreview.value
      }
    } else {
      payload.avatarUrl = null
    }
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
    if (!err?.__handled) {
      window.$message?.error(getErrorMessage(err, 'Failed to update profile'))
    }
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.profile-modal {
  min-height: 400px;
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
  background: linear-gradient(180deg, #16171a 0%, #101113 100%);
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
  background: linear-gradient(180deg, rgba(24, 25, 28, 0.92) 0%, rgba(15, 16, 18, 0.92) 100%);
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
  --n-color: transparent !important;
  --n-color-disabled: transparent !important;
  --n-color-focus: transparent !important;
  --n-border: transparent !important;
  --n-border-hover: transparent !important;
  --n-border-focus: transparent !important;
  --n-box-shadow-focus: none !important;
}

:deep(.n-input-wrapper),
:deep(.n-input__input-el),
:deep(.n-input__textarea-el) {
  background: transparent !important;
}

:deep(.n-input.n-input--focus .n-input-wrapper),
:deep(.n-input.n-input--focus .n-input__input-el),
:deep(.n-input.n-input--focus .n-input__textarea-el) {
  background: transparent !important;
}

@media (max-width: 1200px) {
  .profile-modal {
    width: min(620px, calc(100vw - 24px));
    min-height: auto;
    padding: 14px;
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
}
</style>
