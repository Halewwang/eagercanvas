<script setup>
/**
 * Root App component.
 */
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { NConfigProvider, darkTheme } from 'naive-ui'
import { useRoute } from 'vue-router'
import { BaseToastViewport, ErrorBoundary, NetworkBanner } from './components/ui'
import UpdatePrompt from './components/UpdatePrompt.vue'
import { startAppVersionWatcher, stopAppVersionWatcher } from './utils/appVersion'

const route = useRoute()
const appRouteClass = computed(() => [
  'app-route',
  route.name === 'Home' ? 'app-route--home' : 'app-route--google-sans'
])

const themeOverrides = {
  common: {
    borderRadius: '12px',
    borderRadiusSmall: '8px'
  },
  Dialog: {
    borderRadius: '16px',
    padding: '24px'
  },
  Modal: {
    borderRadius: '16px',
    padding: '24px'
  },
  Card: {
    borderRadius: '16px',
    padding: '24px'
  },
  Button: {
    borderRadiusMedium: '10px',
    borderRadiusSmall: '8px',
    borderRadiusLarge: '12px',
    heightMedium: '36px',
    paddingMedium: '0 16px'
  },
  Input: {
    borderRadius: '10px',
    heightMedium: '36px'
  }
}

const syncOfflineDrafts = async () => {
  const { syncOfflineCanvasDrafts } = await import('./stores/projects')
  return syncOfflineCanvasDrafts()
}

onMounted(() => {
  startAppVersionWatcher()
})

onBeforeUnmount(() => {
  stopAppVersionWatcher()
})
</script>

<template>
  <n-config-provider :theme="darkTheme" :theme-overrides="themeOverrides" :class="appRouteClass">
    <ErrorBoundary>
      <BaseToastViewport />
      <NetworkBanner :sync-offline-drafts="syncOfflineDrafts" />
      <UpdatePrompt />
      <router-view />
    </ErrorBoundary>
  </n-config-provider>
</template>

<style>
/* Global app styles handled in style.css */
</style>
