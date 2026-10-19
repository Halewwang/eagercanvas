<template>
  <n-select
    ref="selectRef"
    v-combobox-attributes="comboboxAttributes"
    v-bind="rootAttrs"
    class="base-select"
    :value="modelValue"
    :options="options"
    :disabled="disabled"
    :show="menuOpen"
    :placeholder="placeholder"
    :theme-overrides="themeOverrides"
    :menu-props="menuProps"
    :node-props="optionAttributes"
    to="body"
    @update:value="updateValue"
    @update:show="menuOpen = $event"
    @keydown.capture="handleEscape"
  />
</template>

<script setup>
import { computed, ref, useAttrs, useId } from 'vue'
import { NSelect } from 'naive-ui'

defineOptions({ inheritAttrs: false })
const props = defineProps({
  modelValue: { type: [String, Number], default: null },
  options: { type: Array, default: () => [] },
  disabled: Boolean,
  placeholder: { type: String, default: '' }
})
const emit = defineEmits(['update:modelValue'])
const attrs = useAttrs()
const selectRef = ref(null)
const menuOpen = ref(false)
const menuId = `base-select-menu-${useId()}`
const isControlAttribute = (key) => key === 'id' || key.startsWith('aria-')
const rootAttrs = computed(() => Object.fromEntries(Object.entries(attrs).filter(([key]) => !isControlAttribute(key))))
const comboboxAttributes = computed(() => ({
  ...Object.fromEntries(Object.entries(attrs).filter(([key]) => isControlAttribute(key))),
  role: 'combobox',
  'aria-haspopup': 'listbox',
  'aria-expanded': String(menuOpen.value),
  'aria-controls': menuId,
  'aria-disabled': String(props.disabled)
}))

// Naive's non-filterable select exposes no attributes prop for its keyboard trigger.
const forwardComboboxAttributes = (element, { value, oldValue = {} }) => {
  const trigger = element.querySelector('.n-base-selection-label')
  if (!trigger) return
  for (const key of Object.keys(oldValue)) {
    if (!(key in value)) trigger.removeAttribute(key)
  }
  for (const [key, attributeValue] of Object.entries(value)) {
    if (attributeValue == null) trigger.removeAttribute(key)
    else trigger.setAttribute(key, attributeValue)
  }
}
const vComboboxAttributes = {
  mounted: forwardComboboxAttributes,
  updated: forwardComboboxAttributes,
  getSSRProps: () => ({})
}
const updateValue = (value) => {
  if (!props.disabled) emit('update:modelValue', value)
}
const handleEscape = (event) => {
  if (event.key !== 'Escape' || !menuOpen.value) return
  event.stopPropagation()
  event.preventDefault()
  menuOpen.value = false
  selectRef.value?.focus()
}
const optionAttributes = (option) => ({
  role: 'option',
  'aria-selected': option.value === props.modelValue,
  'aria-disabled': Boolean(option.disabled)
})
const menuProps = {
  id: menuId,
  role: 'listbox',
  class: 'base-select-menu',
  onKeydownCapture: handleEscape,
  style: { maxWidth: 'calc(100vw - 24px)' }
}
const themeOverrides = {
  menuBoxShadow: 'var(--shadow-md)',
  peers: {
    InternalSelection: {
      heightMedium: '38px',
      fontSizeMedium: '13px',
      borderRadius: 'var(--radius-sm)',
      color: 'var(--surface-2)',
      colorActive: 'var(--surface-3)',
      colorDisabled: 'var(--surface)',
      textColor: 'var(--text)',
      textColorDisabled: 'var(--text-soft)',
      placeholderColor: 'var(--text-muted)',
      placeholderColorDisabled: 'var(--text-soft)',
      border: '1px solid var(--border)',
      borderHover: '1px solid var(--border-strong)',
      borderActive: '1px solid var(--text-muted)',
      borderFocus: '1px solid var(--text-muted)',
      boxShadowActive: 'var(--ring)',
      boxShadowFocus: 'var(--ring)',
      caretColor: 'var(--text)',
      loadingColor: 'var(--text)',
      arrowColor: 'var(--text-muted)',
      arrowColorDisabled: 'var(--text-soft)',
      paddingSingle: '0 12px'
    },
    InternalSelectMenu: {
      borderRadius: 'var(--radius-sm)',
      color: 'var(--surface-2)',
      optionFontSizeMedium: '13px',
      optionTextColor: 'var(--text)',
      optionTextColorPressed: 'var(--text)',
      optionTextColorActive: 'var(--text)',
      optionTextColorDisabled: 'var(--text-soft)',
      optionCheckColor: 'var(--text)',
      optionColorPending: 'var(--surface-3)',
      optionColorActive: 'var(--surface-3)',
      optionColorActivePending: 'var(--border)',
      loadingColor: 'var(--text)'
    }
  }
}
</script>

<style scoped>
.base-select {
  width: 100%;
  min-width: 0;
  font-family: inherit;
}
</style>

<style>
.base-select-menu {
  border: 1px solid var(--border);
  font-family: inherit;
}

.base-select-menu .n-base-select-option__content {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
