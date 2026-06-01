<template>
  <textarea
    :value="modelValue"
    :placeholder="placeholder"
    class="config-node-textarea"
    @input="$emit('update:modelValue', $event.target.value)"
    @blur="$emit('blur')"
    @wheel.stop
    @mousedown.stop
  />
</template>

<script setup>
defineEmits(['update:modelValue', 'blur'])

defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  placeholder: {
    type: String,
    default: ''
  }
})
</script>

<style scoped>
.config-node-textarea {
  width: 100%;
  min-height: 60px;
  max-height: 120px;
  padding: 0.5rem;
  resize: none;
  overflow-y: auto;
  border: 1px solid rgba(143, 143, 143, 0.32);
  border-radius: 0.5rem;
  outline: none;
  background: #14161a;
  color: #eceff2;
  cursor: text;
  font-size: 0.75rem;
  line-height: 1rem;
  transition: border-color 0.2s ease;
}

.config-node-textarea::placeholder {
  color: #8f939e;
}

.config-node-textarea:focus {
  border-color: rgba(226, 229, 235, 0.72);
}
</style>
