<template>
  <Transition name="panel-slide">
    <div v-if="visible" class="media-library-panel" v-click-outside="handleClickOutside">
      <div class="panel-header">
        <div class="panel-header-copy">
          <div class="panel-title-row">
            <span class="panel-title">Library</span>
            <span class="panel-subtitle">{{ activeTabLabel }}</span>
          </div>
          <p class="panel-description">已保存的素材与最近生成记录。</p>
        </div>
        <button class="expand-btn" @click="visible = false">
          <n-icon :size="16"><CloseOutline /></n-icon>
        </button>
      </div>

      <div class="panel-toolbar">
        <div class="toolbar-group">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            class="toolbar-chip"
            :class="{ active: activeTab === tab.key }"
            @click="activeTab = tab.key"
          >
            {{ tab.label }}
          </button>
        </div>
        <div v-if="projectId" class="toolbar-group">
          <button
            v-for="scopeOption in scopeOptions"
            :key="scopeOption.key"
            class="toolbar-chip"
            :class="{ active: scope === scopeOption.key }"
            @click="scope = scopeOption.key"
          >
            {{ scopeOption.label }}
          </button>
        </div>
      </div>

      <div class="panel-content">
        <div v-if="loading" class="panel-state">Loading…</div>
        <div v-else-if="errorMessage" class="panel-state panel-state-error">{{ errorMessage }}</div>
        <div v-else-if="activeTab === 'assets' && assetItems.length === 0" class="panel-state">暂无可复用素材。</div>
        <div v-else-if="activeTab === 'history' && historyItems.length === 0" class="panel-state">暂无生成记录。</div>

        <div v-else-if="activeTab === 'assets'" class="asset-grid">
          <article
            v-for="asset in assetItems"
            :key="asset.id"
            class="asset-card"
          >
            <button
              class="asset-preview asset-preview-button"
              type="button"
              @click="emitInsertAsset(asset)"
            >
              <video v-if="asset.kind === 'video'" :src="asset.previewUrl || asset.url" class="asset-media" muted playsinline />
              <img v-else-if="asset.previewUrl" :src="asset.previewUrl" :alt="asset.fileName" class="asset-media" />
              <div v-else class="asset-fallback">
                <n-icon :size="24">
                  <component :is="iconByKind(asset.kind)" />
                </n-icon>
              </div>
            </button>
            <div class="asset-meta">
              <div class="asset-meta-row">
                <span class="asset-kind">{{ kindLabel(asset.kind) }}</span>
                <span class="asset-origin">{{ originLabel(asset.sourceType) }}</span>
              </div>
              <div class="asset-time">{{ formatTimestamp(asset.createdAt) }}</div>
            </div>
          </article>
        </div>

        <div v-else class="history-list">
          <article
            v-for="item in historyItems"
            :key="item.id"
            class="history-card"
          >
            <div class="history-main">
              <div class="history-preview">
                <video
                  v-if="pickHistoryAsset(item)?.kind === 'video' && pickHistoryAsset(item)?.previewUrl"
                  :src="pickHistoryAsset(item)?.previewUrl"
                  class="asset-media"
                  muted
                  playsinline
                />
                <img
                  v-else-if="pickHistoryAsset(item)?.previewUrl"
                  :src="pickHistoryAsset(item)?.previewUrl"
                  :alt="item.type"
                  class="asset-media"
                />
                <div v-else class="asset-fallback">
                  <n-icon :size="24">
                    <component :is="iconByKind(item.type)" />
                  </n-icon>
                </div>
              </div>
              <div class="history-copy">
                <div class="history-title-row">
                  <span class="history-type">{{ historyTypeLabel(item.type) }}</span>
                  <span class="history-status" :class="`status-${item.status || 'idle'}`">{{ statusLabel(item.status) }}</span>
                </div>
                <div class="history-model">{{ item.model || 'Default Model' }}</div>
                <div class="history-time">{{ formatTimestamp(item.startedAt || item.finishedAt) }}</div>
                <div v-if="item.error" class="history-error">{{ item.error }}</div>
              </div>
            </div>
            <div class="history-actions">
              <span class="history-count">{{ item.outputCount || item.assets?.length || 0 }} output</span>
              <button
                class="asset-action"
                :disabled="!pickHistoryAsset(item)"
                @click="emitInsertAsset(pickHistoryAsset(item))"
              >
                Reuse Output
              </button>
            </div>
          </article>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { NIcon } from 'naive-ui'
import { getGenerationHistory, getMediaAssets } from '@/api'
import {
  AppsOutline,
  CloseOutline,
  ImageOutline,
  SparklesOutline,
  VideocamOutline
} from '../icons/coolicons'

const props = defineProps({
  show: Boolean,
  projectId: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:show', 'insert-asset'])

const visible = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value)
})

const tabs = [
  { key: 'assets', label: 'Assets' },
  { key: 'history', label: 'History' }
]

const scopeOptions = [
  { key: 'project', label: 'Current Project' },
  { key: 'all', label: 'All Projects' }
]

const activeTab = ref('assets')
const scope = ref(props.projectId ? 'project' : 'all')
const loading = ref(false)
const errorMessage = ref('')
const assetItems = ref([])
const historyItems = ref([])

const requestProjectId = computed(() => (
  scope.value === 'project' ? String(props.projectId || '').trim() : ''
))

const activeTabLabel = computed(() => tabs.find((item) => item.key === activeTab.value)?.label || 'Assets')

const formatTimestamp = (value = '') => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString()
}

const kindLabel = (kind = '') => {
  const normalized = String(kind || '').trim().toLowerCase()
  if (normalized === 'video') return 'Video'
  if (normalized === 'model3d') return '3D'
  return 'Image'
}

const historyTypeLabel = (type = '') => {
  const normalized = String(type || '').trim().toLowerCase()
  if (normalized === 'model3d') return '3D Generation'
  if (normalized === 'video') return 'Video Generation'
  return 'Image Generation'
}

const originLabel = (sourceType = '') => (String(sourceType || '').trim() === 'generation' ? 'Generated' : 'Uploaded')

const statusLabel = (status = '') => {
  const normalized = String(status || '').trim().toLowerCase()
  if (['completed', 'success', 'succeeded', 'done', 'finished'].includes(normalized)) return 'Completed'
  if (['failed', 'error'].includes(normalized)) return 'Failed'
  if (['running', 'polling'].includes(normalized)) return 'Running'
  return 'Pending'
}

const iconByKind = (kind = '') => {
  const normalized = String(kind || '').trim().toLowerCase()
  if (normalized === 'video') return VideocamOutline
  if (normalized === 'model3d') return AppsOutline
  if (normalized === 'history') return SparklesOutline
  return ImageOutline
}

const pickHistoryAsset = (item = {}) => {
  const assets = Array.isArray(item?.assets) ? item.assets : []
  const primary = assets.find((asset) => String(asset?.url || '').trim()) || null
  if (!primary) return null
  if (String(item?.type || '').trim().toLowerCase() !== 'model3d') return primary

  const assetUrls = assets.reduce((acc, asset) => {
    const url = String(asset?.url || '').trim()
    const fileName = String(asset?.fileName || '').trim().toLowerCase()
    if (!url) return acc
    if (fileName.endsWith('.glb')) acc.glb = url
    if (fileName.endsWith('.obj')) acc.obj = url
    if (fileName.endsWith('.fbx')) acc.fbx = url
    if (fileName.endsWith('.stl')) acc.stl = url
    if (fileName.endsWith('.usdz')) acc.usdz = url
    return acc
  }, {})

  return {
    ...primary,
    assetUrls
  }
}

const loadLibrary = async () => {
  if (!visible.value) return
  loading.value = true
  errorMessage.value = ''

  try {
    const params = {
      limit: activeTab.value === 'assets' ? 80 : 50,
      projectId: requestProjectId.value || undefined
    }

    if (activeTab.value === 'assets') {
      const response = await getMediaAssets(params)
      assetItems.value = Array.isArray(response?.items) ? response.items : []
      return
    }

    const response = await getGenerationHistory(params)
    historyItems.value = Array.isArray(response?.items) ? response.items : []
  } catch (error) {
    errorMessage.value = error?.message || 'Library load failed'
  } finally {
    loading.value = false
  }
}

const emitInsertAsset = (asset) => {
  if (!asset?.url) return
  emit('insert-asset', asset)
}

const handleClickOutside = () => {
  visible.value = false
}

watch(
  () => props.projectId,
  (value) => {
    if (!value && scope.value === 'project') {
      scope.value = 'all'
    }
  }
)

watch([visible, activeTab, scope, requestProjectId], () => {
  if (!visible.value) return
  void loadLibrary()
}, { immediate: true })

const vClickOutside = {
  mounted(el, binding) {
    el._clickOutside = (event) => {
      if (!el.contains(event.target)) binding.value()
    }
    window.setTimeout(() => {
      document.addEventListener('click', el._clickOutside)
    }, 0)
  },
  unmounted(el) {
    document.removeEventListener('click', el._clickOutside)
  }
}
</script>

<style scoped>
.media-library-panel {
  position: fixed;
  left: 72px;
  top: 100px;
  width: 560px;
  max-height: 72vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 20px;
  border: 1px solid var(--border-color);
  background: rgba(18, 18, 18, 0.96);
  backdrop-filter: blur(14px);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.32);
  z-index: 120;
}

.panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.panel-header-copy {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.panel-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.panel-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.panel-subtitle {
  font-size: 12px;
  color: var(--text-secondary);
}

.panel-description {
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary);
}

.panel-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-chip {
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-secondary);
  border-radius: 999px;
  padding: 7px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.18s ease;
}

.toolbar-chip.active {
  color: var(--text-primary);
  border-color: rgba(255, 255, 255, 0.24);
  background: rgba(255, 255, 255, 0.1);
}

.expand-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-tertiary);
  border: none;
  border-radius: 8px;
  color: var(--text-secondary);
  cursor: pointer;
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 18px 20px 20px;
}

.panel-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 180px;
  color: var(--text-secondary);
  font-size: 13px;
}

.panel-state-error {
  color: #f99;
}

.asset-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.asset-card,
.history-card {
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.03);
  overflow: hidden;
}

.asset-preview {
  height: 148px;
  background: #0b0b0b;
}

.asset-preview-button {
  width: 100%;
  padding: 0;
  border: 0;
  cursor: pointer;
  display: block;
}

.asset-preview-button:hover {
  opacity: 0.92;
}

.asset-media {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.asset-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
}

.asset-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 12px 10px;
}

.asset-meta-row,
.history-title-row,
.history-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.asset-kind,
.asset-origin,
.history-type,
.history-status,
.history-count {
  font-size: 11px;
  color: var(--text-secondary);
}

.history-model {
  font-size: 13px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.asset-time,
.history-time,
.history-error {
  font-size: 12px;
  color: var(--text-secondary);
}

.asset-action {
  width: calc(100% - 24px);
  margin: 0 12px 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-primary);
  padding: 10px 12px;
  font-size: 12px;
  cursor: pointer;
}

.asset-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.history-card {
  padding: 12px;
}

.history-main {
  display: flex;
  gap: 12px;
}

.history-preview {
  width: 92px;
  height: 92px;
  border-radius: 14px;
  overflow: hidden;
  background: #0b0b0b;
  flex-shrink: 0;
}

.history-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.status-completed {
  color: #9ee6b1;
}

.status-running,
.status-pending {
  color: #f2cf8a;
}

.status-failed {
  color: #ff9b9b;
}

.history-actions {
  margin-top: 12px;
}

.panel-slide-enter-active,
.panel-slide-leave-active {
  transition: all 0.2s ease;
}

.panel-slide-enter-from,
.panel-slide-leave-to {
  opacity: 0;
  transform: translateX(-12px);
}
</style>
