<script setup>
import { computed, onErrorCaptured, ref } from 'vue'

const error = ref(null)

const errorMessage = computed(() => {
  const message = error.value?.message || ''
  return message || '页面模块加载失败，请稍后重试。'
})

const resetBoundary = () => {
  error.value = null
}

onErrorCaptured((capturedError) => {
  error.value = capturedError
  return false
})
</script>

<template>
  <slot v-if="!error" />
  <main v-else class="error-boundary" role="alert" aria-live="assertive">
    <section class="error-boundary__panel">
      <p class="error-boundary__eyebrow">Module unavailable</p>
      <h1>页面暂时无法显示</h1>
      <p class="error-boundary__copy">
        {{ errorMessage }}
      </p>
      <button class="error-boundary__button" type="button" @click="resetBoundary">
        重试
      </button>
    </section>
  </main>
</template>

<style scoped>
.error-boundary {
  display: grid;
  min-height: 100vh;
  place-items: center;
  padding: 32px;
  color: var(--text-primary, #f7f7f7);
  background: var(--bg-primary, #090909);
}

.error-boundary__panel {
  width: min(440px, 100%);
  padding: 24px;
  border: 1px solid rgb(255 255 255 / 12%);
  border-radius: 8px;
  background: rgb(255 255 255 / 6%);
  box-shadow: 0 24px 70px rgb(0 0 0 / 28%);
}

.error-boundary__eyebrow {
  margin: 0 0 8px;
  color: rgb(255 255 255 / 54%);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}

.error-boundary h1 {
  margin: 0;
  font-size: 24px;
  line-height: 1.25;
}

.error-boundary__copy {
  margin: 12px 0 20px;
  color: rgb(255 255 255 / 68%);
  font-size: 14px;
  line-height: 1.6;
}

.error-boundary__button {
  height: 36px;
  padding: 0 16px;
  border: 1px solid rgb(255 255 255 / 16%);
  border-radius: 8px;
  color: #111;
  font-weight: 700;
  background: #fff;
  cursor: pointer;
}
</style>
