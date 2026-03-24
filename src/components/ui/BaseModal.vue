<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 z-[1000] flex items-center justify-center bg-[rgba(5,5,5,0.62)] px-4 py-6 backdrop-blur-[10px]"
      @click="handleOverlayClick"
    >
      <div
        :class="panelClass"
        @click.stop
      >
        <header v-if="title || $slots.header" class="flex items-start justify-between border-b border-white/10 px-8 py-7">
          <slot name="header">
            <div class="flex min-w-0 flex-col gap-3.5">
              <h2 class="ui-title-lg truncate text-[var(--text)]">{{ title }}</h2>
              <p v-if="description" class="ui-body max-w-2xl text-[var(--text-muted)]">{{ description }}</p>
            </div>
          </slot>
          <button
            v-if="showClose"
            type="button"
            class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-transparent text-[var(--text-muted)] leading-none transition-all hover:border-white/10 hover:bg-white/4 hover:text-[var(--text)] focus-visible:border-white/10 focus-visible:bg-white/4 focus-visible:text-[var(--text)] focus-visible:shadow-none focus-visible:outline-none"
            @click="close"
          >
            <span class="sr-only">Close</span>
            <span aria-hidden="true" class="block text-xl leading-none">×</span>
          </button>
        </header>

        <div :class="bodyClass">
          <slot />
        </div>

        <footer v-if="$slots.footer" class="border-t border-white/10 px-8 py-5">
          <slot name="footer" />
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { onBeforeUnmount, watch } from 'vue'
import { computed } from 'vue'

const emit = defineEmits(['update:show', 'close'])

const props = defineProps({
  show: Boolean,
  title: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    default: ''
  },
  size: {
    type: String,
    default: 'md'
  },
  closeOnOverlay: {
    type: Boolean,
    default: true
  },
  closeOnEscape: {
    type: Boolean,
    default: true
  },
  showClose: {
    type: Boolean,
    default: true
  }
})

const panelClass = computed(() => {
  const sizes = {
    sm: 'max-w-xl',
    md: 'max-w-3xl',
    lg: 'max-w-4xl',
    xl: 'max-w-5xl'
  }

  return [
    'w-full overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(24,24,24,0.94)_0%,rgba(18,18,18,0.94)_100%)] text-[var(--text)] shadow-[0_10px_32px_rgba(0,0,0,0.22)] supports-[backdrop-filter]:bg-[linear-gradient(180deg,rgba(24,24,24,0.82)_0%,rgba(18,18,18,0.82)_100%)]',
    sizes[props.size] || sizes.md
  ]
})

const bodyClass = computed(() => {
  return 'px-8 py-7'
})

const close = () => {
  emit('update:show', false)
  emit('close')
}

const handleOverlayClick = () => {
  if (props.closeOnOverlay) {
    close()
  }
}

const handleKeydown = (event) => {
  if (event.key === 'Escape' && props.show && props.closeOnEscape) {
    close()
  }
}

watch(
  () => props.show,
  (isOpen) => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeydown)
      document.body.style.overflow = 'hidden'
      return
    }

    window.removeEventListener('keydown', handleKeydown)
    document.body.style.overflow = ''
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  document.body.style.overflow = ''
})
</script>
