<script setup>
/**
 * Root App component.
 */
import { NConfigProvider, darkTheme } from 'naive-ui'
import { BaseToastViewport } from './components/ui'

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
</script>

<template>
  <n-config-provider :theme="darkTheme" :theme-overrides="themeOverrides">
    <BaseToastViewport />
    <router-view />
  </n-config-provider>
</template>

<style>
/* Global app styles handled in style.css */
</style>
