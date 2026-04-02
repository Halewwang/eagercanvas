<template>
  <Teleport to="body">
    <div v-if="show" class="multi-angle-overlay" @click.self="emit('update:show', false)">
      <div class="multi-angle-float">
        <div class="multi-angle-shell">
          <div class="multi-angle-panel">
            <div class="multi-angle-panel-scroll">
              <section class="multi-angle-section multi-angle-section-first">
                <div class="section-heading">
                  <span class="section-title">Input Video</span>
                </div>

                <div class="video-preview-card">
                  <div class="video-preview-frame">
                    <video v-if="videoSource" :src="videoSource" controls class="video-preview-media" />
                    <div v-else class="video-preview-empty">
                      <span>No video selected</span>
                    </div>
                  </div>
                </div>
              </section>

              <div class="section-divider"></div>

              <section class="multi-angle-section">
                <div class="section-heading">
                  <span class="section-title">Enhancement</span>
                </div>

                <div class="input-options-grid">
                  <label class="option-field">
                    <span class="option-label">Model</span>
                    <select v-model="selectedModel" class="option-select">
                      <option v-for="option in modelOptions" :key="option.key" :value="option.key">
                        {{ option.label }}
                      </option>
                    </select>
                  </label>

                  <label class="option-field">
                    <span class="option-label">Output</span>
                    <select v-model="selectedResolution" class="option-select">
                      <option v-for="option in resolutionOptions" :key="option.key" :value="option.key">
                        {{ option.label }}
                      </option>
                    </select>
                  </label>
                </div>
              </section>

              <div class="section-divider"></div>

              <section class="multi-angle-section multi-angle-section-last">
                <div class="section-heading">
                  <span class="section-title">Output Settings</span>
                </div>

                <div class="manual-panel">
                  <div class="setting-row">
                    <div class="setting-copy">
                      <div class="manual-label">Frame Rate</div>
                      <div class="manual-help">Keep source or force a target frame rate</div>
                    </div>
                    <select v-model="selectedFrameRate" class="option-select compact-select">
                      <option v-for="option in frameRateOptions" :key="option.key" :value="option.key">
                        {{ option.label }}
                      </option>
                    </select>
                  </div>

                  <div class="setting-row">
                    <div class="setting-copy">
                      <div class="manual-label">Video Encoder</div>
                      <div class="manual-help">Choose output encoding format</div>
                    </div>
                    <select v-model="selectedEncoder" class="option-select compact-select">
                      <option v-for="option in encoderOptions" :key="option.key" :value="option.key">
                        {{ option.label }}
                      </option>
                    </select>
                  </div>

                  <div class="setting-row">
                    <div class="setting-copy">
                      <div class="manual-label">Compression</div>
                      <div class="manual-help">Higher compression gives smaller files</div>
                    </div>
                    <select v-model="selectedCompression" class="option-select compact-select">
                      <option v-for="option in compressionOptions" :key="option.key" :value="option.key">
                        {{ option.label }}
                      </option>
                    </select>
                  </div>
                </div>

                <div class="meta-grid">
                  <div class="camera-meta-pill">
                    <span class="camera-meta-label">Aspect Ratio</span>
                    <span class="camera-meta-value">{{ ratioLabel }}</span>
                  </div>
                  <div class="camera-meta-pill">
                    <span class="camera-meta-label">Audio</span>
                    <span class="camera-meta-value">Copy</span>
                  </div>
                  <div class="camera-meta-pill">
                    <span class="camera-meta-label">Profile</span>
                    <span class="camera-meta-value">Main</span>
                  </div>
                </div>
              </section>
            </div>
          </div>
          <div class="drawer-footer">
            <div class="footer-actions">
              <button class="tool-secondary-btn" type="button" @click="emit('update:show', false)">Cancel</button>
              <button class="tool-primary-btn" type="button" :disabled="!videoSource || applying" @click="applyEnhancement">
                {{ applying ? 'Enhancing...' : 'Enhance Video' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { Teleport, computed, ref, watch } from 'vue'
import { useVideoGeneration } from '@/hooks/useApi'

const props = defineProps({
  show: Boolean,
  videoUrl: {
    type: String,
    default: ''
  },
  ratio: {
    type: String,
    default: '16:9'
  },
  resolution: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:show', 'pending', 'apply', 'error'])

const videoGen = useVideoGeneration()
const videoSource = ref('')
const applying = ref(false)
const selectedModel = ref('prob-4')
const selectedResolution = ref('4k')
const selectedFrameRate = ref('source')
const selectedEncoder = ref('H265')
const selectedCompression = ref('High')

const modelOptions = [
  { key: 'prob-4', label: 'prob-4' }
]

const resolutionOptions = [
  { key: '1080p', label: '1080p' },
  { key: '2k', label: '2K' },
  { key: '4k', label: '4K' }
]

const frameRateOptions = [
  { key: 'source', label: 'Keep Original' },
  { key: '24', label: '24 fps' },
  { key: '30', label: '30 fps' },
  { key: '60', label: '60 fps' }
]

const encoderOptions = [
  { key: 'H264', label: 'H264' },
  { key: 'H265', label: 'H265' }
]

const compressionOptions = [
  { key: 'Low', label: 'Low' },
  { key: 'Medium', label: 'Medium' },
  { key: 'High', label: 'High' }
]

const ratioLabel = computed(() => String(props.ratio || '16:9').trim() || '16:9')

const parseRatio = (ratioValue = '16:9') => {
  const [width, height] = String(ratioValue || '16:9').split(':').map(Number)
  if (!width || !height) return { width: 16, height: 9 }
  return { width, height }
}

const buildResolutionSize = (ratioValue, resolutionValue) => {
  const longEdgeMap = {
    '1080p': 1920,
    '2k': 2560,
    '4k': 3840
  }

  const { width, height } = parseRatio(ratioValue)
  const longEdge = longEdgeMap[String(resolutionValue || '4k').trim().toLowerCase()] || 3840
  const ratio = width / height

  if (ratio >= 1) {
    return {
      width: longEdge,
      height: Math.max(2, Math.round(longEdge / ratio / 2) * 2)
    }
  }

  return {
    width: Math.max(2, Math.round(longEdge * ratio / 2) * 2),
    height: longEdge
  }
}

const buildOutput = () => {
  const targetSize = buildResolutionSize(ratioLabel.value, selectedResolution.value)
  const frameRate = Number(selectedFrameRate.value)

  return {
    ...(Number.isFinite(frameRate) && frameRate > 0 ? { frameRate } : {}),
    audioTransfer: 'Copy',
    audioCodec: 'AAC',
    videoEncoder: selectedEncoder.value,
    videoProfile: 'Main',
    dynamicCompressionLevel: selectedCompression.value,
    resolution: targetSize
  }
}

watch(
  () => props.videoUrl,
  (value) => {
    videoSource.value = String(value || '').trim()
  },
  { immediate: true }
)

watch(
  () => props.show,
  (visible) => {
    if (!visible) return
    videoSource.value = String(props.videoUrl || '').trim()
    selectedModel.value = 'prob-4'
    selectedFrameRate.value = 'source'
    selectedEncoder.value = 'H265'
    selectedCompression.value = 'High'
    selectedResolution.value = String(props.resolution || '').trim().toLowerCase() === '1080p'
      ? '1080p'
      : String(props.resolution || '').trim().toLowerCase() === '2k'
        ? '2k'
        : '4k'
  }
)

const applyEnhancement = async () => {
  if (!videoSource.value || applying.value) return

  applying.value = true
  try {
    const payload = {
      tool: 'enhance',
      file: videoSource.value,
      model: selectedModel.value,
      filters: [{ model: selectedModel.value }],
      output: buildOutput()
    }

    emit('pending', {
      targetMode: 'new',
      fileType: 'video/mp4',
      meta: {
        tool: 'video-enhance',
        model: selectedModel.value,
        resolution: selectedResolution.value,
        frameRate: selectedFrameRate.value,
        videoEncoder: selectedEncoder.value,
        dynamicCompressionLevel: selectedCompression.value
      }
    })

    const result = await videoGen.generate(payload)
    const nextUrl = String(result?.url || result?.video_url || '').trim()
    if (!nextUrl) {
      throw new Error('No video output from provider')
    }

    emit('apply', {
      targetMode: 'new',
      url: nextUrl,
      fileType: 'video/mp4',
      meta: {
        tool: 'video-enhance',
        model: selectedModel.value,
        resolution: selectedResolution.value,
        frameRate: selectedFrameRate.value,
        videoEncoder: selectedEncoder.value,
        dynamicCompressionLevel: selectedCompression.value
      }
    })
  } catch (error) {
    emit('error', {
      message: error?.message || 'Video enhancement failed'
    })
    window.$message?.error(error?.message || 'Video enhancement failed')
  } finally {
    applying.value = false
  }
}
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
  top: 0;
  right: 0;
  width: min(460px, calc(100vw - 24px));
  height: 100%;
  pointer-events: auto;
}

.multi-angle-shell {
  height: 100%;
  display: flex;
  flex-direction: column;
  border-left: 1px solid rgba(255, 255, 255, 0.08);
  background:
    linear-gradient(180deg, rgba(14, 16, 20, 0.98) 0%, rgba(10, 11, 15, 0.98) 100%);
  box-shadow: -28px 0 60px rgba(0, 0, 0, 0.42);
  backdrop-filter: blur(20px);
}

.multi-angle-panel {
  flex: 1;
  min-height: 0;
}

.multi-angle-panel-scroll {
  height: 100%;
  overflow-y: auto;
  padding: 24px 22px 28px;
}

.multi-angle-section {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.multi-angle-section-first {
  padding-top: 2px;
}

.multi-angle-section-last {
  padding-bottom: 6px;
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(219, 223, 230, 0.84);
}

.section-divider {
  height: 1px;
  margin: 22px 0;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.02));
}

.video-preview-card {
  border-radius: 24px;
  background: linear-gradient(180deg, rgba(24, 27, 32, 0.96), rgba(10, 12, 16, 0.98));
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 14px;
}

.video-preview-frame {
  overflow: hidden;
  border-radius: 18px;
  aspect-ratio: 16 / 9;
  background: #060709;
}

.video-preview-media {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.video-preview-empty {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(214, 219, 226, 0.46);
  font-size: 13px;
}

.input-options-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.option-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.option-label {
  font-size: 12px;
  color: rgba(210, 214, 221, 0.72);
}

.option-select {
  width: 100%;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
  color: #eff2f6;
  padding: 10px 12px;
  font-size: 13px;
  outline: none;
}

.compact-select {
  min-width: 148px;
}

.manual-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 14px 16px;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
}

.setting-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.manual-label {
  font-size: 13px;
  font-weight: 600;
  color: #eef1f5;
}

.manual-help {
  font-size: 12px;
  color: rgba(205, 210, 219, 0.6);
}

.meta-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.camera-meta-pill {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
}

.camera-meta-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(195, 200, 209, 0.58);
}

.camera-meta-value {
  font-size: 13px;
  font-weight: 600;
  color: #eff2f6;
}

.drawer-footer {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding: 18px 22px 20px;
  background: linear-gradient(180deg, rgba(12, 13, 17, 0.02), rgba(8, 9, 12, 0.88));
}

.footer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.tool-secondary-btn,
.tool-primary-btn {
  border: 0;
  border-radius: 999px;
  padding: 11px 18px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.18s ease, opacity 0.18s ease;
}

.tool-secondary-btn {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(235, 239, 245, 0.82);
}

.tool-primary-btn {
  background: linear-gradient(135deg, #f3f5f8, #d6dae2);
  color: #0a0b0f;
}

.tool-primary-btn:disabled,
.tool-secondary-btn:disabled {
  cursor: not-allowed;
  opacity: 0.52;
}

@media (max-width: 720px) {
  .multi-angle-float {
    width: 100%;
  }

  .multi-angle-panel-scroll {
    padding: 18px 16px 22px;
  }

  .input-options-grid,
  .meta-grid {
    grid-template-columns: 1fr;
  }

  .setting-row {
    flex-direction: column;
    align-items: flex-start;
  }

  .compact-select {
    width: 100%;
  }
}
</style>
