<template>
  <section class="workspace-loading-grid" role="status" aria-label="Loading workspace projects">
    <article v-for="index in 6" :key="index" class="workspace-loading-card" aria-hidden="true">
      <div class="workspace-loading-media" />
      <div class="workspace-loading-line title" />
      <div class="workspace-loading-line meta" />
    </article>
  </section>
</template>

<style scoped>
.workspace-loading-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 22px;
}

.workspace-loading-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.workspace-loading-media,
.workspace-loading-line {
  position: relative;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.055);
}

.workspace-loading-media {
  aspect-ratio: 16 / 9;
  border-radius: 24px;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08);
}

.workspace-loading-line {
  height: 12px;
  border-radius: 6px;
}

.workspace-loading-line.title {
  width: 42%;
}

.workspace-loading-line.meta {
  width: 66%;
  opacity: 0.7;
}

.workspace-loading-media::after,
.workspace-loading-line::after {
  content: '';
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.09), transparent);
  animation: workspace-loading-shimmer 1.25s ease-in-out infinite;
}

@keyframes workspace-loading-shimmer {
  to {
    transform: translateX(100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .workspace-loading-media::after,
  .workspace-loading-line::after {
    animation: none;
    display: none;
  }
}
</style>
