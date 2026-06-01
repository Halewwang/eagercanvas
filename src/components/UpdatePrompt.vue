<template>
  <div v-if="showBanner" class="update-banner-shell pointer-events-none fixed inset-x-0 top-5 z-[1100] flex justify-center px-4">
    <div class="update-banner pointer-events-auto">
      <div class="update-banner-copy">
        <p class="update-banner-title">New version available</p>
        <p class="update-banner-text">Refresh to load the latest fixes and updates.</p>
      </div>
      <div class="update-banner-actions">
        <BaseButton variant="ghost" size="sm" :disabled="refreshing" @click="dismissAppUpdate">Later</BaseButton>
        <BaseButton size="sm" :loading="refreshing" @click="refreshApp">Refresh</BaseButton>
      </div>
    </div>
  </div>

  <BaseModal
    :show="showModal"
    title="New version available"
    description="A newer version is ready. Refresh this page to use the latest fixes and updates."
    size="sm"
    :close-on-overlay="false"
    :show-close="false"
  >
    <div class="update-modal-copy">
      <p class="ui-caption text-[var(--text-soft)]">
        Current build: {{ currentBuildLabel }}
      </p>
      <p v-if="latestBuildLabel" class="ui-caption text-[var(--text-soft)]">
        Latest build: {{ latestBuildLabel }}
      </p>
    </div>
    <template #footer>
      <BaseModalActions>
        <BaseButton variant="ghost" :disabled="refreshing" @click="dismissAppUpdate">Later</BaseButton>
        <BaseButton :loading="refreshing" @click="refreshApp">Refresh now</BaseButton>
      </BaseModalActions>
    </template>
  </BaseModal>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { BaseButton, BaseModal, BaseModalActions } from '@/components/ui'
import { appVersionState, dismissAppUpdate } from '@/utils/appVersion'

const route = useRoute()
const refreshing = ref(false)

const isCanvasRoute = computed(() => route.name === 'Canvas')
const showModal = computed(() => appVersionState.updateAvailable && !isCanvasRoute.value)
const showBanner = computed(() => appVersionState.updateAvailable && isCanvasRoute.value)
const currentBuildLabel = computed(() => appVersionState.currentBuildId || 'current')
const latestBuildLabel = computed(() => appVersionState.latestBuildId || '')

const flushCanvasBeforeRefresh = async () => {
  if (!isCanvasRoute.value) return

  const { useCanvasStore } = await import('@/stores/canvas')
  const canvasStore = useCanvasStore()
  const currentProjectId = canvasStore.currentProjectId?.value ?? canvasStore.currentProjectId

  if (currentProjectId) {
    await canvasStore.flushSave().catch(() => false)
  }
}

const refreshApp = async () => {
  if (refreshing.value) return

  refreshing.value = true
  try {
    await flushCanvasBeforeRefresh()
  } finally {
    window.location.reload()
  }
}
</script>

<style scoped>
.update-banner-shell {
  animation: update-banner-in 180ms ease-out;
}

.update-banner {
  display: flex;
  align-items: center;
  gap: 14px;
  width: min(540px, 100%);
  padding: 12px 14px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 20px;
  background: linear-gradient(180deg, rgba(24, 24, 24, 0.94) 0%, rgba(16, 16, 16, 0.96) 100%);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.34);
  backdrop-filter: blur(16px);
}

.update-banner-copy {
  min-width: 0;
  flex: 1;
}

.update-banner-title {
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.2;
}

.update-banner-text {
  margin-top: 4px;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.4;
}

.update-banner-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.update-modal-copy {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

@keyframes update-banner-in {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 767px) {
  .update-banner {
    flex-direction: column;
    align-items: stretch;
    gap: 14px;
  }

  .update-banner-actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
