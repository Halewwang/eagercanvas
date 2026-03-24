<template>
  <button
    :type="nativeType"
    :disabled="disabled || loading"
    :class="buttonClass"
    v-bind="$attrs"
  >
    <BaseSpinner v-if="loading" :size="spinnerSize" />
    <slot />
  </button>
</template>

<script setup>
import { computed } from 'vue'
import BaseSpinner from './BaseSpinner.vue'

const props = defineProps({
  variant: {
    type: String,
    default: 'primary'
  },
  size: {
    type: String,
    default: 'md'
  },
  nativeType: {
    type: String,
    default: 'button'
  },
  disabled: Boolean,
  loading: Boolean,
  block: Boolean
})

const buttonClass = computed(() => {
  const base = 'ui-button-text inline-flex items-center justify-center gap-2 whitespace-nowrap outline-none transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50'
  const sizes = {
    sm: 'h-9 rounded-[12px] px-4 text-[14px]',
    md: 'h-11 rounded-[16px] px-5',
    lg: 'h-12 rounded-[18px] px-6'
  }
  const variants = {
    primary: 'bg-[var(--primary)] text-[var(--primary-foreground)] border border-[rgba(255,255,255,0.08)] hover:bg-[var(--primary-hover)] focus-visible:shadow-[var(--ring)]',
    secondary: 'bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-3)] focus-visible:shadow-[var(--ring)]',
    ghost: 'bg-transparent text-[var(--text-muted)] border border-transparent hover:bg-[rgba(255,255,255,0.04)] hover:text-[var(--text)] focus-visible:bg-[rgba(255,255,255,0.04)] focus-visible:text-[var(--text)] focus-visible:shadow-none',
    danger: 'bg-[var(--danger)] text-[var(--primary-foreground)] border border-[rgba(255,255,255,0.08)] hover:bg-[var(--danger-hover)] focus-visible:shadow-[var(--ring)]'
  }

  return [
    base,
    sizes[props.size] || sizes.md,
    variants[props.variant] || variants.primary,
    props.block ? 'w-full' : ''
  ]
})

const spinnerSize = computed(() => {
  if (props.size === 'sm') return 14
  if (props.size === 'lg') return 18
  return 16
})
</script>
