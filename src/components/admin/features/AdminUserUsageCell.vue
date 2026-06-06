<template>
  <td class="admin-user-usage-cell px-3 py-4 text-white/85">
    <div class="admin-user-usage-card">
      <div class="admin-user-usage-grid">
        <div class="admin-user-usage-stat admin-user-usage-stat-primary">
          <span>调用次数</span>
          <strong>{{ user.officialUsage?.totalCalls || 0 }} 次</strong>
        </div>
        <div class="admin-user-usage-stat">
          <span>官方成本</span>
          <strong>{{ formatUsd(user.officialUsage?.totalCostAmount, 4) }} {{ user.officialUsage?.currency || 'USD' }}</strong>
        </div>
      </div>
      <p class="admin-user-usage-meta">
        <span>高频模型</span>
        <strong>{{ topModelLabel(user) }}</strong>
      </p>
    </div>
  </td>
</template>

<script setup>
const {
  formatUsd,
  topModelLabel,
  user
} = defineProps({
  formatUsd: {
    type: Function,
    required: true
  },
  topModelLabel: {
    type: Function,
    required: true
  },
  user: {
    type: Object,
    default: () => ({})
  }
})
</script>

<style scoped>
.admin-user-usage-cell {
  height: 1px;
}

.admin-user-usage-card {
  display: flex;
  height: 100%;
  min-width: 210px;
  min-height: 138px;
  flex-direction: column;
  gap: 10px;
  justify-content: space-between;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.025);
  padding: 10px;
}

.admin-user-usage-grid {
  display: grid;
  grid-template-columns: minmax(0, 0.85fr) minmax(0, 1fr);
  gap: 8px;
}

.admin-user-usage-stat,
.admin-user-usage-meta {
  min-width: 0;
}

.admin-user-usage-stat span,
.admin-user-usage-meta span {
  display: block;
  color: rgba(255, 255, 255, 0.38);
  font-size: 11px;
  line-height: 1.2;
}

.admin-user-usage-stat strong,
.admin-user-usage-meta strong {
  display: block;
  margin-top: 4px;
  color: rgba(255, 255, 255, 0.82);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.admin-user-usage-stat-primary strong {
  color: rgba(255, 255, 255, 0.95);
  font-size: 15px;
}

.admin-user-usage-meta {
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  padding-top: 8px;
}
</style>
