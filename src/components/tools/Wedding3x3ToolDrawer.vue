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
import { computed, reactive, ref, watch } from 'vue'
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
import { useImageGeneration } from '@/hooks/api/useImageApi.js'
import { AutocompleteField, MultiAutocompleteField } from './ToolAutocompleteFields.js'
import {
  copyWedding3x3PreviewText,
  downloadWedding3x3JsonPreview
} from './Wedding3x3PreviewActions.js'
import {
  createWedding3x3ApplyPayload,
  createWedding3x3PendingPayload,
  runWedding3x3Generation
} from './Wedding3x3GenerationRunner.js'
import {
  getWedding3x3RatioOptions,
  getWedding3x3ResolutionOptions,
  resolutionFromSizeKey,
  resolveWedding3x3SelectedSize
} from './Wedding3x3GenerationOptions.js'

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

const imageModelSelectOptions = computed(() =>
  imageModelOptions.value.map((item) => ({
    key: item.key,
    label: item.label
  }))
)

const sizeOptions = computed(() => getModelSizeOptions(selectedModel.value, selectedQuality.value))

const ratioOptions = computed(() => getWedding3x3RatioOptions(sizeOptions.value))

const resolutionOptions = computed(() => getWedding3x3ResolutionOptions(sizeOptions.value, selectedRatio.value))

const selectedSize = computed(() =>
  resolveWedding3x3SelectedSize(sizeOptions.value, selectedRatio.value, selectedResolution.value, props.size)
)

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

const copyJson = () => copyWedding3x3PreviewText(jsonPreview.value, 'JSON 已复制。')
const copyPrompt = () => copyWedding3x3PreviewText(promptPreview.value, 'Prompt 已复制。')
const downloadJson = () => downloadWedding3x3JsonPreview(jsonPreview.value)

const generateImage = async () => {
  if (!imageSource.value || validationErrors.value.length > 0 || applying.value) return

  const output = generatedJson.value
  const generationPayload = {
    output,
    imageSource: imageSource.value,
    model: selectedModel.value,
    size: selectedSize.value,
    ratio: selectedRatio.value,
    resolution: selectedResolution.value,
    quality: selectedQuality.value
  }
  emit('pending', createWedding3x3PendingPayload(generationPayload))

  try {
    asyncApplying.value = true
    const nextUrl = await runWedding3x3Generation({
      ...generationPayload,
      imageGen
    })

    emit('apply', createWedding3x3ApplyPayload({
      ...generationPayload,
      url: nextUrl
    }))
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

<style scoped src="./Wedding3x3ToolDrawer.css"></style>
