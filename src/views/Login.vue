<template>
  <div class="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex items-center justify-center px-4">
    <div class="w-full max-w-md flora-panel rounded-2xl p-8">
      <h1 class="text-2xl font-light mb-2">Sign in</h1>
      <p class="text-sm text-[var(--text-secondary)] mb-6">Use email verification code to continue.</p>

      <div class="space-y-4">
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
          {{ verifying ? 'Signing in...' : 'Verify & Sign In' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const { sendCode, verifyCode } = useAuthStore()

const email = ref('')
const code = ref('')
const sending = ref(false)
const verifying = ref(false)

const handleSendCode = async () => {
  if (!email.value) return
  sending.value = true
  try {
    await sendCode(email.value.trim())
    window.$message?.success('Verification code sent')
  } catch (error) {
    window.$message?.error(error?.message || 'Failed to send code')
  } finally {
    sending.value = false
  }
}

const handleVerify = async () => {
  if (!email.value || code.value.length !== 6) return
  verifying.value = true
  try {
    await verifyCode(email.value.trim(), code.value.trim())
    window.$message?.success('Signed in')
    router.push('/')
  } catch (error) {
    window.$message?.error(error?.message || 'Sign in failed')
  } finally {
    verifying.value = false
  }
}
</script>
