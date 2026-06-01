<template>
  <a
    v-if="href"
    class="admin-sidebar-nav-item"
    :class="{ 'admin-sidebar-nav-item-active': active }"
    :href="href"
  >
    <span>{{ label }}</span>
    <span class="admin-sidebar-nav-note">{{ note }}</span>
  </a>
  <button
    v-else
    type="button"
    class="admin-sidebar-nav-item"
    :class="{ 'admin-sidebar-nav-item-active': active }"
    @click="$emit('select')"
  >
    <span>{{ label }}</span>
    <span class="admin-sidebar-nav-note">{{ note }}</span>
  </button>
</template>

<script setup>
defineEmits(['select'])

defineProps({
  label: {
    type: String,
    default: ''
  },
  note: {
    type: String,
    default: ''
  },
  active: {
    type: Boolean,
    default: false
  },
  href: {
    type: String,
    default: ''
  }
})
</script>

<style scoped>
.admin-sidebar-nav-item {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-radius: 12px;
  border: 1px solid transparent;
  padding: 10px 12px;
  text-align: left;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.62);
  transition: all 0.2s ease;
}

.admin-sidebar-nav-item:hover {
  border-color: rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.07);
  color: rgba(255, 255, 255, 0.94);
}

.admin-sidebar-nav-item-active {
  border-color: rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.09);
  color: rgba(255, 255, 255, 0.94);
}

.admin-sidebar-nav-note {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.36);
}
</style>
