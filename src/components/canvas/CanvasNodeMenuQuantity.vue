<template>
  <div class="node-menu-quantity">
    <div>
      <div class="node-menu-quantity-label">Quantity</div>
      <div class="node-menu-quantity-note">Default 1, up to 5 modules</div>
    </div>
    <div class="node-menu-stepper">
      <button class="node-menu-stepper-btn" :disabled="count <= 1" @click="$emit('decreaseCount')">-</button>
      <span class="node-menu-stepper-value">{{ count }}</span>
      <button class="node-menu-stepper-btn" :disabled="count >= 5" @click="$emit('increaseCount')">+</button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  count: {
    type: Number,
    default: 1
  }
})

defineEmits(['decreaseCount', 'increaseCount'])
</script>

<style scoped>
.node-menu-quantity {
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.node-menu-quantity-label {
  font-size: 13px;
  font-weight: 600;
  color: #f3f4f6;
}

.node-menu-quantity-note {
  margin-top: 4px;
  font-size: 12px;
  color: #6b7280;
}

.node-menu-stepper {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px;
  border-radius: 999px;
  background: #161616;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.node-menu-stepper-btn {
  width: 32px;
  height: 32px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #202020;
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #f3f4f6;
  font-size: 16px;
  transition: background 0.18s ease, border-color 0.18s ease, opacity 0.18s ease;
}

.node-menu-stepper-btn:hover:not(:disabled) {
  background: #2a2a2a;
  border-color: rgba(255, 255, 255, 0.14);
}

.node-menu-stepper-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.node-menu-stepper-value {
  min-width: 24px;
  text-align: center;
  font-size: 13px;
  color: #f3f4f6;
  font-weight: 600;
}
</style>
