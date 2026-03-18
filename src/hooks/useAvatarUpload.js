import { computed, ref } from 'vue'
import { getErrorMessage } from '@/utils'

const MAX_AVATAR_BYTES = 2 * 1024 * 1024

export const useAvatarUpload = ({ user, updateProfile, notify }) => {
  const avatarInputRef = ref(null)
  const avatarInitial = computed(() =>
    (user.value?.displayName || user.value?.email || 'U').charAt(0).toUpperCase()
  )

  const triggerAvatarUpload = () => {
    avatarInputRef.value?.click()
  }

  const handleAvatarChange = async (event) => {
    const file = event.target?.files?.[0]
    if (!file) return

    if (file.size > MAX_AVATAR_BYTES) {
      notify.error('Avatar must be <= 2MB')
      return
    }

    const reader = new FileReader()
    reader.onload = async () => {
      try {
        await updateProfile({ avatarUrl: String(reader.result || '') })
        notify.success('Avatar updated')
      } catch (err) {
        if (!err?.__handled) {
          notify.error(getErrorMessage(err, 'Failed to update avatar'))
        }
      }
    }

    reader.readAsDataURL(file)
    event.target.value = ''
  }

  return {
    avatarInitial,
    avatarInputRef,
    handleAvatarChange,
    triggerAvatarUpload
  }
}

export default useAvatarUpload
