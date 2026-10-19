<template>
  <n-checkbox
    v-bind="checkboxAttrs"
    class="base-checkbox"
    :checked="modelValue"
    :disabled="disabled"
    :indeterminate="indeterminate"
    :aria-disabled="disabled"
    :theme-overrides="themeOverrides"
    @update:checked="updateValue"
  >
    <slot />
  </n-checkbox>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import { NCheckbox } from 'naive-ui'

defineOptions({ inheritAttrs: false })
const props = defineProps({
  modelValue: Boolean,
  disabled: Boolean,
  indeterminate: Boolean
})
const emit = defineEmits(['update:modelValue'])
const attrs = useAttrs()
const checkboxAttrs = computed(() => ({
  ...attrs,
  ...(attrs['aria-label'] && !attrs['aria-labelledby'] ? { 'aria-labelledby': undefined } : {})
}))
const updateValue = (value) => {
  if (!props.disabled) emit('update:modelValue', value)
}
const themeOverrides = {
  fontSizeMedium: '13px',
  sizeMedium: '16px',
  borderRadius: '4px',
  color: 'var(--surface)',
  colorChecked: 'var(--primary)',
  colorDisabled: 'var(--surface)',
  colorDisabledChecked: 'var(--border-strong)',
  checkMarkColor: 'var(--primary-foreground)',
  checkMarkColorDisabled: 'var(--text-soft)',
  checkMarkColorDisabledChecked: 'var(--text-muted)',
  border: '1px solid var(--border-strong)',
  borderChecked: '1px solid var(--primary)',
  borderDisabled: '1px solid var(--border)',
  borderDisabledChecked: '1px solid var(--border-strong)',
  borderFocus: '1px solid var(--text-muted)',
  boxShadowFocus: 'var(--ring)',
  textColor: 'var(--text)',
  textColorDisabled: 'var(--text-soft)',
  labelLineHeight: '1.4',
  labelPadding: '0 0 0 8px'
}
</script>

<style scoped>
.base-checkbox {
  min-width: 0;
  font-family: inherit;
}

.base-checkbox :deep(.n-checkbox__label) {
  min-width: 0;
  overflow-wrap: anywhere;
}
</style>
