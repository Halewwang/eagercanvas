<template>
  <div class="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex items-center justify-center px-4">
    <div class="w-full max-w-md flora-panel rounded-2xl p-8">
      <h1 class="text-2xl font-light mb-2">{{ isRegister ? 'Create account' : 'Sign in' }}</h1>
      <p class="text-sm text-[var(--text-secondary)] mb-6">
        {{ isRegister ? 'Register with email verification code.' : 'Use email verification code to continue.' }}
      </p>

      <div class="flex gap-2 mb-4">
        <button
          class="flex-1 py-2 rounded-lg border transition-colors"
          :class="!isRegister ? activeTabClass : inactiveTabClass"
          @click="switchMode('login')"
        >
          Login
        </button>
        <button
          class="flex-1 py-2 rounded-lg border transition-colors"
          :class="isRegister ? activeTabClass : inactiveTabClass"
          @click="switchMode('register')"
        >
          Register
        </button>
      </div>

      <div class="space-y-4">
        <input
          v-if="isRegister"
          v-model="displayName"
          type="text"
          placeholder="Display name"
          class="w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-xl px-4 py-3 outline-none focus:border-[var(--accent-color)]"
        />

        <input
          v-model="email"
          type="email"
          placeholder="you@example.com"
          class="w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-xl px-4 py-3 outline-none focus:border-[var(--accent-color)]"
        />

        <div class="flex gap-2">
          <input
            v-model="code"
            type="text"
            maxlength="6"
            placeholder="6-digit code"
            class="flex-1 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-xl px-4 py-3 outline-none focus:border-[var(--accent-color)]"
          />
          <button
            class="flora-button-ghost px-4 rounded-xl"
            :disabled="sending"
            @click="handleSendCode"
          >
            {{ sending ? 'Sending' : 'Send Code' }}
          </button>
        </div>

        <button
          class="flora-button-primary w-full py-3 rounded-xl"
          :disabled="verifying"
          @click="handleVerify"
        >
          {{ verifying ? (isRegister ? 'Registering...' : 'Signing in...') : (isRegister ? 'Verify & Register' : 'Verify & Sign In') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const { sendCode, sendRegister, verifyCode, verifyRegister } = useAuthStore()

const mode = ref(route.query.mode === 'register' ? 'register' : 'login')
const email = ref('')
const code = ref('')
const displayName = ref('')
const sending = ref(false)
const verifying = ref(false)

const isRegister = computed(() => mode.value === 'register')

const activeTabClass = 'border-[var(--accent-color)] text-white bg-[var(--bg-tertiary)]'
const inactiveTabClass = 'border-[var(--border-color)] text-[var(--text-secondary)]'

const switchMode = (nextMode) => {
  mode.value = nextMode
  router.replace({ path: '/login', query: nextMode === 'register' ? { mode: 'register' } : {} })
}

const handleSendCode = async () => {
  if (!email.value) return
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
    const msg = error?.response?.data?.message || error?.message || 'Failed to send code'
    window.$message?.error(msg)
  } finally {
    sending.value = false
  }
}

const handleVerify = async () => {
  if (!email.value || code.value.length !== 6) return
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

    router.push('/')
  } catch (error) {
    const msg = error?.response?.data?.message || error?.message || (isRegister.value ? 'Register failed' : 'Sign in failed')
    window.$message?.error(msg)
  } finally {
    verifying.value = false
  }
}
</script>
