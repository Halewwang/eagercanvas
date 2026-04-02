<template>
  <Teleport to="body">
    <div v-if="show" class="wedding-overlay" @click.self="emit('update:show', false)">
      <div class="wedding-float">
        <div class="wedding-shell">
          <div class="wedding-panel">
            <div class="wedding-scroll">
              <section class="wedding-section wedding-section-first">
                <div class="section-heading">
                  <span class="section-title">Reference</span>
                </div>

                <div class="input-preview-card">
                  <div class="input-preview-frame">
                    <img v-if="imageSource" :src="imageSource" alt="Reference" class="input-preview-image" />
                    <div v-else class="input-preview-empty">
                      <span>No image selected</span>
                    </div>
                  </div>
                </div>

                <div class="reference-controls">
                  <div class="field-grid field-grid-two">
                    <AutocompleteField v-model="form.mode" label="Mode" :options="WEDDING_3X3_MODE_OPTIONS" />

                    <div class="option-field">
                      <span class="option-label">Structure Lock</span>
                      <div class="segment-control">
                        <button
                          type="button"
                          class="segment-button"
                          :class="{ 'segment-button-active': form.lockStructure }"
                          @click="form.lockStructure = true"
                        >
                          On
                        </button>
                        <button
                          type="button"
                          class="segment-button"
                          :class="{ 'segment-button-active': !form.lockStructure }"
                          @click="form.lockStructure = false"
                        >
                          Off
                        </button>
                      </div>
                    </div>
                  </div>

                  <div class="field-grid">
                    <label class="option-field option-field-full">
                      <span class="option-label">Random Seed</span>
                      <input v-model="form.randomSeed" class="text-input" type="text" placeholder="Optional" />
                    </label>
                  </div>
                </div>
              </section>

              <div class="section-divider"></div>

              <section class="wedding-section">
                <div class="section-heading">
                  <span class="section-title">Core Variables</span>
                  <span class="section-note">Fields marked * must be selected before generation.</span>
                </div>

                <div class="field-grid field-grid-two">
                  <AutocompleteField v-model="form.style" label="Style" :options="options.style" required />
                  <AutocompleteField v-model="form.season" label="Season" :options="options.season" />
                  <AutocompleteField v-model="form.colorFamily" label="Color Family" :options="options.color_family" />
                  <AutocompleteField v-model="form.mainColor" label="Main Color" :options="options.main_color" />
                  <AutocompleteField v-model="form.moodPrimary" label="Mood" :options="options.mood_primary" />
                  <MultiAutocompleteField
                    v-model="form.moodTags"
                    label="Mood Tags"
                    :options="options.mood_tags"
                    :max-tags="WEDDING_3X3_LIMITS.mood_tags"
                    placeholder="Select mood tags"
                  />
                </div>
              </section>

              <div class="section-divider"></div>

              <section class="wedding-section">
                <div class="section-heading">
                  <span class="section-title">{{ form.mode === 'product_showcase' ? 'Product Setup' : 'Scene Setup' }}</span>
                </div>

                <template v-if="form.mode === 'product_showcase'">
                  <div class="field-grid field-grid-two">
                    <AutocompleteField v-model="form.productType" label="Product Type" :options="options.product_type" required />
                    <AutocompleteField v-model="form.greeneryCoverage" label="Greenery Coverage" :options="options.greenery_coverage" />
                    <MultiAutocompleteField
                      v-model="form.greeneryCharacter"
                      label="Greenery Character"
                      :options="options.greenery_character"
                      :max-tags="WEDDING_3X3_LIMITS.greenery_character"
                      placeholder="Select greenery tags"
                    />
                    <MultiAutocompleteField
                      v-model="form.fabricMaterial"
                      label="Fabric Material"
                      :options="options.fabric_material"
                      :max-tags="WEDDING_3X3_LIMITS.fabric_material"
                      placeholder="Select material"
                    />
                    <MultiAutocompleteField
                      v-model="form.decorMaterial"
                      label="Decor Material"
                      :options="options.decor_material"
                      :max-tags="WEDDING_3X3_LIMITS.decor_material"
                      placeholder="Select decor material"
                    />
                  </div>
                </template>

                <template v-else>
                  <div class="field-grid field-grid-two">
                    <AutocompleteField
                      v-model="form.sceneType"
                      label="Scene Type"
                      :options="options.scene_type"
                      required
                      required-hint="One of two required"
                    />
                    <AutocompleteField
                      v-model="form.relationshipMode"
                      label="Relationship"
                      :options="options.relationship_mode"
                      required
                      required-hint="One of two required"
                    />
                    <AutocompleteField v-model="form.storyAction" label="Story Action" :options="options.story_action" full required />
                    <MultiAutocompleteField
                      v-model="form.environmentFlavor"
                      label="Environment Flavor"
                      :options="options.environment_flavor"
                      :max-tags="WEDDING_3X3_LIMITS.environment_flavor"
                      placeholder="Select environment tags"
                    />
                  </div>
                </template>
              </section>

              <div class="section-divider"></div>

              <section class="wedding-section">
                <div class="section-heading">
                  <span class="section-title">Environment</span>
                </div>

                <div class="field-grid field-grid-two">
                  <AutocompleteField v-model="form.venueType" label="Venue" :options="options.venue_type" />
                  <AutocompleteField v-model="form.wallSurface" label="Wall Surface" :options="options.wall_surface" />
                  <AutocompleteField v-model="form.groundSurface" label="Ground Surface" :options="options.ground_surface" />
                  <MultiAutocompleteField
                    v-model="form.props"
                    label="Props"
                    :options="options.props"
                    :max-tags="WEDDING_3X3_LIMITS.props"
                    placeholder="Select props"
                  />
                </div>
              </section>

              <div class="section-divider"></div>

              <section class="wedding-section">
                <div class="section-heading">
                  <span class="section-title">Generation</span>
                </div>

                <div class="field-grid field-grid-two">
                  <AutocompleteField v-model="selectedModel" label="Model" :options="imageModelSelectOptions" />
                  <AutocompleteField v-model="selectedQuality" label="Quality" :options="qualityOptions" />
                  <AutocompleteField v-model="selectedRatio" label="Ratio" :options="ratioOptions" />
                  <AutocompleteField v-model="selectedResolution" label="Resolution" :options="resolutionOptions" />
                </div>
              </section>

              <div class="section-divider"></div>

              <section class="wedding-section wedding-section-last">
                <div class="section-heading section-heading-row">
                  <span class="section-title">Output JSON</span>
                  <div class="section-actions">
                    <button class="tool-secondary-btn" type="button" @click="copyJson">Copy</button>
                    <button class="tool-secondary-btn" type="button" @click="downloadJson">Download</button>
                  </div>
                </div>

                <div v-if="validationErrors.length > 0" class="validation-box">
                  <div v-for="message in validationErrors" :key="message" class="validation-item">
                    {{ message }}
                  </div>
                </div>

                <div class="preview-box preview-box-json">
                  <pre class="preview-code">{{ jsonPreview }}</pre>
                </div>

                <div class="section-heading section-heading-row preview-heading">
                  <span class="section-title">Prompt Preview</span>
                  <button class="tool-secondary-btn" type="button" @click="copyPrompt">Copy Prompt</button>
                </div>
                <div class="preview-box preview-box-prompt">
                  <pre class="preview-code preview-code-prompt">{{ promptPreview }}</pre>
                </div>
              </section>
            </div>
          </div>

          <div class="drawer-footer">
            <div class="footer-actions">
              <button class="tool-secondary-btn" type="button" @click="emit('update:show', false)">Cancel</button>
              <button
                class="tool-primary-btn"
                type="button"
                :disabled="!imageSource || applying || validationErrors.length > 0"
                @click="generateImage"
              >
                {{ applying ? 'Generating...' : 'Generate Image' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, defineComponent, h, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import {
  WEDDING_3X3_DEFAULT_MODE,
  WEDDING_3X3_MODE_OPTIONS,
  WEDDING_3X3_OPTIONS
} from '@/config/wedding3x3'
import {
  buildWedding3x3Json,
  validateWedding3x3Config
} from '@/utils/wedding3x3Builder'
import { WEDDING_3X3_LIMITS } from '@/config/wedding3x3'
import { getModelQualityOptions, getModelSizeOptions, imageModelOptions, DEFAULT_IMAGE_MODEL } from '@/stores/models'
import { createImageGenerationRun, getImageGenerationTask } from '@/api'
import { useImageGeneration } from '@/hooks/useApi'

const normalizeDropdownItems = (items = []) =>
  (items || []).map((item) =>
    typeof item === 'string'
      ? { key: item, label: item, description: '' }
      : { key: item?.key, label: item?.label ?? item?.key, description: item?.description ?? '' }
  )

const matchesOptionQuery = (item, query) => {
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

const AutocompleteField = defineComponent({
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

const MultiAutocompleteField = defineComponent({
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

const props = defineProps({
  show: Boolean,
  imageUrl: {
    type: String,
    default: ''
  },
  model: {
    type: String,
    default: DEFAULT_IMAGE_MODEL
  },
  ratio: {
    type: String,
    default: '16:9'
  },
  size: {
    type: String,
    default: '1024x1024'
  },
  resolution: {
    type: String,
    default: '1k'
  },
  quality: {
    type: String,
    default: 'standard'
  }
})

const emit = defineEmits(['update:show', 'pending', 'apply', 'error'])

const imageGen = useImageGeneration()
const imageSource = computed(() => String(props.imageUrl || '').trim())
const options = WEDDING_3X3_OPTIONS

const form = reactive({
  mode: WEDDING_3X3_DEFAULT_MODE,
  lockStructure: true,
  randomSeed: '',
  style: '',
  season: '',
  colorFamily: '',
  mainColor: '',
  moodPrimary: '',
  moodTags: [],
  productType: '',
  greeneryCoverage: '',
  greeneryCharacter: [],
  venueType: '',
  wallSurface: '',
  groundSurface: '',
  props: [],
  fabricMaterial: [],
  decorMaterial: [],
  sceneType: '',
  relationshipMode: '',
  storyAction: '',
  environmentFlavor: []
})

const selectedModel = ref(DEFAULT_IMAGE_MODEL)
const selectedQuality = ref('standard')
const selectedRatio = ref('16:9')
const selectedResolution = ref('1k')

const ratioFromSizeKey = (sizeKey = '') => {
  const [w, h] = String(sizeKey || '').split('x').map(Number)
  if (!w || !h) return '1:1'
  const ratio = w / h
  if (Math.abs(ratio - 1) < 0.02) return '1:1'
  if (Math.abs(ratio - 3 / 2) < 0.03) return '3:2'
  if (Math.abs(ratio - 2 / 3) < 0.03) return '2:3'
  if (Math.abs(ratio - 4 / 3) < 0.03) return '4:3'
  if (Math.abs(ratio - 3 / 4) < 0.03) return '3:4'
  if (Math.abs(ratio - 4 / 5) < 0.03) return '4:5'
  if (Math.abs(ratio - 5 / 4) < 0.03) return '5:4'
  if (Math.abs(ratio - 16 / 9) < 0.03) return '16:9'
  if (Math.abs(ratio - 9 / 16) < 0.03) return '9:16'
  if (Math.abs(ratio - 21 / 9) < 0.03) return '21:9'
  return '1:1'
}

const resolutionFromSizeKey = (sizeKey = '') => {
  const [w, h] = String(sizeKey || '').split('x').map(Number)
  const longest = Math.max(w || 0, h || 0)
  if (longest >= 3000) return '4k'
  if (longest >= 1700) return '2k'
  return '1k'
}

const imageModelSelectOptions = computed(() =>
  imageModelOptions.value.map((item) => ({
    key: item.key,
    label: item.label
  }))
)

const sizeOptions = computed(() => getModelSizeOptions(selectedModel.value, selectedQuality.value))

const ratioOptions = computed(() => {
  const seen = new Set()
  return sizeOptions.value
    .map((item) => ratioFromSizeKey(item.key))
    .filter((item) => {
      if (seen.has(item)) return false
      seen.add(item)
      return true
    })
    .map((item) => ({
      key: item,
      label: item
    }))
})

const resolutionOptions = computed(() => {
  const seen = new Set()
  return sizeOptions.value
    .filter((item) => ratioFromSizeKey(item.key) === selectedRatio.value)
    .map((item) => resolutionFromSizeKey(item.key))
    .filter((item) => {
      if (seen.has(item)) return false
      seen.add(item)
      return true
    })
    .map((item) => ({
      key: item,
      label: item.toUpperCase()
    }))
})

const selectedSize = computed(() => {
  const exact = sizeOptions.value.find(
    (item) => ratioFromSizeKey(item.key) === selectedRatio.value && resolutionFromSizeKey(item.key) === selectedResolution.value
  )
  if (exact?.key) return exact.key

  const sameRatio = sizeOptions.value.find((item) => ratioFromSizeKey(item.key) === selectedRatio.value)
  if (sameRatio?.key) return sameRatio.key

  return sizeOptions.value[0]?.key || props.size || '1024x1024'
})

const qualityOptions = computed(() => {
  const options = getModelQualityOptions(selectedModel.value)
  return options.length > 0 ? options : [{ key: 'standard', label: '标准' }]
})

watch(
  () => props.show,
  (visible) => {
    if (!visible) return
    selectedModel.value = props.model || DEFAULT_IMAGE_MODEL
    selectedQuality.value = props.quality || 'standard'
    selectedRatio.value = '16:9'
    selectedResolution.value = '1k'
  },
  { immediate: true }
)

watch(selectedModel, () => {
  const nextQuality = qualityOptions.value.some((item) => item.key === selectedQuality.value)
    ? selectedQuality.value
    : qualityOptions.value[0]?.key || 'standard'
  selectedQuality.value = nextQuality
  if (!ratioOptions.value.some((item) => item.key === selectedRatio.value)) {
    selectedRatio.value = ratioOptions.value.find((item) => item.key === '16:9')?.key || ratioOptions.value[0]?.key || '16:9'
  }
  if (!resolutionOptions.value.some((item) => item.key === selectedResolution.value)) {
    selectedResolution.value = resolutionOptions.value[0]?.key || resolutionFromSizeKey(selectedSize.value)
  }
})

watch(selectedRatio, () => {
  if (!resolutionOptions.value.some((item) => item.key === selectedResolution.value)) {
    selectedResolution.value = resolutionOptions.value[0]?.key || resolutionFromSizeKey(selectedSize.value)
  }
})

const serializedVariables = computed(() => ({
  style: form.style,
  season: form.season,
  color_family: form.colorFamily,
  main_color: form.mainColor,
  mood_primary: form.moodPrimary,
  mood_tags: form.moodTags,
  product_type: form.productType,
  greenery_coverage: form.greeneryCoverage,
  greenery_character: form.greeneryCharacter,
  venue_type: form.venueType,
  wall_surface: form.wallSurface,
  ground_surface: form.groundSurface,
  props: form.props,
  fabric_material: form.fabricMaterial,
  decor_material: form.decorMaterial,
  scene_type: form.sceneType,
  relationship_mode: form.relationshipMode,
  story_action: form.storyAction,
  environment_flavor: form.environmentFlavor,
  random_seed: form.randomSeed
}))

const generatedJson = computed(() =>
  buildWedding3x3Json({
    mode: form.mode,
    referenceImage: imageSource.value,
    variables: serializedVariables.value,
    generation: {
      model: selectedModel.value,
      ratio: selectedRatio.value,
      resolution: selectedResolution.value,
      quality: selectedQuality.value,
      size: selectedSize.value
    },
    lockStructure: form.lockStructure
  })
)

const validationErrors = computed(() =>
  validateWedding3x3Config({
    mode: form.mode,
    referenceImage: imageSource.value,
    variables: serializedVariables.value
  })
)

const jsonPreview = computed(() => JSON.stringify(generatedJson.value, null, 2))
const promptPreview = computed(() => generatedJson.value.output.prompt || '')
const asyncApplying = ref(false)
const applying = computed(() => imageGen.loading.value || asyncApplying.value)
const ASYNC_IMAGE_MODELS = new Set([
  'gemini-3.1-flash-image-preview',
  'gemini-3-pro-image-preview'
])

const copyText = async (value, successMessage) => {
  try {
    await navigator.clipboard.writeText(String(value || ''))
    window.$message?.success(successMessage)
  } catch {
    window.$message?.error('复制失败，请重试。')
  }
}

const copyJson = () => copyText(jsonPreview.value, 'JSON 已复制。')
const copyPrompt = () => copyText(promptPreview.value, 'Prompt 已复制。')

const downloadJson = () => {
  try {
    const blob = new Blob([jsonPreview.value], { type: 'application/json;charset=utf-8' })
    const href = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = href
    link.download = `wedding-3x3-${Date.now()}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.setTimeout(() => URL.revokeObjectURL(href), 800)
  } catch {
    window.$message?.error('JSON 下载失败。')
  }
}

const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms))

const isAsyncImageModel = (model) => ASYNC_IMAGE_MODELS.has(String(model || '').trim().toLowerCase())

const extractImageTaskId = (result = {}) => {
  const candidates = [
    result?.task_id,
    result?.taskId,
    result?.id,
    result?.data?.task_id,
    result?.data?.taskId,
    result?.data?.id,
    result?.raw?.task_id,
    result?.raw?.id,
    result?.raw?.data?.id
  ]

  const found = candidates.find((value) => value !== undefined && value !== null && String(value).trim() !== '')
  return found ? String(found).trim() : ''
}

const extractGeneratedImageUrl = (result = {}) => {
  const dataList = Array.isArray(result?.data) ? result.data : []
  const firstDataUrl = dataList.find((item) => String(item?.url || '').trim())?.url
  if (firstDataUrl) return String(firstDataUrl).trim()

  const candidates = [
    result?.url,
    result?.image_url,
    result?.imageUrl,
    result?.data?.url,
    result?.raw?.url,
    result?.raw?.image_url,
    result?.raw?.data?.url
  ]
  const found = candidates.find((value) => value !== undefined && value !== null && String(value).trim() !== '')
  return found ? String(found).trim() : ''
}

const waitForAsyncImageResult = async (taskId, attempts = 45, intervalMs = 3000) => {
  const safeTaskId = String(taskId || '').trim()
  if (!safeTaskId) {
    throw new Error('Image task id is missing')
  }

  let lastMessage = ''
  for (let index = 0; index < attempts; index += 1) {
    const result = await getImageGenerationTask(safeTaskId, { timeout: 45000 })
    const nextUrl = extractGeneratedImageUrl(result)
    if (nextUrl) {
      return result
    }

    const status = String(result?.status || '').trim().toLowerCase()
    const message = String(result?.message || '').trim()
    if (message) lastMessage = message

    if (['failed', 'error', 'cancelled', 'canceled', 'failure'].includes(status)) {
      throw new Error(message || 'Image generation failed')
    }

    if (index < attempts - 1) {
      await sleep(intervalMs)
    }
  }

  throw new Error(lastMessage || 'Image generation timed out, please try again.')
}

const generateImage = async () => {
  if (!imageSource.value || validationErrors.value.length > 0 || applying.value) return

  const output = generatedJson.value
  emit('pending', {
    targetMode: 'new',
    model: selectedModel.value,
    size: selectedSize.value,
    ratio: selectedRatio.value,
    resolution: selectedResolution.value,
    quality: selectedQuality.value,
    fileType: 'image/png',
    label: 'Wedding 3x3 Result',
    sourcePrompt: output.output.prompt,
    sourceRefImages: [imageSource.value],
    meta: {
      tool: 'wedding-3x3',
      json: output
    }
  })

  try {
    asyncApplying.value = true
    let nextUrl = ''

    if (isAsyncImageModel(selectedModel.value)) {
      const run = await createImageGenerationRun({
        model: selectedModel.value,
        prompt: output.output.prompt,
        image: imageSource.value,
        size: selectedSize.value,
        ratio: selectedRatio.value,
        aspect_ratio: selectedRatio.value,
        resolution: selectedResolution.value,
        quality: selectedQuality.value,
        enable_sync_mode: false,
        enable_base64_output: false
      })

      const runResult = run?.result || run
      nextUrl = extractGeneratedImageUrl(runResult)

      if (!nextUrl) {
        const taskId = extractImageTaskId(runResult)
        const finalResult = await waitForAsyncImageResult(taskId)
        nextUrl = extractGeneratedImageUrl(finalResult)
      }
    } else {
      const generated = await imageGen.generate({
        model: selectedModel.value,
        prompt: output.output.prompt,
        image: imageSource.value,
        size: selectedSize.value,
        ratio: selectedRatio.value,
        aspect_ratio: selectedRatio.value,
        resolution: selectedResolution.value,
        quality: selectedQuality.value,
        enable_sync_mode: true,
        enable_base64_output: false
      })
      const first = Array.isArray(generated) ? generated[0] : generated
      nextUrl = String(first?.url || '').trim()
    }

    if (!nextUrl) {
      throw new Error('No image output from model')
    }

    emit('apply', {
      targetMode: 'new',
      model: selectedModel.value,
      url: nextUrl,
      base64: '',
      fileType: 'image/png',
      size: selectedSize.value,
      ratio: selectedRatio.value,
      resolution: selectedResolution.value,
      quality: selectedQuality.value,
      label: 'Wedding 3x3 Result',
      sourcePrompt: output.output.prompt,
      sourceRefImages: [imageSource.value],
      meta: {
        tool: 'wedding-3x3',
        json: output
      }
    })
  } catch (error) {
    emit('error', {
      message: error?.message || 'Wedding 3x3 generation failed'
    })
    window.$message?.error(error?.message || 'Wedding 3x3 generation failed')
  } finally {
    asyncApplying.value = false
  }
}
</script>

<style scoped>
.wedding-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  pointer-events: none;
  background: transparent;
}

.wedding-float {
  position: absolute;
  top: 88px;
  right: 24px;
  width: min(560px, calc(100vw - 48px));
  max-height: calc(100vh - 228px);
  bottom: 140px;
  pointer-events: auto;
}

.wedding-shell {
  display: flex;
  flex-direction: column;
  gap: 0;
  max-height: 100%;
  overflow: hidden;
  padding: 14px 14px 12px;
  border-radius: 28px;
  border: 1px solid rgba(143, 143, 143, 0.14);
  background:
    radial-gradient(circle at top right, rgba(255, 255, 255, 0.04), transparent 28%),
    rgba(12, 13, 15, 0.96);
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.34);
}

.wedding-panel {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  border-radius: 22px;
  border: 1px solid rgba(143, 143, 143, 0.12);
  background: linear-gradient(180deg, rgba(17, 18, 20, 0.98) 0%, rgba(14, 15, 18, 0.98) 100%);
}

.wedding-scroll {
  max-height: calc(100vh - 320px);
  overflow: auto;
  overscroll-behavior: contain;
}

.wedding-section {
  padding: 18px 18px 20px;
}

.wedding-section-first {
  padding-top: 20px;
}

.wedding-section-last {
  padding-bottom: 18px;
}

.section-divider {
  height: 1px;
  margin: 0 18px;
  background: rgba(255, 255, 255, 0.06);
}

.section-heading {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
}

.section-heading-row {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.section-title {
  color: #e7eaef;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  line-height: 1.3;
}

.section-note {
  color: #717b88;
  font-size: 11px;
  line-height: 1.45;
}

.section-actions,
.footer-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.input-preview-card {
  margin-bottom: 30px;
}

.reference-controls {
  display: grid;
  gap: 18px;
}

.field-grid {
  display: grid;
  gap: 14px;
}

.field-grid-two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.option-field,
:deep(.option-field) {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.option-field-full,
:deep(.option-field-full) {
  grid-column: 1 / -1;
}

:deep(.dropdown-field-root) {
  display: block;
  width: 100%;
}

.option-label,
:deep(.option-label) {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px;
  color: #8993a0;
  font-size: 11px;
  line-height: 1.3;
  letter-spacing: 0.04em;
}

.option-label-text,
:deep(.option-label-text) {
  color: inherit;
}

.required-indicator,
:deep(.required-indicator) {
  color: #ff8f8f;
  font-size: 12px;
  line-height: 1;
  font-weight: 700;
}

.required-hint,
:deep(.required-hint) {
  color: #6f7884;
  font-size: 10px;
  line-height: 1.3;
  letter-spacing: 0.02em;
}

.text-input,
:deep(.field-select-trigger),
:deep(.multi-autocomplete-shell) {
  width: 100%;
  min-height: 44px;
  padding: 0 14px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: linear-gradient(180deg, rgba(11, 12, 15, 0.98) 0%, rgba(15, 17, 21, 0.98) 100%);
  color: #eceff2;
  font-size: 13px;
  outline: none;
  transition: border-color 0.18s ease, background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
}

.text-input {
  padding: 0 14px;
}

.text-input:focus,
:deep(.multi-autocomplete-shell:hover),
:deep(.multi-autocomplete-shell-open),
:deep(.field-select-trigger:hover),
:deep(.field-select-trigger:focus-visible) {
  border-color: rgba(226, 229, 235, 0.24);
  background: rgba(17, 19, 24, 0.98);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.04);
}

:deep(.autocomplete-shell) {
  position: relative;
}

:deep(.field-select-trigger) {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
  text-align: left;
}

:deep(.field-select-text) {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

:deep(.field-select-value) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.field-select-description) {
  color: #7f8894;
  font-size: 11px;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:deep(.field-select-placeholder .field-select-value) {
  color: #7f8894;
}

:deep(.field-select-caret) {
  flex: 0 0 auto;
  color: #7f8894;
  font-size: 16px;
  line-height: 1;
  transition: transform 0.18s ease;
}

:deep(.field-select-caret-open) {
  transform: rotate(180deg);
}

:deep(.autocomplete-popover) {
  margin-top: 8px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(14, 16, 19, 0.98);
  box-shadow: 0 18px 36px rgba(0, 0, 0, 0.32);
  overflow: hidden;
}

:deep(.autocomplete-search-row) {
  padding: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

:deep(.autocomplete-search-input),
:deep(.multi-autocomplete-input) {
  width: 100%;
  min-width: 80px;
  border: 0;
  background: transparent;
  color: #eef2f6;
  font-size: 13px;
  line-height: 1.4;
  outline: none;
}

:deep(.autocomplete-search-input::placeholder),
:deep(.multi-autocomplete-input::placeholder) {
  color: #77818d;
}

:deep(.autocomplete-options) {
  display: grid;
  gap: 4px;
  max-height: 240px;
  overflow: auto;
  padding: 8px;
}

:deep(.autocomplete-option),
:deep(.autocomplete-create-option) {
  width: 100%;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: #edf1f6;
  text-align: left;
  cursor: pointer;
  transition: background 0.18s ease, color 0.18s ease;
}

:deep(.autocomplete-option) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 11px 12px;
}

:deep(.autocomplete-option:hover),
:deep(.autocomplete-option-active),
:deep(.autocomplete-create-option:hover) {
  background: rgba(255, 255, 255, 0.06);
}

:deep(.autocomplete-option-copy) {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

:deep(.autocomplete-option-label) {
  font-size: 13px;
  line-height: 1.35;
}

:deep(.autocomplete-option-description) {
  color: #7f8894;
  font-size: 11px;
  line-height: 1.35;
}

:deep(.autocomplete-option-check) {
  flex: 0 0 auto;
  color: #f2f4f7;
  font-size: 13px;
}

:deep(.autocomplete-create-option) {
  display: block;
  margin: 0 8px 8px;
  padding: 11px 12px;
  color: #cfd6df;
}

:deep(.autocomplete-empty) {
  padding: 14px 12px 16px;
  color: #77818d;
  font-size: 12px;
  text-align: center;
}

:deep(.multi-autocomplete-shell) {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 12px;
  cursor: text;
}

:deep(.multi-autocomplete-input) {
  flex: 1 1 120px;
}

:deep(.field-meta-row) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

:deep(.field-meta-copy) {
  color: #77818d;
  font-size: 11px;
  line-height: 1.35;
}

.segment-control {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  padding: 4px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(9, 10, 13, 0.96);
}

.segment-button {
  min-height: 34px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: #929ca8;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.18s ease, color 0.18s ease;
}

.segment-button-active {
  background: rgba(255, 255, 255, 0.08);
  color: #f3f5f8;
}

.input-preview-frame {
  position: relative;
  overflow: hidden;
  min-height: 210px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: #0b0c10;
}

.input-preview-image {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 210px;
  object-fit: cover;
}

.input-preview-empty {
  min-height: 210px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #7c8591;
  font-size: 12px;
}

:deep(.tag-pill) {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  max-width: 100%;
  padding: 7px 10px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(24, 27, 33, 0.95);
  color: #eff3f8;
  font-size: 12px;
}

:deep(.tag-pill-label) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.tag-pill-remove) {
  border: 0;
  background: transparent;
  color: #9da6b2;
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
}

.preview-heading {
  margin-top: 16px;
}

.preview-box {
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(9, 10, 13, 0.96);
  overflow: auto;
}

.preview-box-json {
  max-height: 132px;
}

.preview-box-prompt {
  max-height: 220px;
}

.preview-code {
  margin: 0;
  padding: 12px 14px;
  color: #d6dce6;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.preview-code-prompt {
  font-family: inherit;
}

.validation-box {
  display: grid;
  gap: 8px;
  margin-bottom: 12px;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid rgba(255, 110, 110, 0.2);
  background: rgba(95, 17, 17, 0.18);
}

.validation-item {
  color: #ffb7b7;
  font-size: 11px;
  line-height: 1.5;
}

.drawer-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 14px;
}

.tool-secondary-btn,
.tool-primary-btn {
  min-width: 96px;
  min-height: 40px;
  padding: 0 16px;
  border-radius: 999px;
  font-size: 13px;
  cursor: pointer;
  transition: opacity 0.18s ease, transform 0.18s ease, border-color 0.18s ease;
}

.tool-secondary-btn {
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: transparent;
  color: #d6dce6;
}

.tool-primary-btn {
  border: 1px solid rgba(226, 229, 235, 0.18);
  background: #f0f2f5;
  color: #090b0d;
  font-weight: 600;
}

.tool-primary-btn:disabled,
.tool-secondary-btn:disabled {
  opacity: 0.48;
  cursor: not-allowed;
}

@media (max-width: 900px) {
  .wedding-float {
    top: 72px;
    right: 16px;
    left: 16px;
    width: auto;
    bottom: 128px;
    max-height: calc(100vh - 212px);
  }

  .field-grid-two {
    grid-template-columns: 1fr;
  }
}
</style>
