<template>
  <aside class="admin-sidebar hidden lg:fixed lg:bottom-6 lg:left-6 lg:top-6 lg:flex lg:w-[232px] lg:flex-col lg:overflow-hidden lg:rounded-[20px]">
    <div class="px-5 pt-5">
      <div class="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
        <p class="text-xs uppercase tracking-[0.18em] text-white/45">{{ brandEyebrow }}</p>
        <p class="mt-1 text-sm font-medium text-white/90">{{ brandTitle }}</p>
        <p class="mt-3 text-xs leading-5 text-white/55">{{ brandCaption }}</p>
      </div>
    </div>

    <nav class="mt-6 space-y-1 px-4">
      <slot name="nav" />
    </nav>

    <div v-if="$slots.meta" class="mt-6 px-4">
      <slot name="meta" />
    </div>

    <div class="mt-auto p-4">
      <div class="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <p class="text-sm font-medium text-white/90">{{ sessionTitle }}</p>
        <p class="mt-2 text-xs text-white/55">{{ sessionPrimary }}</p>
        <p class="mt-1 text-xs text-white/45">{{ sessionSecondary }}</p>
      </div>
    </div>
  </aside>
</template>

<script setup>
defineProps({
  brandCaption: {
    type: String,
    default: ''
  },
  brandEyebrow: {
    type: String,
    default: 'EagerCanvas'
  },
  brandTitle: {
    type: String,
    required: true
  },
  sessionPrimary: {
    type: String,
    default: '-'
  },
  sessionSecondary: {
    type: String,
    default: ''
  },
  sessionTitle: {
    type: String,
    required: true
  }
})
</script>

<style scoped>
.admin-sidebar {
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: linear-gradient(180deg, rgba(8, 8, 9, 0.72) 0%, rgba(12, 12, 14, 0.8) 100%);
}
</style>
