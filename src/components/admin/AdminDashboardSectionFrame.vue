<template>
  <AdminGlassSurface v-if="show" ref="sectionRef" tag="section" :surface-class="sectionClass">
    <slot />
  </AdminGlassSurface>
</template>

<script setup>
import { computed, ref } from 'vue'
import AdminGlassSurface from './AdminGlassSurface.vue'

const props = defineProps({
  frameClass: {
    type: String,
    default: ''
  },
  show: {
    type: Boolean,
    default: true
  }
})

const sectionRef = ref(null)
const sectionClass = computed(() => [
  'admin-dashboard-section-frame min-w-0 overflow-hidden scroll-mt-6 rounded-2xl p-5 md:p-6',
  props.frameClass
])

defineExpose({
  getSectionEl: () => sectionRef.value?.getSurfaceEl() ?? null
})
</script>
