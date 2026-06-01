<template>
  <AdminGlassSurface :surface-class="panelClass">
    <div v-if="title || caption || meta || $slots.actions" :class="headerClass">
      <div>
        <h3 v-if="title" :class="titleClass">{{ title }}</h3>
        <p v-if="caption" :class="captionClass">{{ caption }}</p>
      </div>
      <slot name="actions">
        <span v-if="meta" :class="metaClass">{{ meta }}</span>
      </slot>
    </div>
    <slot />
  </AdminGlassSurface>
</template>

<script setup>
import AdminGlassSurface from './AdminGlassSurface.vue'

defineProps({
  caption: {
    type: String,
    default: ''
  },
  captionClass: {
    type: String,
    default: 'mt-1 text-xs text-white/45'
  },
  headerClass: {
    type: String,
    default: 'mb-4 flex flex-wrap items-center justify-between gap-3'
  },
  meta: {
    type: String,
    default: ''
  },
  metaClass: {
    type: String,
    default: 'text-xs text-white/45'
  },
  panelClass: {
    type: String,
    default: 'admin-panel-card rounded-2xl p-4 md:p-5'
  },
  title: {
    type: String,
    default: ''
  },
  titleClass: {
    type: String,
    default: 'text-lg font-medium text-white'
  }
})
</script>
