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
            <span class="section-title">3D Camera Control</span>
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
import { useImageGeneration } from '@/hooks/useApi'
import {
  buildMultiAngleCameraInput,
  buildMultiAngleCameraPrompt
} from '@/utils/multiAngleCamera'

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

const resolutionFromSizeString = (sizeKey = '') => {
  const [w, h] = String(sizeKey || '').split('x').map(Number)
  const longest = Math.max(w || 0, h || 0)
  if (longest >= 3000) return '4k'
  if (longest >= 1700) return '2k'
  return '1k'
}

const normalizeOptionList = (list = []) => list.map((item) => {
  if (typeof item === 'string') {
    return { key: item, label: item }
  }
  return {
    key: item?.key ?? item?.value ?? item?.label,
    label: item?.label ?? item?.key ?? item?.value
  }
}).filter((item) => item.key)

const displayAzimuth = computed(() => `${Math.round(Number(azimuth.value) || 0)}°`)
const displayElevation = computed(() => `${Math.round(Number(elevation.value) || 0)}°`)
const displayZoom = computed(() => Number(zoom.value || 0).toFixed(1))
const normalizedRatioOptions = computed(() => {
  const options = normalizeOptionList(props.ratioOptions)
  return options.length ? options : [{ key: selectedRatio.value || '1:1', label: selectedRatio.value || '1:1' }]
})
const normalizedSizeOptions = computed(() => {
  const options = normalizeOptionList(props.sizeOptions)
  return options.length ? options : [{ key: selectedSize.value || '1024x1024', label: selectedSize.value || '1024x1024' }]
})
const filteredSizeOptions = computed(() => {
  const matched = normalizedSizeOptions.value.filter((item) => ratioFromSizeKey(item.key) === selectedRatio.value)
  return matched.length ? matched : normalizedSizeOptions.value
})
const filteredResolutionOptions = computed(() => {
  const seen = new Set()
  return filteredSizeOptions.value
    .map((item) => ({
      key: resolutionFromSizeString(item.key),
      label: resolutionFromSizeString(item.key).toUpperCase(),
      sizeKey: item.key
    }))
    .filter((item) => {
      if (!item.key || seen.has(item.key)) return false
      seen.add(item.key)
      return true
    })
})

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
    selectedRatio.value = String(props.ratio || ratioFromSizeKey(props.size) || '1:1')
    selectedSize.value = String(props.size || '1024x1024')
    selectedResolution.value = String(props.resolution || resolutionFromSizeString(selectedSize.value) || '1k')
  },
  { immediate: true }
)

watch(selectedRatio, (ratio) => {
  if (ratioFromSizeKey(selectedSize.value) === ratio) return
  const next = filteredSizeOptions.value[0]
  if (next?.key) {
    selectedSize.value = next.key
    selectedResolution.value = resolutionFromSizeString(next.key)
  }
})

watch(selectedResolution, (resolution) => {
  const next = filteredSizeOptions.value.find((item) => resolutionFromSizeString(item.key) === resolution) || filteredSizeOptions.value[0]
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
    if (!selectedRatio.value) selectedRatio.value = props.ratio || ratioFromSizeKey(selectedSize.value)
    if (!selectedResolution.value) selectedResolution.value = props.resolution || resolutionFromSizeString(selectedSize.value)
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

const computeRatioLabel = (width, height) => {
  const gcd = (a, b) => (b ? gcd(b, a % b) : a)
  if (!width || !height) return '1:1'
  const divisor = gcd(width, height)
  return `${Math.round(width / divisor)}:${Math.round(height / divisor)}`
}

const buildCameraInput = () => {
  return buildMultiAngleCameraInput({
    azimuth: azimuth.value,
    elevation: elevation.value,
    zoom: zoom.value
  })
}

const applyTransform = async () => {
  if (!imageSource.value || applying.value) return
  applying.value = true

  try {
    const cameraInput = buildCameraInput()
    const prompt = buildMultiAngleCameraPrompt(cameraInput)
    emit('pending', {
      targetMode: 'new',
      size: selectedSize.value,
      ratio: selectedRatio.value,
      resolution: selectedResolution.value || resolutionFromSizeString(selectedSize.value),
      fileType: 'image/png',
      meta: {
        tool: 'multi-angle',
        azimuth: Math.round(Number(azimuth.value) || 0),
        elevation: Math.round(Number(elevation.value) || 0),
        zoom: Number(Number(zoom.value || 0).toFixed(1)),
        camera: cameraInput,
        prompt,
        model: props.model
      }
    })
    const generated = await imageGen.generate({
      tool: 'multi-angle',
      model: props.model,
      prompt,
      image: imageSource.value,
      ...cameraInput,
      size: selectedSize.value,
      ratio: selectedRatio.value,
      resolution: selectedResolution.value || resolutionFromSizeString(selectedSize.value),
      enable_sync_mode: true,
      enable_base64_output: false
    })
    const first = Array.isArray(generated) ? generated[0] : generated
    const nextUrl = String(first?.url || '').trim()
    if (!nextUrl) {
      throw new Error('No image output from model')
    }
    const [width, height] = String(selectedSize.value || '1024x1024').split('x').map(Number)

    emit('apply', {
      targetMode: 'new',
      url: nextUrl,
      base64: '',
      fileType: 'image/png',
      size: selectedSize.value,
      ratio: selectedRatio.value || computeRatioLabel(width, height),
      resolution: selectedResolution.value || resolutionFromSizeString(selectedSize.value),
      meta: {
        tool: 'multi-angle',
        azimuth: Math.round(Number(azimuth.value) || 0),
        elevation: Math.round(Number(elevation.value) || 0),
        zoom: Number(Number(zoom.value || 0).toFixed(1)),
        camera: cameraInput,
        prompt,
        model: props.model
      }
    })
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

<style scoped>
.multi-angle-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  pointer-events: none;
  background: transparent;
}

.multi-angle-float {
  position: absolute;
  top: 88px;
  right: 24px;
  width: min(468px, calc(100vw - 48px));
  max-height: calc(100vh - 112px);
  pointer-events: auto;
}

.multi-angle-shell {
  display: flex;
  flex-direction: column;
  gap: 0;
  max-height: 100%;
  overflow: hidden;
  padding: 16px 16px 14px;
  border-radius: 24px;
  border: 1px solid rgba(143, 143, 143, 0.14);
  background: rgba(12, 13, 15, 0.96);
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.34);
}

.multi-angle-panel {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  border-radius: 20px;
  border: 1px solid rgba(143, 143, 143, 0.12);
  background: #111214;
}

.multi-angle-panel-scroll {
  max-height: calc(100vh - 226px);
  overflow: auto;
  overscroll-behavior: contain;
}

.multi-angle-section {
  padding: 16px 16px 18px;
  background: transparent;
}

.multi-angle-section-first {
  padding-top: 18px;
}

.multi-angle-section-last {
  padding-bottom: 16px;
}

.section-divider {
  height: 1px;
  margin: 0 16px;
  background: rgba(255, 255, 255, 0.08);
}

.section-heading {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 14px;
}

.section-title {
  color: #e7eaef;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  line-height: 1.3;
}

.input-preview-card {
  display: block;
}

.input-options-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 12px;
}

.option-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.option-label {
  color: #88919b;
  font-size: 10px;
  line-height: 1.3;
  letter-spacing: 0.03em;
}

.option-select {
  width: 100%;
  height: 34px;
  padding: 0 12px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: #0b0c10;
  color: #eceff2;
  font-size: 11px;
  outline: none;
}

.option-select:focus {
  border-color: rgba(255, 255, 255, 0.2);
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

.drawer-footer,
.footer-actions,
.camera-meta-row,
.manual-row,
.preset-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.camera-control-card {
  overflow: hidden;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: linear-gradient(180deg, #0d0e11 0%, #090a0d 100%);
}

.camera-control-svg {
  width: 100%;
  display: block;
}

.camera-meta-row {
  margin-top: 14px;
  flex-wrap: nowrap;
  gap: 12px;
  justify-content: space-between;
}

.camera-meta-pill {
  flex: 1 1 0;
  min-width: 0;
  padding: 10px 12px 11px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: transparent;
}

.camera-meta-label {
  display: block;
  color: #858d97;
  font-size: 10px;
  line-height: 1.35;
  margin-bottom: 7px;
  letter-spacing: 0.03em;
}

.camera-meta-value {
  color: #eceff2;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.25;
}

.camera-preview-card {
  width: 108px;
  height: 76px;
  overflow: hidden;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.06);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.34);
}

.camera-preview-image,
.camera-preview-placeholder {
  width: 100%;
  height: 100%;
}

.camera-preview-image {
  object-fit: cover;
}

.camera-preview-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #88919b;
  font-size: 11px;
}

.camera-preview-plane {
  transform-box: fill-box;
  transform-origin: center center;
}

.drag-handle {
  cursor: grab;
  transition: filter 0.18s ease;
}

.drag-handle:hover {
  filter: brightness(1.06);
}

.manual-panel {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.manual-control {
  display: flex;
  flex-direction: column;
  gap: 11px;
}

.manual-row {
  justify-content: space-between;
  align-items: flex-start;
}

.manual-label {
  color: #e8ebef;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.35;
  letter-spacing: 0.01em;
}

.manual-help {
  color: #7f8791;
  font-size: 10px;
  margin-top: 4px;
  line-height: 1.45;
  letter-spacing: 0.01em;
}

.manual-value {
  min-width: 56px;
  height: 30px;
  padding: 0 10px;
  border-radius: 11px;
  background: #0b0c10;
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #eceff2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
}

.manual-slider {
  width: 100%;
  appearance: none;
  height: 3px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  outline: none;
}

.manual-slider::-webkit-slider-thumb {
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 999px;
  border: 0;
  cursor: pointer;
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.05);
}

.slider-azimuth::-webkit-slider-thumb {
  background: #e7e8eb;
}

.slider-elevation::-webkit-slider-thumb {
  background: #c3c8cf;
}

.slider-zoom::-webkit-slider-thumb {
  background: #9299a3;
}

.manual-scale {
  display: flex;
  justify-content: space-between;
  color: #66707c;
  font-size: 10px;
  line-height: 1.4;
}

.preset-row {
  flex-wrap: nowrap;
  gap: 12px;
  margin-top: 14px;
  justify-content: space-between;
}

.preset-chip,
.tool-secondary-btn,
.tool-primary-btn {
  border-radius: 999px;
  transition: border-color 0.18s ease, background 0.18s ease, transform 0.18s ease, opacity 0.18s ease;
}

.preset-chip,
.tool-secondary-btn {
  height: 32px;
  padding: 0 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: #1a1d20;
  color: #dbe0e6;
  font-size: 11px;
  line-height: 1;
}

.preset-chip-active,
.tool-secondary-btn:hover,
.preset-chip:hover {
  border-color: rgba(255, 255, 255, 0.22);
  background: rgba(255, 255, 255, 0.08);
}

.tool-primary-btn {
  height: 38px;
  padding: 0 18px;
  border: 1px solid rgba(236, 239, 242, 0.92);
  background: linear-gradient(180deg, #eceff2 0%, #d7dde5 100%);
  color: #08090d;
  font-size: 13px;
  font-weight: 700;
}

.tool-primary-btn:hover:not(:disabled) {
  transform: translateY(-1px);
}

.tool-primary-btn:disabled,
.tool-secondary-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.drawer-footer {
  position: sticky;
  bottom: 0;
  z-index: 2;
  justify-content: flex-end;
  padding-top: 14px;
  margin-top: 14px;
  background: linear-gradient(180deg, rgba(12, 13, 15, 0) 0%, rgba(12, 13, 15, 0.92) 22%, rgba(12, 13, 15, 0.96) 100%);
}

.footer-actions {
  justify-content: flex-end;
  width: 100%;
}

@media (max-width: 1440px) {
  .multi-angle-float {
    top: 84px;
    right: 16px;
    width: min(440px, calc(100vw - 32px));
    max-height: calc(100vh - 104px);
  }

  .multi-angle-panel-scroll {
    max-height: calc(100vh - 212px);
  }
}

@media (max-width: 1180px) {
  .multi-angle-float {
    top: 76px;
    right: 12px;
    width: min(408px, calc(100vw - 24px));
    max-height: calc(100vh - 92px);
  }

  .multi-angle-shell {
    padding: 12px 12px 10px;
    border-radius: 20px;
  }

  .multi-angle-panel-scroll {
    max-height: calc(100vh - 188px);
  }

  .multi-angle-section {
    padding: 14px 14px 16px;
  }

  .section-divider {
    margin: 0 14px;
  }

  .drawer-footer {
    padding-top: 12px;
    margin-top: 12px;
  }
}

@media (max-height: 860px) {
  .multi-angle-float {
    top: 72px;
    max-height: calc(100vh - 84px);
  }

  .multi-angle-panel-scroll {
    max-height: calc(100vh - 168px);
  }
}
</style>
