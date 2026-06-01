<template>
  <section class="cards-grid">
    <article
      v-if="activeSection === 'projects'"
      class="project-card create-card"
      @click="$emit('createProject')"
    >
      <div class="card-media create-media">
        <NIcon :size="44"><AddOutline /></NIcon>
      </div>
      <div class="card-body">
        <h3>Blank Project</h3>
        <p>Create a new blank project</p>
      </div>
    </article>

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

        <div v-if="activeSection !== 'projects'" class="card-actions" @click.stop>
          <BaseButton size="sm" variant="ghost" @click="$emit('previewTemplate', item)">View</BaseButton>
          <BaseButton size="sm" @click="$emit('useTemplate', item)">Use</BaseButton>
        </div>
      </div>
    </article>
  </section>
</template>

<script setup>
import { NIcon } from 'naive-ui'
import { AddOutline, EllipsisHorizontalOutline } from '@/icons/coolicons'
import { BaseButton, BaseDropdown } from '@/components/ui'

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
  'createProject',
  'primaryClick',
  'projectMenuSelect',
  'previewTemplate',
  'useTemplate'
])
</script>

<style scoped>
.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 22px;
}

.project-card {
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.create-card {
  gap: 14px;
}

.card-media {
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
  transition: border-color 0.2s ease, background-color 0.2s ease, transform 0.2s ease;
}

.project-card:hover .card-media {
  border-color: rgba(255, 255, 255, 0.14);
}

.card-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.create-media {
  color: rgba(236, 238, 244, 0.45);
  border-style: dashed;
  background:
    radial-gradient(circle at 50% 38%, rgba(255, 255, 255, 0.04), transparent 52%),
    linear-gradient(180deg, #1a1b1e 0%, #151619 100%);
}

.project-media {
  background:
    radial-gradient(circle at 50% 24%, rgba(255, 255, 255, 0.02), transparent 46%),
    linear-gradient(180deg, #111214 0%, #0d0e10 100%);
}

.fallback-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(236, 238, 244, 0.7);
  background: rgba(255, 255, 255, 0.015);
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

.card-actions {
  display: flex;
  gap: 8px;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}
</style>
