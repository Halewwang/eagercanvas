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
import { useVideoGeneration } from '@/hooks/api/useVideoApi.js'
import {
  createVideoEnhanceApplyPayload,
  createVideoEnhancePendingPayload,
  runVideoEnhancement
} from './VideoEnhanceGeneration.js'

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
    selectedFrameRate.value = '30'
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
    const controls = {
      model: selectedModel.value,
      resolution: selectedResolution.value,
      frameRate: selectedFrameRate.value,
      videoEncoder: selectedEncoder.value,
      dynamicCompressionLevel: selectedCompression.value
    }

    emit('pending', createVideoEnhancePendingPayload(controls))

    const nextUrl = await runVideoEnhancement({
      videoGen,
      ...controls,
      file: videoSource.value,
      ratio: ratioLabel.value
    })

    emit('apply', createVideoEnhanceApplyPayload({
      ...controls,
      url: nextUrl
    }))
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

<style scoped src="./VideoEnhanceToolDrawer.css"></style>
