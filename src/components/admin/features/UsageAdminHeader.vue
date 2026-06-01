<template>
  <header class="mb-8 border-b border-white/10 pb-6">
    <div class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div class="max-w-3xl">
        <p class="text-xs uppercase tracking-[0.2em] text-white/45">管理控制台</p>
        <h1 class="mt-2 text-2xl font-semibold text-white md:text-3xl">Usage Admin</h1>
        <p class="mt-3 text-sm leading-6 text-white/55">
          Eager 服务凭证管理、用户分配和消耗复核集中在一个控制台。
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <UsageAdminButton v-if="isAuthenticated" :disabled="loading" @click="emit('refresh')">
          {{ loading ? 'Refreshing...' : 'Refresh data' }}
        </UsageAdminButton>
        <UsageAdminButton v-if="isAuthenticated" @click="emit('logout')">Logout</UsageAdminButton>
        <UsageAdminButton @click="emit('go-home')">Home</UsageAdminButton>
      </div>
    </div>
  </header>
</template>

<script setup>
import UsageAdminButton from './UsageAdminButton.vue'

const emit = defineEmits(['go-home', 'logout', 'refresh'])

defineProps({
  isAuthenticated: {
    type: Boolean,
    default: false
  },
  loading: {
    type: Boolean,
    default: false
  }
})
</script>
