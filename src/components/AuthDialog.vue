<template>
  <BaseModal
    v-model:show="visible"
    :title="isRegister ? 'Create account' : 'Sign in'"
    :description="isRegister ? 'Create your account with email verification.' : 'Enter your email and verification code to continue.'"
    size="sm"
  >
    <div class="auth-panel">
      <div class="auth-tabs">
        <button
          class="auth-tab"
          :class="!isRegister ? activeTabClass : inactiveTabClass"
          @click="setMode('login')"
        >
          Login
        </button>
        <button
          class="auth-tab"
          :class="isRegister ? activeTabClass : inactiveTabClass"
          @click="setMode('register')"
        >
          Register
        </button>
      </div>

      <BaseInput
        v-if="isRegister"
        v-model="displayName"
        type="text"
        placeholder="Display name"
      />
      <BaseInput
        v-model="email"
        type="email"
        placeholder="you@example.com"
      />
      <div class="auth-code-row">
        <BaseInput
          v-model="code"
          type="text"
          maxlength="6"
          placeholder="6-digit code"
          class="flex-1"
        />
        <BaseButton variant="secondary" :disabled="sending" @click="handleSendCode">
          {{ sending ? 'Sending' : 'Send Code' }}
        </BaseButton>
      </div>
    </div>
    <template #footer>
      <BaseModalActions>
        <BaseButton variant="ghost" @click="handleClose">Cancel</BaseButton>
        <BaseButton :disabled="verifying" :loading="verifying" @click="handleSubmit">
          {{ verifying ? (isRegister ? 'Registering...' : 'Signing in...') : (isRegister ? 'Verify & Register' : 'Verify & Sign In') }}
        </BaseButton>
      </BaseModalActions>
    </template>
  </BaseModal>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { BaseButton, BaseInput, BaseModal, BaseModalActions } from '@/components/ui'
import { useAuthStore } from '@/stores/auth'
import { getErrorMessage } from '@/utils'
import { notifier } from '@/utils/notifier'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  mode: {
    type: String,
    default: 'login'
  }
})

const emit = defineEmits(['update:show', 'update:mode', 'success', 'close'])

const { sendCode, sendRegister, verifyCode, verifyRegister } = useAuthStore()

const visible = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value)
})

const currentMode = ref(props.mode === 'register' ? 'register' : 'login')
const email = ref('')
const code = ref('')
const displayName = ref('')
const sending = ref(false)
const verifying = ref(false)

const isRegister = computed(() => currentMode.value === 'register')
const activeTabClass = 'border-white/10 bg-[var(--surface-2)] text-[var(--text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]'
const inactiveTabClass = 'border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface)]'

watch(
  () => props.mode,
  (value) => {
    currentMode.value = value === 'register' ? 'register' : 'login'
  }
)

watch(visible, (isOpen) => {
  if (!isOpen) {
    email.value = ''
    code.value = ''
    displayName.value = ''
  }
})

const setMode = (value) => {
  currentMode.value = value
  emit('update:mode', value)
}

const handleClose = () => {
  visible.value = false
  emit('close')
}

const handleSendCode = async () => {
  if (!email.value.trim()) {
    notifier.warning('Please enter email')
    return
  }

  sending.value = true
  try {
    if (isRegister.value) {
      await sendRegister(email.value.trim())
      notifier.success('Registration code sent')
    } else {
      await sendCode(email.value.trim())
      notifier.success('Login code sent')
    }
  } catch (error) {
    if (!error?.__handled) {
      notifier.error(getErrorMessage(error, 'Failed to send code'))
    }
  } finally {
    sending.value = false
  }
}

const handleSubmit = async () => {
  if (!email.value.trim()) {
    notifier.warning('Please enter email')
    return
  }
  if (code.value.trim().length !== 6) {
    notifier.warning('Please enter a 6-digit code')
    return
  }
  if (isRegister.value && !displayName.value.trim()) {
    notifier.warning('Please enter display name')
    return
  }

  verifying.value = true
  try {
    if (isRegister.value) {
      await verifyRegister(email.value.trim(), code.value.trim(), displayName.value.trim())
      notifier.success('Registered and signed in')
    } else {
      await verifyCode(email.value.trim(), code.value.trim())
      notifier.success('Signed in')
    }

    visible.value = false
    emit('success')
  } catch (error) {
    if (!error?.__handled) {
      notifier.error(getErrorMessage(error, isRegister.value ? 'Register failed' : 'Sign in failed'))
    }
  } finally {
    verifying.value = false
  }
}
</script>

<style scoped>
.auth-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.auth-tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.auth-tab {
  height: 42px;
  border-radius: 16px;
  border: 1px solid var(--border);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.01em;
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}

.auth-code-row {
  display: flex;
  gap: 10px;
}

</style>
