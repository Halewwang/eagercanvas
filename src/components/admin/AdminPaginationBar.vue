<template>
  <nav v-if="isVisible" class="admin-pagination-bar" aria-label="分页">
    <p class="admin-pagination-summary">{{ summaryText }}</p>
    <div v-if="showActions" class="admin-pagination-actions">
      <AdminMicroButton
        :disabled="loading || normalizedPage <= 1"
        @click="emit('set-page', normalizedPage - 1)"
      >
        上一页
      </AdminMicroButton>
      <AdminMicroButton
        v-for="page in normalizedVisiblePages"
        :key="`admin-page-${page}`"
        :active="page === normalizedPage"
        :disabled="loading"
        @click="emit('set-page', page)"
      >
        {{ page }}
      </AdminMicroButton>
      <AdminMicroButton
        :disabled="loading || normalizedPage >= normalizedTotalPages"
        @click="emit('set-page', normalizedPage + 1)"
      >
        下一页
      </AdminMicroButton>
    </div>
  </nav>
</template>

<script setup>
import { computed } from 'vue'
import AdminMicroButton from './AdminMicroButton.vue'

const emit = defineEmits(['set-page'])

const props = defineProps({
  itemLabel: {
    type: String,
    default: '条'
  },
  limit: {
    type: Number,
    default: 10
  },
  loading: {
    type: Boolean,
    default: false
  },
  page: {
    type: Number,
    default: 1
  },
  total: {
    type: Number,
    default: 0
  },
  totalPages: {
    type: Number,
    default: 0
  },
  visiblePages: {
    type: Array,
    default: () => []
  }
})

const toPositiveNumber = (value, fallback = 1) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const normalizedPage = computed(() => toPositiveNumber(props.page, 1))
const normalizedLimit = computed(() => toPositiveNumber(props.limit, 10))
const normalizedTotal = computed(() => Math.max(0, Number(props.total || 0)))
const normalizedTotalPages = computed(() => {
  const explicitTotalPages = Number(props.totalPages || 0)
  if (Number.isFinite(explicitTotalPages) && explicitTotalPages > 0) return explicitTotalPages
  if (normalizedTotal.value > 0) return Math.max(1, Math.ceil(normalizedTotal.value / normalizedLimit.value))
  return 1
})

const normalizedVisiblePages = computed(() => {
  const pages = props.visiblePages
    .map((page) => Number(page))
    .filter((page) => Number.isFinite(page) && page >= 1 && page <= normalizedTotalPages.value)
  if (pages.length > 0) return [...new Set(pages)]

  const total = normalizedTotalPages.value
  const current = Math.min(normalizedPage.value, total)
  const start = Math.max(1, current - 2)
  const end = Math.min(total, start + 4)
  return Array.from({ length: end - start + 1 }, (_, index) => start + index)
})

const summaryText = computed(() => {
  if (normalizedTotal.value > 0) {
    return `第 ${normalizedPage.value} / ${normalizedTotalPages.value} 页 · 每页 ${normalizedLimit.value} ${props.itemLabel} · 共 ${normalizedTotal.value} ${props.itemLabel}`
  }
  return `第 ${normalizedPage.value} / ${normalizedTotalPages.value} 页 · 每页 ${normalizedLimit.value} ${props.itemLabel}`
})

const showActions = computed(() => normalizedTotalPages.value > 1)
const isVisible = computed(() => normalizedTotal.value > 0 || normalizedTotalPages.value > 1)
</script>

<style scoped>
.admin-pagination-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 16px;
  min-width: 0;
}

.admin-pagination-summary {
  color: rgb(255 255 255 / 48%);
  font-size: 12px;
  line-height: 1.5;
}

.admin-pagination-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

@media (max-width: 640px) {
  .admin-pagination-bar {
    align-items: stretch;
  }

  .admin-pagination-summary,
  .admin-pagination-actions {
    width: 100%;
  }

  .admin-pagination-actions :deep(.ui-micro-btn) {
    flex: 1 1 auto;
  }
}
</style>
