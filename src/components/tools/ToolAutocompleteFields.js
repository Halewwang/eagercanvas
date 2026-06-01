import { computed, defineComponent, h, nextTick, onBeforeUnmount, ref, watch } from 'vue'

export const normalizeDropdownItems = (items = []) =>
  (items || []).map((item) =>
    typeof item === 'string'
      ? { key: item, label: item, description: '' }
      : { key: item?.key, label: item?.label ?? item?.key, description: item?.description ?? '' }
  )

export const matchesOptionQuery = (item, query) => {
  const keyword = String(query || '').trim().toLowerCase()
  if (!keyword) return true

  return [item.label, item.description, item.key]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(keyword))
}

const useFieldPopover = (rootRef, open, searchInputRef, onClose) => {
  const handlePointerDown = (event) => {
    if (!open.value) return
    if (rootRef.value?.contains(event.target)) return
    open.value = false
  }

  watch(open, async (visible) => {
    if (visible) {
      document.addEventListener('pointerdown', handlePointerDown)
      await nextTick()
      searchInputRef.value?.focus()
      return
    }

    document.removeEventListener('pointerdown', handlePointerDown)
    onClose?.()
  })

  onBeforeUnmount(() => {
    document.removeEventListener('pointerdown', handlePointerDown)
  })
}

export const AutocompleteField = defineComponent({
  name: 'AutocompleteField',
  props: {
    label: { type: String, default: '' },
    modelValue: { type: String, default: '' },
    options: { type: Array, default: () => [] },
    placeholder: { type: String, default: 'Select' },
    full: { type: Boolean, default: false },
    searchPlaceholder: { type: String, default: 'Search options' },
    required: { type: Boolean, default: false },
    requiredHint: { type: String, default: '' }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const rootRef = ref(null)
    const searchInputRef = ref(null)
    const open = ref(false)
    const query = ref('')
    const normalizedOptions = computed(() => normalizeDropdownItems(props.options))
    const selectedItem = computed(() =>
      normalizedOptions.value.find((item) => String(item.key) === String(props.modelValue))
    )
    const filteredOptions = computed(() =>
      normalizedOptions.value.filter((item) => matchesOptionQuery(item, query.value))
    )
    const closePopover = () => {
      query.value = ''
    }
    const selectOption = (key) => {
      emit('update:modelValue', String(key || ''))
      open.value = false
    }

    useFieldPopover(rootRef, open, searchInputRef, closePopover)

    return () => h('label', { ref: rootRef, class: ['option-field', props.full ? 'option-field-full' : ''] }, [
      h('span', { class: 'option-label' }, [
        h('span', { class: 'option-label-text' }, props.label),
        props.required ? h('span', { class: 'required-indicator' }, '*') : null,
        props.requiredHint ? h('span', { class: 'required-hint' }, props.requiredHint) : null
      ]),
      h('div', { class: 'autocomplete-shell' }, [
        h(
          'button',
          {
            type: 'button',
            class: ['field-select-trigger', !props.modelValue ? 'field-select-placeholder' : ''],
            onClick: () => {
              open.value = !open.value
            }
          },
          [
            h('span', { class: 'field-select-text' }, [
              h('span', { class: 'field-select-value' }, selectedItem.value?.label || props.placeholder),
              selectedItem.value?.description
                ? h('span', { class: 'field-select-description' }, selectedItem.value.description)
                : null
            ]),
            h('span', { class: ['field-select-caret', open.value ? 'field-select-caret-open' : ''], 'aria-hidden': 'true' }, '⌄')
          ]
        ),
        open.value
          ? h('div', { class: 'autocomplete-popover' }, [
              h('div', { class: 'autocomplete-search-row' }, [
                h('input', {
                  ref: searchInputRef,
                  class: 'autocomplete-search-input',
                  type: 'text',
                  value: query.value,
                  placeholder: props.searchPlaceholder,
                  onInput: (event) => {
                    query.value = event.target.value
                  }
                })
              ]),
              filteredOptions.value.length > 0
                ? h(
                    'div',
                    { class: 'autocomplete-options' },
                    filteredOptions.value.map((item) =>
                      h(
                        'button',
                        {
                          key: item.key,
                          type: 'button',
                          class: ['autocomplete-option', String(item.key) === String(props.modelValue) ? 'autocomplete-option-active' : ''],
                          onClick: () => selectOption(item.key)
                        },
                        [
                          h('span', { class: 'autocomplete-option-copy' }, [
                            h('span', { class: 'autocomplete-option-label' }, item.label),
                            item.description
                              ? h('span', { class: 'autocomplete-option-description' }, item.description)
                              : null
                          ]),
                          h('span', { class: 'autocomplete-option-check' }, String(item.key) === String(props.modelValue) ? '✓' : '')
                        ]
                      )
                    )
                  )
                : h('div', { class: 'autocomplete-empty' }, 'No matching options')
            ])
          : null
      ])
    ])
  }
})

export const MultiAutocompleteField = defineComponent({
  name: 'MultiAutocompleteField',
  props: {
    label: { type: String, default: '' },
    modelValue: { type: Array, default: () => [] },
    options: { type: Array, default: () => [] },
    placeholder: { type: String, default: 'Add tag' },
    searchPlaceholder: { type: String, default: 'Search or type to add' },
    maxTags: { type: Number, default: Infinity }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const rootRef = ref(null)
    const searchInputRef = ref(null)
    const open = ref(false)
    const query = ref('')
    const normalizedOptions = computed(() => normalizeDropdownItems(props.options))
    const safeValues = computed(() =>
      Array.from(new Set((props.modelValue || []).map((item) => String(item || '').trim()).filter(Boolean)))
    )
    const filteredOptions = computed(() =>
      normalizedOptions.value.filter((item) => matchesOptionQuery(item, query.value))
    )
    const canAddMore = computed(() => safeValues.value.length < props.maxTags)
    const exactMatch = computed(() =>
      normalizedOptions.value.find((item) => String(item.label).toLowerCase() === String(query.value || '').trim().toLowerCase())
    )
    const clearSearch = () => {
      query.value = ''
    }
    const commit = (value) => {
      const safeValue = String(value || '').trim()
      if (!safeValue || safeValues.value.includes(safeValue)) {
        clearSearch()
        return
      }
      if (!canAddMore.value) {
        window.$message?.warning(`最多选择 ${props.maxTags} 项。`)
        return
      }
      emit('update:modelValue', [...safeValues.value, safeValue])
      clearSearch()
    }
    const remove = (value) => {
      emit('update:modelValue', safeValues.value.filter((item) => item !== value))
    }
    const toggleOption = (value) => {
      if (safeValues.value.includes(value)) {
        remove(value)
        return
      }
      commit(value)
    }

    useFieldPopover(rootRef, open, searchInputRef, clearSearch)

    return () => h('div', { ref: rootRef, class: 'option-field option-field-full' }, [
      h('span', { class: 'option-label' }, props.label),
      h('div', {
        class: ['multi-autocomplete-shell', open.value ? 'multi-autocomplete-shell-open' : ''],
        onClick: () => {
          open.value = true
          nextTick(() => searchInputRef.value?.focus())
        }
      }, [
        safeValues.value.map((item) =>
          h('span', { key: item, class: 'tag-pill' }, [
            h('span', { class: 'tag-pill-label' }, item),
            h(
              'button',
              {
                class: 'tag-pill-remove',
                type: 'button',
                onClick: (event) => {
                  event.stopPropagation()
                  remove(item)
                }
              },
              '×'
            )
          ])
        ),
        h('input', {
          ref: searchInputRef,
          class: 'multi-autocomplete-input',
          type: 'text',
          value: query.value,
          placeholder: safeValues.value.length > 0 ? '' : props.placeholder,
          onFocus: () => {
            open.value = true
          },
          onInput: (event) => {
            query.value = event.target.value
            open.value = true
          },
          onKeydown: (event) => {
            if ((event.key === 'Enter' || event.key === ',') && String(query.value || '').trim()) {
              event.preventDefault()
              commit(exactMatch.value?.label || query.value)
            }
            if (event.key === 'Backspace' && !query.value && safeValues.value.length > 0) {
              remove(safeValues.value[safeValues.value.length - 1])
            }
          }
        })
      ]),
      h('div', { class: 'field-meta-row' }, [
        Number.isFinite(props.maxTags)
          ? h('span', { class: 'field-meta-copy' }, `${safeValues.value.length}/${props.maxTags}`)
          : null,
        h('span', { class: 'field-meta-copy' }, 'Search, select, or type a custom tag')
      ]),
      open.value
        ? h('div', { class: 'autocomplete-popover' }, [
            filteredOptions.value.length > 0
              ? h(
                  'div',
                  { class: 'autocomplete-options' },
                  filteredOptions.value.map((item) =>
                    h(
                      'button',
                      {
                        key: item.key,
                        type: 'button',
                        class: ['autocomplete-option', safeValues.value.includes(item.label) ? 'autocomplete-option-active' : ''],
                        onClick: () => toggleOption(item.label)
                      },
                      [
                        h('span', { class: 'autocomplete-option-copy' }, [
                          h('span', { class: 'autocomplete-option-label' }, item.label),
                          item.description
                            ? h('span', { class: 'autocomplete-option-description' }, item.description)
                            : null
                        ]),
                        h('span', { class: 'autocomplete-option-check' }, safeValues.value.includes(item.label) ? '✓' : '')
                      ]
                    )
                  )
                )
              : null,
            String(query.value || '').trim() && !exactMatch.value
              ? h(
                  'button',
                  {
                    type: 'button',
                    class: 'autocomplete-create-option',
                    onClick: () => commit(query.value)
                  },
                  `Add "${String(query.value).trim()}"`
                )
              : null,
            !filteredOptions.value.length && !String(query.value || '').trim()
              ? h('div', { class: 'autocomplete-empty' }, 'No options available')
              : null
          ])
        : null
    ])
  }
})
