<template>
  <label v-if="label" class="flex flex-col gap-2">
    <span class="ui-label text-[var(--text-muted)]">{{ label }}</span>
    <input
      :value="modelValue"
      :type="type"
      :placeholder="placeholder"
      :disabled="disabled"
      :readonly="readonly"
      :class="inputClass"
      v-bind="$attrs"
      @input="$emit('update:modelValue', $event.target.value)"
    >
  </label>
  <input
    v-else
    :value="modelValue"
    :type="type"
    :placeholder="placeholder"
    :disabled="disabled"
    :readonly="readonly"
    :class="inputClass"
    v-bind="$attrs"
    @input="$emit('update:modelValue', $event.target.value)"
  >
</template>

<script setup>
import { computed } from 'vue'

defineEmits(['update:modelValue'])

const props = defineProps({
  modelValue: {
    type: [String, Number],
    default: ''
  },
  label: {
    type: String,
    default: ''
  },
  type: {
    type: String,
    default: 'text'
  },
  placeholder: {
    type: String,
    default: ''
  },
  disabled: Boolean,
  readonly: Boolean
})

const inputClass = computed(() => {
  return 'ui-body w-full h-11 rounded-[18px] border border-[var(--border)] bg-[var(--surface)] px-5 text-[var(--text)] outline-none placeholder:text-[var(--text-soft)] transition-all focus:border-[var(--border-strong)] focus:bg-[var(--surface-2)] focus:shadow-none disabled:cursor-not-allowed disabled:opacity-50'
})
</script>
