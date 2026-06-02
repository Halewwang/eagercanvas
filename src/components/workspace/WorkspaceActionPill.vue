<template>
  <button
    type="button"
    :class="['workspace-action-pill', `workspace-action-pill--${props.variant}`]"
    @click="$emit('click')"
  >
    <slot name="icon" />
    <span class="workspace-action-pill-label">
      <slot />
    </span>
  </button>
</template>

<script setup>
const props = defineProps({
  variant: {
    type: String,
    default: 'default'
  }
})

defineEmits(['click'])
</script>

<style scoped>
.workspace-action-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 38px;
  width: 128px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(12, 12, 12, 0.9);
  color: var(--text);
  outline: none;
  transition: border-color 0.2s ease, background-color 0.2s ease, transform 0.2s ease;
}

.workspace-action-pill:hover {
  border-color: rgba(255, 255, 255, 0.28);
  background: rgba(18, 18, 18, 0.96);
}

.workspace-action-pill--primary {
  border-color: #fff;
  background: #fff;
  color: #0d0e10;
}

.workspace-action-pill--primary:hover {
  border-color: #fff;
  background: rgba(255, 255, 255, 0.92);
  color: #0d0e10;
}

.workspace-action-pill:focus,
.workspace-action-pill:focus-visible {
  outline: none;
  box-shadow: none;
}

.workspace-action-pill-label {
  font-size: 13px;
  line-height: 1;
  font-weight: 600;
  letter-spacing: -0.01em;
  white-space: nowrap;
}
</style>
