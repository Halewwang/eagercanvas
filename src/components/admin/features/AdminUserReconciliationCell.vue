<template>
  <td class="admin-user-reconciliation-cell px-3 py-4">
    <div class="admin-user-reconciliation-card">
      <div class="admin-user-reconciliation-grid">
        <p :class="user.usageMeta?.pendingBillingCount ? 'is-warning' : 'is-muted'">
          <span>对账状态</span>
          <strong>{{ user.reconciliation?.pendingCount ? `待对账 ${user.reconciliation.pendingCount} 条` : '无待对账' }}</strong>
        </p>
        <p :class="user.reconciliation?.unmatchedCount ? 'is-danger' : 'is-muted'">
          <span>异常账单</span>
          <strong>{{ user.reconciliation?.unmatchedCount ? `${user.reconciliation.unmatchedCount} 条` : '无异常' }}</strong>
        </p>
      </div>
      <p class="admin-user-reconciliation-activity">
        <span>最近活跃</span>
        <strong>{{ formatDateTime(user.usageMeta?.lastActivityAt) }}</strong>
      </p>
    </div>
  </td>
</template>

<script setup>
const {
  formatDateTime,
  user
} = defineProps({
  formatDateTime: {
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
.admin-user-reconciliation-cell {
  height: 1px;
}

.admin-user-reconciliation-card {
  display: flex;
  height: 100%;
  min-width: 190px;
  min-height: 138px;
  flex-direction: column;
  gap: 9px;
  justify-content: space-between;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.02);
  padding: 10px;
}

.admin-user-reconciliation-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.admin-user-reconciliation-card p {
  min-width: 0;
}

.admin-user-reconciliation-card span {
  display: block;
  color: rgba(255, 255, 255, 0.38);
  font-size: 11px;
  line-height: 1.2;
}

.admin-user-reconciliation-card strong {
  display: block;
  margin-top: 4px;
  color: rgba(255, 255, 255, 0.72);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.admin-user-reconciliation-card .is-warning strong {
  color: rgba(253, 230, 138, 0.9);
}

.admin-user-reconciliation-card .is-danger strong {
  color: rgba(254, 202, 202, 0.9);
}

.admin-user-reconciliation-card .is-muted strong {
  color: rgba(255, 255, 255, 0.46);
}

.admin-user-reconciliation-activity {
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  padding-top: 8px;
}
</style>
