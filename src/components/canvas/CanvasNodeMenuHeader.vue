<template>
  <div class="node-menu-header">
    <div>
      <div class="node-menu-eyebrow">ADD MODULE</div>
      <h3 class="node-menu-title">{{ title }}</h3>
      <p class="node-menu-copy">{{ copy }}</p>
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    default: ''
  },
  copy: {
    type: String,
    default: ''
  }
})
</script>

<style scoped>
.node-menu-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 18px;
}

.node-menu-eyebrow {
  font-size: 11px;
  line-height: 1;
  letter-spacing: 0.14em;
  color: #6b7280;
  margin-bottom: 12px;
}

.node-menu-title {
  margin: 0;
  font-size: 17px;
  line-height: 1.25;
  font-weight: 600;
  color: #f3f4f6;
}

.node-menu-copy {
  margin: 12px 0 0;
  font-size: 13px;
  line-height: 1.65;
  color: #9ca3af;
}
</style>
