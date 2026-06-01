<template>
  <div
    class="binding-status-wrap"
    :class="{ 'binding-status-wrap-flush': flush }"
    :style="moduleStyle"
  >
    <div class="binding-status-row">
      <div
        v-for="item in items"
        :key="item.key"
        class="binding-status-pill"
        :class="item.active ? 'binding-status-pill-active' : 'binding-status-pill-idle'"
      >
        {{ item.label }}
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  moduleStyle: {
    type: Object,
    default: () => ({})
  },
  items: {
    type: Array,
    default: () => []
  },
  flush: {
    type: Boolean,
    default: false
  }
})
</script>

<style scoped>
.binding-status-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  box-sizing: border-box;
  max-width: 100%;
  margin-top: 10px;
}

.binding-status-wrap-flush {
  margin-top: 0;
}

.binding-status-row {
  display: flex;
  width: 100%;
  max-width: 100%;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.binding-status-pill {
  display: inline-flex;
  max-width: 100%;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  padding: 6px 11px;
  border: 1px solid rgba(143, 143, 143, 0.45);
  border-radius: 999px;
  background: #1d1d1d;
  color: #8f939e;
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
}

.binding-status-pill-idle {
  border-color: rgba(143, 143, 143, 0.36);
  background: #1a1a1a;
  color: #818793;
}

.binding-status-pill-active {
  border-color: rgba(255, 255, 255, 0.62);
  background: #2a2a2a;
  color: #f2f3f5;
}
</style>
