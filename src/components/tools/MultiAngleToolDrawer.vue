<template>
  <Teleport to="body">
    <div v-if="show" class="multi-angle-overlay" @click.self="emit('update:show', false)">
      <div class="multi-angle-float">
        <div class="multi-angle-shell">
          <div class="multi-angle-panel">
            <div class="multi-angle-panel-scroll">
        <section class="multi-angle-section multi-angle-section-first">
          <div class="section-heading">
            <span class="section-title">Input Image</span>
          </div>

          <div class="input-preview-card">
            <div class="input-preview-frame">
              <img v-if="imageSource" :src="imageSource" alt="Input" class="input-preview-image" />
              <div v-else class="input-preview-empty">
                <span>No image selected</span>
              </div>
            </div>
          </div>

          <div class="input-options-grid">
            <label class="option-field">
              <span class="option-label">Ratio</span>
              <select v-model="selectedRatio" class="option-select">
                <option v-for="option in normalizedRatioOptions" :key="option.key" :value="option.key">
                  {{ option.label }}
                </option>
              </select>
            </label>

            <label class="option-field">
              <span class="option-label">Size</span>
              <select v-model="selectedResolution" class="option-select">
                <option v-for="option in filteredResolutionOptions" :key="option.key" :value="option.key">
                  {{ option.label }}
                </option>
              </select>
            </label>
          </div>
        </section>

        <div class="section-divider"></div>

        <section class="multi-angle-section">
          <div class="section-heading">
            <span class="section-title">Camera Control</span>
          </div>

          <div ref="controlAreaRef" class="camera-control-card">
            <svg viewBox="0 0 420 320" class="camera-control-svg">
              <rect x="0" y="0" width="420" height="320" rx="24" fill="#0b0c10" />
              <g opacity="0.38">
                <path v-for="line in gridLines" :key="line" :d="line" stroke="rgba(255,255,255,0.04)" stroke-width="1" />
              </g>

              <ellipse cx="210" cy="238" rx="118" ry="42" fill="rgba(255,255,255,0.01)" />
              <ellipse cx="210" cy="238" rx="118" ry="42" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="4" />
              <ellipse cx="210" cy="238" rx="46" ry="16" fill="none" stroke="rgba(255,255,255,0.16)" stroke-width="2" />

              <path :d="elevationArcPath" fill="none" stroke="rgba(255,255,255,0.56)" stroke-width="4" stroke-linecap="round" />
              <line x1="210" y1="238" x2="210" y2="74" stroke="rgba(255,255,255,0.36)" stroke-width="4" stroke-linecap="round" />

              <g class="camera-preview-plane" :style="previewPlaneStyle">
                <foreignObject x="156" y="170" width="108" height="76">
                  <div xmlns="http://www.w3.org/1999/xhtml" class="camera-preview-card">
                    <img v-if="imageSource" :src="imageSource" alt="Preview" class="camera-preview-image" />
                    <div v-else class="camera-preview-placeholder">Preview</div>
                  </div>
                </foreignObject>
              </g>

              <circle
                :cx="azimuthHandle.x"
                :cy="azimuthHandle.y"
                r="11"
                fill="#e7e8eb"
                stroke="rgba(10,11,15,0.92)"
                stroke-width="3"
                class="drag-handle"
                @mousedown.prevent="startDrag('azimuth', $event)"
              />
              <circle
                :cx="elevationHandle.x"
                :cy="elevationHandle.y"
                r="11"
                fill="#bfc4cc"
                stroke="rgba(10,11,15,0.92)"
                stroke-width="3"
                class="drag-handle"
                @mousedown.prevent="startDrag('elevation', $event)"
              />
              <circle
                :cx="zoomHandle.x"
                :cy="zoomHandle.y"
                r="11"
                fill="#8f96a1"
                stroke="rgba(10,11,15,0.92)"
                stroke-width="3"
                class="drag-handle"
                @mousedown.prevent="startDrag('zoom', $event)"
              />
            </svg>
          </div>

          <div class="camera-meta-row">
            <div class="camera-meta-pill"><span class="camera-meta-label">Azimuth</span><span class="camera-meta-value">{{ displayAzimuth }}</span></div>
            <div class="camera-meta-pill"><span class="camera-meta-label">Elevation</span><span class="camera-meta-value">{{ displayElevation }}</span></div>
            <div class="camera-meta-pill"><span class="camera-meta-label">Distance</span><span class="camera-meta-value">{{ displayZoom }}</span></div>
          </div>

          <div class="preset-row">
            <button
              v-for="preset in presets"
              :key="preset.key"
              class="preset-chip"
              :class="{ 'preset-chip-active': activePreset === preset.key }"
              type="button"
              @click="applyPreset(preset)"
            >
              {{ preset.label }}
            </button>
          </div>
        </section>

        <div class="section-divider"></div>

        <section class="multi-angle-section multi-angle-section-last">
          <div class="section-heading">
            <span class="section-title">Manual Controls</span>
          </div>

          <div class="manual-panel">
            <div class="manual-control">
              <div class="manual-row">
                <div>
                  <div class="manual-label">Azimuth (Horizontal)</div>
                  <div class="manual-help">0° Front · 90° Left · 180° Back</div>
                </div>
                <div class="manual-value">{{ displayAzimuth }}</div>
              </div>
              <input v-model="azimuth" class="manual-slider slider-azimuth" type="range" min="0" max="360" step="1" />
              <div class="manual-scale">
                <span>0°</span>
                <span>90°</span>
                <span>180°</span>
                <span>270°</span>
                <span>360°</span>
              </div>
            </div>

            <div class="manual-control">
              <div class="manual-row">
                <div>
                  <div class="manual-label">Elevation (Vertical Angle)</div>
                  <div class="manual-help">-30° Low · 0° Eye · 90° Bird</div>
                </div>
                <div class="manual-value">{{ displayElevation }}</div>
              </div>
              <input v-model="elevation" class="manual-slider slider-elevation" type="range" min="-30" max="90" step="1" />
              <div class="manual-scale">
                <span>-30°</span>
                <span>0°</span>
                <span>45°</span>
                <span>90°</span>
              </div>
            </div>

            <div class="manual-control">
              <div class="manual-row">
                <div>
                  <div class="manual-label">Zoom (Distance)</div>
                  <div class="manual-help">0 Wide · 5 Medium · 10 Close</div>
                </div>
                <div class="manual-value">{{ displayZoom }}</div>
              </div>
              <input v-model="zoom" class="manual-slider slider-zoom" type="range" min="0" max="10" step="0.1" />
              <div class="manual-scale">
                <span>0</span>
                <span>5</span>
                <span>10</span>
              </div>
            </div>
          </div>
        </section>
            </div>
        </div>
        <div class="drawer-footer">
          <div class="footer-actions">
            <button class="tool-secondary-btn" type="button" @click="emit('update:show', false)">Cancel</button>
            <button class="tool-primary-btn" type="button" :disabled="!imageSource || applying" @click="applyTransform">
              {{ applying ? 'Generating...' : 'Generate' }}
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { Teleport, computed, onUnmounted, ref, watch } from 'vue'
import { useImageGeneration } from '@/hooks/api/useImageApi.js'
import {
  createMultiAngleApplyPayload,
  createMultiAngleGenerationContext,
  createMultiAnglePendingPayload,
  runMultiAngleGeneration
} from '@/utils/multiAngleGenerationRunner.js'
import {
  getMultiAngleFilteredSizeOptions,
  getMultiAngleResolutionOptions,
  normalizeMultiAngleOptionList,
  ratioFromMultiAngleSize,
  resolutionFromMultiAngleSize
} from '@/utils/multiAngleSizeOptions.js'

const props = defineProps({
  show: Boolean,
  imageUrl: {
    type: String,
    default: ''
  },
  model: {
    type: String,
    default: 'gemini-3.1-flash-image-preview'
  },
  ratio: {
    type: String,
    default: '1:1'
  },
  size: {
    type: String,
    default: '1024x1024'
  },
  resolution: {
    type: String,
    default: '1k'
  },
  ratioOptions: {
    type: Array,
    default: () => []
  },
  sizeOptions: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:show', 'pending', 'apply', 'error'])

const imageGen = useImageGeneration()
const defaultImage = ref('')
const imageSource = ref('')
const applying = ref(false)
const activePreset = ref('front')
const controlAreaRef = ref(null)
const dragState = ref(null)
const selectedRatio = ref('1:1')
const selectedSize = ref('1024x1024')
const selectedResolution = ref('1k')

const azimuth = ref(0)
const elevation = ref(25)
const zoom = ref(4.2)

const presets = [
  { key: 'front', label: 'Front', azimuth: 0, elevation: 10, zoom: 4.2 },
  { key: 'left-three-quarter', label: 'Left 3/4', azimuth: 45, elevation: 12, zoom: 4.8 },
  { key: 'side', label: 'Side', azimuth: 90, elevation: 6, zoom: 5.2 },
  { key: 'back', label: 'Back', azimuth: 180, elevation: 10, zoom: 4.6 },
  { key: 'top', label: 'Top', azimuth: 0, elevation: 78, zoom: 3.4 }
]

const gridLines = [
  'M70 280 L210 196 L350 280',
  'M86 268 L210 194 L334 268',
  'M102 256 L210 191 L318 256',
  'M118 244 L210 188 L302 244',
  'M134 232 L210 185 L286 232',
  'M150 220 L210 182 L270 220',
  'M166 208 L210 179 L254 208',
  'M182 196 L210 176 L238 196',
  'M210 172 L210 286',
  'M170 192 L126 286',
  'M250 192 L294 286',
  'M130 214 L78 286',
  'M290 214 L342 286'
]

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const normalize360 = (value) => {
  const remainder = value % 360
  return remainder < 0 ? remainder + 360 : remainder
}

const displayAzimuth = computed(() => `${Math.round(Number(azimuth.value) || 0)}°`)
const displayElevation = computed(() => `${Math.round(Number(elevation.value) || 0)}°`)
const displayZoom = computed(() => Number(zoom.value || 0).toFixed(1))
const normalizedRatioOptions = computed(() => {
  const options = normalizeMultiAngleOptionList(props.ratioOptions)
  return options.length ? options : [{ key: selectedRatio.value || '1:1', label: selectedRatio.value || '1:1' }]
})
const normalizedSizeOptions = computed(() => {
  const options = normalizeMultiAngleOptionList(props.sizeOptions)
  return options.length ? options : [{ key: selectedSize.value || '1024x1024', label: selectedSize.value || '1024x1024' }]
})
const filteredSizeOptions = computed(() => getMultiAngleFilteredSizeOptions(normalizedSizeOptions.value, selectedRatio.value))
const filteredResolutionOptions = computed(() => getMultiAngleResolutionOptions(normalizedSizeOptions.value, selectedRatio.value))

const azimuthRadians = computed(() => (normalize360(Number(azimuth.value) || 0) - 90) * Math.PI / 180)
const azimuthHandle = computed(() => ({
  x: 210 + Math.cos(azimuthRadians.value) * 118,
  y: 238 + Math.sin(azimuthRadians.value) * 42
}))

const elevationProgress = computed(() => (Number(elevation.value) + 30) / 120)
const elevationHandle = computed(() => {
  const angle = Math.PI * (1.06 + elevationProgress.value * 0.92)
  return {
    x: 210 + Math.cos(angle) * 88,
    y: 238 + Math.sin(angle) * 120
  }
})

const zoomProgress = computed(() => 1 - (Number(zoom.value) / 10))
const zoomHandle = computed(() => ({
  x: 210,
  y: 74 + zoomProgress.value * 164
}))

const elevationArcPath = computed(() => {
  const start = { x: 210 + Math.cos(Math.PI * 1.06) * 88, y: 238 + Math.sin(Math.PI * 1.06) * 120 }
  const end = { x: 210 + Math.cos(Math.PI * 1.98) * 88, y: 238 + Math.sin(Math.PI * 1.98) * 120 }
  return `M ${start.x} ${start.y} A 88 120 0 0 1 ${end.x} ${end.y}`
})

const previewPlaneStyle = computed(() => {
  const rotateY = (Number(azimuth.value) || 0) * 0.72
  const rotateX = (Number(elevation.value) - 12) * -0.34
  const scale = 1 + (Number(zoom.value) - 4) * 0.06
  return {
    transform: `perspective(880px) rotateY(${rotateY}deg) rotateX(${rotateX}deg) scale(${scale})`,
    transformOrigin: 'center center'
  }
})

watch(
  () => props.imageUrl,
  (value) => {
    defaultImage.value = String(value || '').trim()
    if (!imageSource.value || imageSource.value === defaultImage.value) {
      imageSource.value = defaultImage.value
    }
  },
  { immediate: true }
)

watch(
  () => [props.ratio, props.size, props.show],
  () => {
    selectedRatio.value = String(props.ratio || ratioFromMultiAngleSize(props.size) || '1:1')
    selectedSize.value = String(props.size || '1024x1024')
    selectedResolution.value = String(props.resolution || resolutionFromMultiAngleSize(selectedSize.value) || '1k')
  },
  { immediate: true }
)

watch(selectedRatio, (ratio) => {
  if (ratioFromMultiAngleSize(selectedSize.value) === ratio) return
  const next = filteredSizeOptions.value[0]
  if (next?.key) {
    selectedSize.value = next.key
    selectedResolution.value = resolutionFromMultiAngleSize(next.key)
  }
})

watch(selectedResolution, (resolution) => {
  const next = filteredSizeOptions.value.find((item) => resolutionFromMultiAngleSize(item.key) === resolution) || filteredSizeOptions.value[0]
  if (next?.key) selectedSize.value = next.key
})

watch(
  () => props.show,
  (visible) => {
    if (!visible) return
    if (!imageSource.value) {
      imageSource.value = defaultImage.value
    }
    if (!selectedSize.value) selectedSize.value = props.size || '1024x1024'
    if (!selectedRatio.value) selectedRatio.value = props.ratio || ratioFromMultiAngleSize(selectedSize.value)
    if (!selectedResolution.value) selectedResolution.value = props.resolution || resolutionFromMultiAngleSize(selectedSize.value)
  }
)

const applyPreset = (preset) => {
  activePreset.value = preset.key
  azimuth.value = preset.azimuth
  elevation.value = preset.elevation
  zoom.value = preset.zoom
}

const resetControls = () => {
  applyPreset(presets[0])
}

const applyTransform = async () => {
  if (!imageSource.value || applying.value) return
  applying.value = true

  try {
    const context = createMultiAngleGenerationContext({
      azimuth: azimuth.value,
      elevation: elevation.value,
      model: props.model,
      zoom: zoom.value
    })
    const generationPayload = {
      context,
      size: selectedSize.value,
      ratio: selectedRatio.value,
      resolution: selectedResolution.value || resolutionFromMultiAngleSize(selectedSize.value)
    }
    emit('pending', createMultiAnglePendingPayload(generationPayload))

    const nextUrl = await runMultiAngleGeneration({
      ...generationPayload,
      imageGen,
      imageSource: imageSource.value,
      model: props.model,
    })

    emit('apply', createMultiAngleApplyPayload({
      ...generationPayload,
      url: nextUrl,
    }))
  } catch (error) {
    emit('error', {
      message: error?.message || 'Multi-angle generation failed'
    })
    window.$message?.error(error?.message || 'Multi-angle generation failed')
  } finally {
    applying.value = false
  }
}

const getRelativePoint = (event) => {
  const host = controlAreaRef.value
  if (!host) return { x: 0, y: 0 }
  const rect = host.getBoundingClientRect()
  const x = ((event.clientX - rect.left) / rect.width) * 420
  const y = ((event.clientY - rect.top) / rect.height) * 320
  return { x, y }
}

const updateFromPointer = (type, event) => {
  const point = getRelativePoint(event)
  if (type === 'azimuth') {
    const angle = Math.atan2((point.y - 238) / 42, (point.x - 210) / 118)
    azimuth.value = Math.round(normalize360(angle * 180 / Math.PI + 90))
    activePreset.value = ''
    return
  }

  if (type === 'elevation') {
    const dy = clamp(point.y, 92, 238)
    const progress = 1 - ((dy - 92) / (238 - 92))
    elevation.value = Math.round(clamp(-30 + progress * 120, -30, 90))
    activePreset.value = ''
    return
  }

  if (type === 'zoom') {
    const progress = clamp((point.y - 74) / 164, 0, 1)
    zoom.value = Number((10 - progress * 10).toFixed(1))
    activePreset.value = ''
  }
}

const onWindowMove = (event) => {
  if (!dragState.value) return
  updateFromPointer(dragState.value, event)
}

const stopDrag = () => {
  dragState.value = null
  window.removeEventListener('mousemove', onWindowMove)
  window.removeEventListener('mouseup', stopDrag)
}

const startDrag = (type, event) => {
  dragState.value = type
  updateFromPointer(type, event)
  window.addEventListener('mousemove', onWindowMove)
  window.addEventListener('mouseup', stopDrag)
}

onUnmounted(() => {
  window.removeEventListener('mousemove', onWindowMove)
  window.removeEventListener('mouseup', stopDrag)
})
</script>

<style scoped src="./MultiAngleToolDrawer.css"></style>
