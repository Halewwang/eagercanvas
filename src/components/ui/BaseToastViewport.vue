<template>
  <Teleport to="body">
    <div class="pointer-events-none fixed right-4 top-4 z-[1200] flex w-full max-w-sm flex-col gap-3">
      <TransitionGroup name="toast">
        <div
          v-for="toast in state.items"
          :key="toast.id"
          class="pointer-events-auto rounded-[var(--radius-md)] border px-4 py-3 shadow-[var(--shadow-lg)] backdrop-blur-sm"
          :class="toastClass(toast.type)"
        >
          <div class="flex items-start justify-between gap-3">
            <p class="text-sm leading-6">{{ toast.message }}</p>
            <button
              type="button"
              class="shrink-0 rounded-[var(--radius-sm)] p-1 text-current/70 transition hover:bg-white/10 hover:text-current"
              @click="dismiss(toast.id)"
            >
              <span class="sr-only">Dismiss</span>
              <span aria-hidden="true">×</span>
            </button>
          </div>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup>
import { toastState, dismissToast } from '@/utils/notifier'

const state = toastState

const dismiss = (id) => {
  dismissToast(id)
}

const toastClass = (type) => {
  const variants = {
    success: 'border-[rgba(108,171,121,0.4)] bg-[rgba(14,23,17,0.92)] text-[var(--text)]',
    warning: 'border-[rgba(200,160,106,0.4)] bg-[rgba(28,21,12,0.92)] text-[var(--text)]',
    error: 'border-[rgba(208,95,95,0.4)] bg-[rgba(28,14,14,0.94)] text-[var(--text)]',
    info: 'border-[rgba(143,143,143,0.3)] bg-[rgba(20,22,24,0.94)] text-[var(--text)]'
  }

  return variants[type] || variants.info
}
</script>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
