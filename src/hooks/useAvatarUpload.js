import { computed, ref } from 'vue'
import { getErrorMessage } from '@/utils'
import { uploadImageFile } from '@/utils/media'

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

    if (!file.type.startsWith('image/')) {
      notify.error('Please choose an image file')
      event.target.value = ''
      return
    }

    if (file.size > MAX_AVATAR_BYTES) {
      notify.error('Avatar must be <= 2MB')
      event.target.value = ''
      return
    }

    try {
      const avatarUrl = await uploadImageFile(file)
      if (!avatarUrl) {
        throw new Error('Avatar upload returned empty URL')
      }

      await updateProfile({ avatarUrl })
      notify.success('Avatar updated')
    } catch (err) {
      if (!err?.__handled) {
        notify.error(getErrorMessage(err, 'Failed to update avatar'))
      }
    } finally {
      event.target.value = ''
    }
  }

  return {
    avatarInitial,
    avatarInputRef,
    handleAvatarChange,
    triggerAvatarUpload
  }
}

export default useAvatarUpload
