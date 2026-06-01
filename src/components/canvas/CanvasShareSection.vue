<template>
  <section class="share-section" :class="{ 'share-section--form': form }">
    <div class="share-heading">
      <h3>{{ title }}</h3>
      <p v-if="copy">{{ copy }}</p>
      <slot name="description" />
    </div>
    <slot />
  </section>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    required: true
  },
  copy: {
    type: String,
    default: ''
  },
  form: Boolean
})
</script>

<style scoped>
.share-section {
  padding: 20px 0;
}

.share-section + .share-section {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.share-section--form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.share-heading {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 5px;
}

.share-section h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0;
}

.share-heading p {
  margin: 0;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.45;
}

.share-heading :slotted(p) {
  margin: 0;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.45;
}
</style>
