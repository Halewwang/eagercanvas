<template>
  <div class="config-node-output-preview" @wheel.stop @mousedown.stop>
    <pre class="config-node-output-preview__content">{{ content }}</pre>
  </div>
</template>

<script setup>
defineProps({
  content: {
    type: String,
    default: ''
  }
})
</script>

<style scoped>
.config-node-output-preview {
  max-height: 150px;
  padding: 0.5rem;
  overflow-y: auto;
  border: 1px solid rgba(143, 143, 143, 0.32);
  border-radius: 0.5rem;
  background: #14161a;
  color: #eceff2;
  font-size: 0.75rem;
  line-height: 1rem;
}

.config-node-output-preview__content {
  margin: 0;
  cursor: text;
  user-select: text;
  white-space: pre-wrap;
  -webkit-user-select: text;
}
</style>
