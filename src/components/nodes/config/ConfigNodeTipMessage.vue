<template>
  <div v-if="message" class="config-node-tip-message">
    <span class="config-node-tip-message__icon">💡</span>
    <span>{{ message }}</span>
  </div>
</template>

<script setup>
defineProps({
  message: {
    type: String,
    default: ''
  }
})
</script>

<style scoped>
.config-node-tip-message {
  display: flex;
  align-items: flex-start;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  background: #14161a;
  color: #8f939e;
  font-size: 0.75rem;
  line-height: 1rem;
}

.config-node-tip-message__icon {
  flex: none;
}
</style>
