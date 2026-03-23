<template>
  <n-modal v-model:show="visible" preset="dialog" :title="isRegister ? 'Create account' : 'Sign in'" :show-icon="false">
    <div class="space-y-3 py-2">
      <div class="flex gap-2">
        <button
          class="flex-1 py-2 rounded-lg border transition-colors"
          :class="!isRegister ? activeTabClass : inactiveTabClass"
          @click="setMode('login')"
        >
          Login
        </button>
        <button
          class="flex-1 py-2 rounded-lg border transition-colors"
          :class="isRegister ? activeTabClass : inactiveTabClass"
          @click="setMode('register')"
        >
          Register
        </button>
      </div>

      <input
        v-if="isRegister"
        v-model="displayName"
        type="text"
        placeholder="Display name"
        class="w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-xl px-4 py-3 outline-none focus:border-[rgba(212,198,182,0.68)] focus:shadow-[0_0_0_1px_rgba(165,129,99,0.22)]"
      />
      <input
        v-model="email"
        type="email"
        placeholder="you@example.com"
        class="w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-xl px-4 py-3 outline-none focus:border-[rgba(212,198,182,0.68)] focus:shadow-[0_0_0_1px_rgba(165,129,99,0.22)]"
      />
      <div class="flex gap-2">
        <input
          v-model="code"
          type="text"
          maxlength="6"
          placeholder="6-digit code"
          class="flex-1 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-xl px-4 py-3 outline-none focus:border-[rgba(212,198,182,0.68)] focus:shadow-[0_0_0_1px_rgba(165,129,99,0.22)]"
        />
        <button class="flora-button-ghost px-4 rounded-xl" :disabled="sending" @click="handleSendCode">
          {{ sending ? 'Sending' : 'Send Code' }}
        </button>
      </div>
    </div>
    <template #action>
      <div class="flex justify-end gap-3">
        <button @click="handleClose" class="px-4 py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Cancel</button>
        <button class="flora-button-primary px-6 py-2 rounded-lg transition-opacity" :disabled="verifying" @click="handleSubmit">
          {{ verifying ? (isRegister ? 'Registering...' : 'Signing in...') : (isRegister ? 'Verify & Register' : 'Verify & Sign In') }}
        </button>
      </div>
    </template>
  </n-modal>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { NModal } from 'naive-ui'
import { useAuthStore } from '@/stores/auth'
import { getErrorMessage } from '@/utils'

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
const activeTabClass = 'border-[var(--accent-color)] text-white bg-[var(--bg-tertiary)]'
const inactiveTabClass = 'border-[var(--border-color)] text-[var(--text-secondary)]'

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
    window.$message?.warning('Please enter email')
    return
  }

  sending.value = true
  try {
    if (isRegister.value) {
      await sendRegister(email.value.trim())
      window.$message?.success('Registration code sent')
    } else {
      await sendCode(email.value.trim())
      window.$message?.success('Login code sent')
    }
  } catch (error) {
    if (!error?.__handled) {
      window.$message?.error(getErrorMessage(error, 'Failed to send code'))
    }
  } finally {
    sending.value = false
  }
}

const handleSubmit = async () => {
  if (!email.value.trim()) {
    window.$message?.warning('Please enter email')
    return
  }
  if (code.value.trim().length !== 6) {
    window.$message?.warning('Please enter a 6-digit code')
    return
  }
  if (isRegister.value && !displayName.value.trim()) {
    window.$message?.warning('Please enter display name')
    return
  }

  verifying.value = true
  try {
    if (isRegister.value) {
      await verifyRegister(email.value.trim(), code.value.trim(), displayName.value.trim())
      window.$message?.success('Registered and signed in')
    } else {
      await verifyCode(email.value.trim(), code.value.trim())
      window.$message?.success('Signed in')
    }

    visible.value = false
    emit('success')
  } catch (error) {
    if (!error?.__handled) {
      window.$message?.error(getErrorMessage(error, isRegister.value ? 'Register failed' : 'Sign in failed'))
    }
  } finally {
    verifying.value = false
  }
}
</script>
