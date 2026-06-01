<template>
  <UsageAdminSurface tag="div" surface-class="mx-auto max-w-md rounded-2xl p-6">
    <h2 class="text-lg font-medium text-white">Admin Login</h2>
    <p class="mt-2 text-sm text-white/50">Sign in to manage service credentials and user consumption.</p>
    <div class="mt-5 space-y-3">
      <UsageAdminFormControl
        :value="form.username"
        block
        placeholder="Admin username"
        @input="updateLoginFormField('username', $event.target.value)"
      />
      <UsageAdminFormControl
        :value="form.password"
        type="password"
        block
        placeholder="Admin password"
        @input="updateLoginFormField('password', $event.target.value)"
      />
      <UsageAdminButton kind="primary" block :disabled="loggingIn" @click="emit('submit-login')">
        {{ loggingIn ? 'Signing in...' : 'Sign in' }}
      </UsageAdminButton>
    </div>
  </UsageAdminSurface>
</template>

<script setup>
import UsageAdminButton from './UsageAdminButton.vue'
import UsageAdminFormControl from './UsageAdminFormControl.vue'
import UsageAdminSurface from './UsageAdminSurface.vue'

const emit = defineEmits(['submit-login', 'update-login-form-field'])

defineProps({
  form: {
    type: Object,
    default: () => ({ username: '', password: '' })
  },
  loggingIn: {
    type: Boolean,
    default: false
  }
})

const updateLoginFormField = (field, value) => {
  emit('update-login-form-field', field, value)
}
</script>
