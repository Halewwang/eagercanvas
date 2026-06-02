<template>
  <div class="read-only-banner">
    <strong>Read-only</strong>
    <span>Team project shared by {{ ownerName || 'the owner' }}.</span>
    <button type="button" @click="$emit('requestEdit')">Request edit access</button>
  </div>
</template>

<script setup>
defineProps({
  ownerName: {
    type: String,
    default: ''
  }
})

defineEmits(['requestEdit'])
</script>

<style scoped>
.read-only-banner {
  position: absolute;
  left: 50%;
  top: 18px;
  z-index: 24;
  transform: translateX(-50%);
  min-height: 46px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(18, 18, 18, 0.84);
  color: rgba(236, 238, 244, 0.82);
  backdrop-filter: blur(14px);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 12px 0 16px;
  font-size: 13px;
}

.read-only-banner strong {
  color: #fff;
  font-weight: 700;
}

.read-only-banner button {
  height: 30px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  padding: 0 10px;
  cursor: pointer;
  font-size: 12px;
}
</style>
