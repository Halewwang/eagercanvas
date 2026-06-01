<template>
  <section class="cards-grid" :class="`cards-grid--${activeSection}`">
    <article
      v-for="item in items"
      :key="item.id"
      class="project-card"
      @click="$emit('primaryClick', item)"
    >
      <div class="card-media" :class="{ 'project-media': activeSection === 'projects' }">
        <template v-if="item.thumbnail || item.cover || item.coverUrl">
          <img :src="item.thumbnail || item.cover || item.coverUrl" :alt="item.title || item.name" />
        </template>
        <template v-else-if="activeSection === 'featured' && item.canvasData">
          <WorkspaceTemplateCanvasPreview
            :canvas-data="item.canvasData"
            class="card-canvas-preview"
          />
        </template>
        <template v-else>
          <div class="fallback-icon">
            <NIcon :size="28"><component :is="resolveCardIcon(item)" /></NIcon>
          </div>
        </template>
      </div>

      <div class="card-body">
        <template v-if="activeSection === 'projects'">
          <div class="project-meta-row">
            <div class="project-meta-main">
              <h3>{{ item.name }}</h3>
              <p>{{ describeItem(item) }}</p>
            </div>
            <div @click.stop>
              <BaseDropdown
                placement="bottom-end"
                :options="projectMenuOptions(item)"
                @select="(key) => $emit('projectMenuSelect', key, item)"
              >
                <button class="menu-btn project-menu-btn" type="button">
                  <NIcon :size="16"><EllipsisHorizontalOutline /></NIcon>
                </button>
              </BaseDropdown>
            </div>
          </div>
        </template>
        <template v-else>
          <div class="title-row">
            <h3>{{ item.title || item.name }}</h3>
            <span v-if="activeSection === 'featured'" class="badge">Public</span>
          </div>
          <p>{{ describeItem(item) }}</p>
        </template>

      </div>
    </article>
  </section>
</template>

<script setup>
import { NIcon } from 'naive-ui'
import { EllipsisHorizontalOutline } from '@/icons/coolicons'
import { BaseDropdown } from '@/components/ui'
import WorkspaceTemplateCanvasPreview from './WorkspaceTemplateCanvasPreview.vue'

defineProps({
  activeSection: {
    type: String,
    default: 'projects'
  },
  items: {
    type: Array,
    default: () => []
  },
  describeItem: {
    type: Function,
    default: () => ''
  },
  resolveCardIcon: {
    type: Function,
    default: () => null
  },
  projectMenuOptions: {
    type: Function,
    default: () => []
  }
})

defineEmits([
  'primaryClick',
  'projectMenuSelect'
])
</script>

<style scoped>
.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 22px;
}

.cards-grid--featured {
  grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
  gap: 28px;
}

.project-card {
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.card-media {
  position: relative;
  isolation: isolate;
  aspect-ratio: 16 / 9;
  background:
    radial-gradient(circle at 50% 28%, rgba(255, 255, 255, 0.035), transparent 48%),
    linear-gradient(180deg, #18191c 0%, #141518 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 24px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
  transition: border-color 0.24s ease, background-color 0.24s ease, transform 0.24s ease;
}

.card-media::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  border-radius: inherit;
  opacity: 0;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.12), transparent 34%),
    radial-gradient(circle at 50% 0%, rgba(255, 255, 255, 0.08), transparent 56%);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.2),
    inset 0 -1px 0 rgba(255, 255, 255, 0.08);
  transition: opacity 0.24s ease;
}

.project-card:hover .card-media,
.project-card:focus-within .card-media {
  border-color: rgba(255, 255, 255, 0.16);
}

.project-card:hover .card-media::after,
.project-card:focus-within .card-media::after {
  opacity: 1;
}

.card-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.card-canvas-preview {
  height: 100%;
  border: none;
  border-radius: inherit;
  background: linear-gradient(180deg, #101010 0%, #050505 100%);
}

.project-media {
  background:
    radial-gradient(circle at 50% 24%, rgba(255, 255, 255, 0.02), transparent 46%),
    linear-gradient(180deg, #111214 0%, #0d0e10 100%);
}

.fallback-icon {
  position: relative;
  z-index: 2;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(236, 238, 244, 0.7);
  background: rgba(255, 255, 255, 0.015);
  transition: border-color 0.24s ease, background-color 0.24s ease, color 0.24s ease, transform 0.24s ease;
}

.project-card:hover .fallback-icon,
.project-card:focus-within .fallback-icon {
  transform: translateY(-1px);
  border-color: rgba(255, 255, 255, 0.18);
  color: rgba(255, 255, 255, 0.88);
  background: rgba(255, 255, 255, 0.035);
}

.card-body {
  padding: 0;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.title-row h3 {
  margin: 0;
  font-size: 15px;
  flex: 1;
}

.badge {
  border: 1px solid rgba(255, 255, 255, 0.14);
  color: rgba(240, 241, 243, 0.88);
  background: rgba(255, 255, 255, 0.04);
  border-radius: 999px;
  font-size: 11px;
  padding: 3px 9px;
}

.badge.mine {
  border-color: rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.88);
  background: rgba(255, 255, 255, 0.06);
}

.menu-btn {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  border: 1px solid transparent;
  background: transparent;
  color: rgba(236, 238, 244, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  outline: none;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.menu-btn:hover {
  background: rgba(255, 255, 255, 0.04);
  color: #fff;
}

.menu-btn:focus,
.menu-btn:focus-visible {
  outline: none;
  box-shadow: none;
}

.card-body p {
  margin: 8px 0 0;
  color: rgba(236, 238, 244, 0.65);
  font-size: 13px;
  line-height: 1.45;
}

.project-meta-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.project-meta-main {
  min-width: 0;
}

.project-meta-main h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-meta-main p {
  margin: 6px 0 0;
  color: rgba(236, 238, 244, 0.65);
  font-size: 13px;
  line-height: 1.35;
}

.project-menu-btn {
  margin-top: -2px;
  flex-shrink: 0;
}

@media (prefers-reduced-motion: reduce) {
  .card-media,
  .card-media::after,
  .fallback-icon {
    transition-duration: 0.01ms;
  }

  .project-card:hover .fallback-icon,
  .project-card:focus-within .fallback-icon {
    transform: none;
  }
}
</style>
