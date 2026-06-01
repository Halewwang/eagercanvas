<template>
  <div class="config-node-split-actions">
    <NodePrimaryButton
      class="config-node-split-actions__primary"
      :disabled="disabled"
      @click="$emit('primary')"
    >
      <slot name="primary" />
    </NodePrimaryButton>
    <NodeSecondaryButton
      class="config-node-split-actions__secondary"
      :disabled="disabled"
      @click="$emit('secondary')"
    >
      <slot name="secondary" />
    </NodeSecondaryButton>
  </div>
</template>

<script setup>
import NodePrimaryButton from '@/components/nodes/NodePrimaryButton.vue'
import NodeSecondaryButton from '@/components/nodes/NodeSecondaryButton.vue'

defineEmits(['primary', 'secondary'])

defineProps({
  disabled: Boolean
})
</script>

<style scoped>
.config-node-split-actions {
  display: flex;
  gap: 0.5rem;
}

.config-node-split-actions__primary {
  flex: 1 1 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.25rem;
}

.config-node-split-actions__secondary {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  padding: 0.5rem 0.625rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  line-height: 1.25rem;
}
</style>
