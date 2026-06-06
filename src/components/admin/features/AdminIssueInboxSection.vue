<template>
  <AdminSectionHeader
    class="mb-4"
    title="问题收件箱"
    caption="汇总线上报错、慢请求、模型供应商 / 数据库异常和前端运行问题，供 Codex 定位修复。"
  />

  <div v-if="canReadIssues" class="admin-issue-toolbar mb-5">
    <AdminFilterToolbar class="admin-issue-filter-group" compact>
      <AdminFilterField label="状态">
        <AdminControlField
          tag="select"
          :value="issueQuery.status"
          @change="emit('update-issue-query', 'status', $event.target.value)"
        >
          <option value="">全部状态</option>
          <option value="open">待处理</option>
          <option value="investigating">处理中</option>
          <option value="resolved">已解决</option>
          <option value="ignored">已忽略</option>
        </AdminControlField>
      </AdminFilterField>
      <AdminFilterField label="级别">
        <AdminControlField
          tag="select"
          :value="issueQuery.severity"
          @change="emit('update-issue-query', 'severity', $event.target.value)"
        >
          <option value="">全部级别</option>
          <option value="p0">P0</option>
          <option value="p1">P1</option>
          <option value="p2">P2</option>
          <option value="p3">P3</option>
        </AdminControlField>
      </AdminFilterField>
      <AdminFilterField label="层级">
        <AdminControlField
          tag="select"
          :value="issueQuery.source_layer"
          @change="emit('update-issue-query', 'source_layer', $event.target.value)"
        >
          <option value="">全部层级</option>
          <option value="frontend">前端</option>
          <option value="backend">后端</option>
          <option value="database">数据库</option>
          <option value="provider">模型供应商</option>
          <option value="performance">性能</option>
          <option value="ux">交互体验</option>
        </AdminControlField>
      </AdminFilterField>
      <AdminMicroButton :disabled="loadingIssues" @click="emit('load-issues')">刷新</AdminMicroButton>
    </AdminFilterToolbar>

    <div class="admin-issue-action-group">
      <span v-if="canExportIssues" class="admin-issue-batch-summary">
        已选 {{ selectedIssueCount }} 项 · 导出 {{ selectedExportGroupIds.length }} 组
      </span>
      <label v-if="canExportIssues && canUpdateIssues" class="admin-issue-auto-resolve">
        <input
          class="admin-issue-checkbox"
          type="checkbox"
          :checked="autoResolveExportedIssues"
          @change="emit('update-auto-resolve-exported-issues', $event.target.checked)"
        >
        <span>导出后标记已解决</span>
      </label>
      <AdminMicroButton
        v-if="canExportIssues"
        :disabled="selectedIssueCount <= 0 || issueActionLoading === 'export'"
        @click="emit('export-issues', { selectedOnly: true })"
      >
        导出选中
      </AdminMicroButton>
      <AdminMicroButton
        v-if="canExportIssues"
        tone="primary"
        :disabled="issueActionLoading === 'export'"
        @click="emit('export-issues')"
      >
        导出当前筛选
      </AdminMicroButton>
    </div>
  </div>

  <AdminEmptyState v-if="!canReadIssues">
    当前角色没有问题收件箱读取权限。
  </AdminEmptyState>

  <div v-else class="admin-issue-layout">
    <AdminPanelCard
      :title="`问题列表 (${issuePagination.total || issues.length})`"
      :caption="loadingIssues ? '正在加载最新问题分组' : '按问题指纹聚合后的问题分组'"
      panel-class="admin-panel-card rounded-2xl p-4 md:p-5"
    >
      <AdminEmptyState v-if="!loadingIssues && issues.length === 0">暂无问题分组</AdminEmptyState>
      <AdminTableShell v-else min-width-class="min-w-[880px]">
        <template #header>
          <th class="w-10 px-3 py-3">
            <input
              class="admin-issue-checkbox"
              type="checkbox"
              aria-label="选择本页所有问题"
              :checked="allVisibleIssuesSelected"
              :disabled="loadingIssues || issues.length === 0"
              @change="emit('toggle-all-issue-selection', $event.target.checked)"
            >
          </th>
          <th class="px-3 py-3">级别</th>
          <th class="px-3 py-3">层级</th>
          <th class="px-3 py-3">标题</th>
          <th class="px-3 py-3">次数</th>
          <th class="px-3 py-3">同类</th>
          <th class="px-3 py-3">最近</th>
          <th class="px-3 py-3">状态</th>
          <th class="px-3 py-3">操作</th>
        </template>
        <template #default="{ rowClass }">
          <tr
            v-for="issue in issues"
            :key="issue.id"
            :class="[rowClass, selectedIssue?.group?.id === issue.id ? 'bg-white/[0.05]' : '']"
          >
            <td class="px-3 py-3">
              <input
                class="admin-issue-checkbox"
                type="checkbox"
                :aria-label="`选择问题 ${issue.title || issue.fingerprint || issue.id}`"
                :checked="selectedIssueIds.includes(issue.id)"
                @change="emit('toggle-issue-selection', [issue, $event.target.checked])"
              >
            </td>
            <td class="px-3 py-3 text-white/80">{{ String(issue.severity || '').toUpperCase() }}</td>
            <td class="px-3 py-3 text-white/70">{{ sourceLayerLabel(issue.source_layer) }}</td>
            <td class="px-3 py-3">
              <button class="admin-issue-title-button" type="button" @click="emit('open-issue', issue)">
                {{ issue.title || issue.fingerprint }}
              </button>
              <div class="mt-1 text-xs text-white/40">{{ issue.latest_request_id || issue.fingerprint }}</div>
            </td>
            <td class="px-3 py-3 text-white/70">{{ issue.event_count || 0 }}</td>
            <td class="px-3 py-3 text-white/60">{{ issue.merged_group_count || 1 }}</td>
            <td class="px-3 py-3 text-white/60">{{ formatDateTime(issue.last_seen_at) }}</td>
            <td class="px-3 py-3">
              <AdminStatusPill :class-name="statusClass(issue.status)">
                {{ statusLabel(issue.status) }}
              </AdminStatusPill>
            </td>
            <td class="px-3 py-3">
              <div class="flex flex-wrap gap-2">
                <AdminMicroButton size="xs" @click="emit('open-issue', issue)">
                  详情
                </AdminMicroButton>
                <AdminMicroButton
                  v-if="canNotifyIssues"
                  size="xs"
                  :disabled="issueActionLoading === `notify:${issue.id}`"
                  @click="emit('notify-issue', issue.id)"
                >
                  通知
                </AdminMicroButton>
              </div>
            </td>
          </tr>
        </template>
      </AdminTableShell>

      <div class="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-white/45">
        <span>第 {{ issuePagination.page || issueQuery.page }} / {{ totalPages }} 页</span>
        <div class="flex gap-2">
          <AdminMicroButton
            :disabled="(issuePagination.page || 1) <= 1"
            @click="emit('update-issue-query', 'page', (issuePagination.page || 1) - 1); emit('load-issues')"
          >
            上一页
          </AdminMicroButton>
          <AdminMicroButton
            :disabled="(issuePagination.page || 1) >= totalPages"
            @click="emit('update-issue-query', 'page', (issuePagination.page || 1) + 1); emit('load-issues')"
          >
            下一页
          </AdminMicroButton>
        </div>
      </div>
    </AdminPanelCard>

    <AdminPanelCard
      title="问题详情"
      :caption="loadingIssueDetail ? '正在加载事件证据' : 'Codex 修复所需的根因线索'"
      panel-class="admin-panel-card rounded-2xl p-4 md:p-5"
    >
      <AdminEmptyState v-if="!selectedIssue">
        选择一个问题查看请求、路由、模型供应商、数据库和示例事件。
      </AdminEmptyState>

      <div v-else class="space-y-4">
        <div>
          <div class="text-sm font-semibold text-white">{{ selectedIssue.group.title }}</div>
          <div class="mt-2 break-all text-xs text-white/45">{{ selectedIssue.group.fingerprint }}</div>
        </div>

        <div class="grid grid-cols-2 gap-3 text-xs">
          <div class="admin-issue-kv">
            <span>根因层级</span>
            <strong>{{ sourceLayerLabel(selectedIssue.group.root_cause_layer || selectedIssue.group.source_layer) }}</strong>
          </div>
          <div class="admin-issue-kv">
            <span>置信度</span>
            <strong>{{ confidenceLabel(selectedIssue.group.root_cause_confidence) }}</strong>
          </div>
          <div class="admin-issue-kv">
            <span>影响用户</span>
            <strong>{{ selectedIssue.group.affected_users || 0 }}</strong>
          </div>
          <div class="admin-issue-kv">
            <span>影响路由</span>
            <strong>{{ selectedIssue.group.affected_routes || 0 }}</strong>
          </div>
          <div class="admin-issue-kv">
            <span>同类合并</span>
            <strong>{{ selectedIssue.group.merged_group_count || 1 }}</strong>
          </div>
          <div class="admin-issue-kv">
            <span>事件数量</span>
            <strong>{{ selectedIssue.group.event_count || 0 }}</strong>
          </div>
        </div>

        <div v-if="canUpdateIssues" class="flex flex-wrap gap-2">
          <AdminMicroButton
            v-for="status in statusOptions"
            :key="status"
            :disabled="selectedIssue.group.status === status || issueActionLoading === `status:${selectedIssue.group.id}`"
            @click="emit('update-issue-status', { issueGroupId: selectedIssue.group.id, status })"
          >
            {{ statusLabel(status) }}
          </AdminMicroButton>
        </div>

        <pre class="admin-issue-json">{{ toPrettyJson(selectedIssue.group.codex_handoff || selectedIssue.group.evidence_summary) }}</pre>

        <div>
          <div class="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-white/45">示例事件</div>
          <div class="space-y-2">
            <div
              v-for="event in selectedIssue.events"
              :key="event.id"
              class="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs text-white/65"
            >
              <div class="flex flex-wrap items-center justify-between gap-2">
                <span>{{ formatDateTime(event.created_at) }}</span>
                <span>{{ event.request_id || event.error_code || '-' }}</span>
              </div>
              <div class="mt-2">{{ event.message_summary || event.path_template || event.route || '-' }}</div>
            </div>
          </div>
        </div>

        <div v-if="lastExport" class="break-all rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs text-white/55">
          最近导出：{{ lastExport.markdownFileName || lastExport.jsonFileName || lastExport.markdownPath || lastExport.jsonPath }}
        </div>
      </div>
    </AdminPanelCard>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import AdminControlField from '@/components/admin/AdminControlField.vue'
import AdminEmptyState from '@/components/admin/AdminEmptyState.vue'
import AdminFilterField from '@/components/admin/AdminFilterField.vue'
import AdminFilterToolbar from '@/components/admin/AdminFilterToolbar.vue'
import AdminMicroButton from '@/components/admin/AdminMicroButton.vue'
import AdminPanelCard from '@/components/admin/AdminPanelCard.vue'
import AdminSectionHeader from '@/components/admin/AdminSectionHeader.vue'
import AdminStatusPill from '@/components/admin/AdminStatusPill.vue'
import AdminTableShell from '@/components/admin/AdminTableShell.vue'

const emit = defineEmits([
  'export-issues',
  'load-issues',
  'notify-issue',
  'open-issue',
  'toggle-all-issue-selection',
  'toggle-issue-selection',
  'update-auto-resolve-exported-issues',
  'update-issue-query',
  'update-issue-status'
])

const props = defineProps({
  allVisibleIssuesSelected: { type: Boolean, default: false },
  autoResolveExportedIssues: { type: Boolean, default: true },
  canExportIssues: { type: Boolean, default: false },
  canNotifyIssues: { type: Boolean, default: false },
  canReadIssues: { type: Boolean, default: false },
  canUpdateIssues: { type: Boolean, default: false },
  formatDateTime: { type: Function, default: (value) => value || '-' },
  issueActionLoading: { type: String, default: '' },
  issuePagination: { type: Object, default: () => ({ page: 1, limit: 20, total: 0 }) },
  issueQuery: { type: Object, default: () => ({ status: 'open', severity: '', source_layer: '', page: 1, limit: 20 }) },
  issues: { type: Array, default: () => [] },
  lastExport: { type: Object, default: null },
  loadingIssueDetail: { type: Boolean, default: false },
  loadingIssues: { type: Boolean, default: false },
  selectedIssue: { type: Object, default: null },
  selectedExportGroupIds: { type: Array, default: () => [] },
  selectedIssueCount: { type: Number, default: 0 },
  selectedIssueIds: { type: Array, default: () => [] },
  toPrettyJson: { type: Function, default: (value) => JSON.stringify(value || {}, null, 2) }
})

const statusOptions = ['open', 'investigating', 'resolved', 'ignored']
const totalPages = computed(() => Math.max(1, Math.ceil(Number(props.issuePagination.total || 0) / Number(props.issuePagination.limit || 20))))

const STATUS_LABELS = {
  open: '待处理',
  investigating: '处理中',
  resolved: '已解决',
  ignored: '已忽略'
}

const SOURCE_LAYER_LABELS = {
  frontend: '前端',
  backend: '后端',
  database: '数据库',
  provider: '模型供应商',
  performance: '性能',
  ux: '交互体验'
}

const CONFIDENCE_LABELS = {
  high: '高',
  medium: '中',
  low: '低',
  unknown: '未知'
}

const statusLabel = (status) => STATUS_LABELS[status] || '待处理'
const sourceLayerLabel = (sourceLayer) => SOURCE_LAYER_LABELS[sourceLayer] || sourceLayer || '-'
const confidenceLabel = (confidence) => CONFIDENCE_LABELS[confidence] || confidence || '-'

const statusClass = (status) => {
  if (status === 'resolved') return 'ui-status-pill-active'
  if (status === 'ignored') return 'ui-status-pill-deleted'
  if (status === 'investigating') return 'ui-status-pill-suspended'
  return ''
}
</script>

<style scoped>
.admin-issue-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 20px;
  min-width: 0;
}

.admin-issue-layout :deep(.admin-panel-card) {
  min-width: 0;
}

.admin-issue-title-button {
  color: rgb(255 255 255 / 86%);
  text-align: left;
}

.admin-issue-title-button:hover {
  color: #fff;
}

.admin-issue-toolbar {
  display: grid;
  width: 100%;
  gap: 10px;
  border: 1px solid rgb(255 255 255 / 8%);
  border-radius: 10px;
  padding: 12px;
  background: rgb(255 255 255 / 2.5%);
}

.admin-issue-filter-group {
  justify-content: flex-start;
  gap: 10px;
}

.admin-issue-filter-group :deep(.admin-filter-field) {
  flex: 0 1 156px;
}

.admin-issue-filter-group :deep(.ui-text-input),
.admin-issue-filter-group :deep(.ui-micro-btn),
.admin-issue-action-group :deep(.ui-micro-btn),
.admin-issue-batch-summary,
.admin-issue-auto-resolve {
  min-height: 38px;
}

.admin-issue-action-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  min-width: 0;
}

.admin-issue-batch-summary,
.admin-issue-auto-resolve {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border-radius: 10px;
  border: 1px solid rgb(255 255 255 / 12%);
  padding: 8px 10px;
  color: rgb(255 255 255 / 58%);
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
}

.admin-issue-batch-summary {
  color: rgb(255 255 255 / 48%);
  background: rgb(255 255 255 / 3%);
}

.admin-issue-checkbox {
  width: 15px;
  height: 15px;
  margin: 0;
  accent-color: rgb(255 255 255 / 82%);
}

.admin-issue-kv {
  border: 1px solid rgb(255 255 255 / 10%);
  border-radius: 8px;
  padding: 10px;
  background: rgb(255 255 255 / 4%);
}

.admin-issue-kv span {
  display: block;
  color: rgb(255 255 255 / 42%);
}

.admin-issue-kv strong {
  display: block;
  margin-top: 4px;
  color: rgb(255 255 255 / 84%);
}

.admin-issue-json {
  max-height: 280px;
  overflow: auto;
  border: 1px solid rgb(255 255 255 / 10%);
  border-radius: 8px;
  padding: 12px;
  color: rgb(255 255 255 / 70%);
  background: rgb(0 0 0 / 22%);
  font-size: 11px;
  line-height: 1.6;
  white-space: pre-wrap;
}

@media (max-width: 900px) {
  .admin-issue-toolbar {
    padding: 10px;
  }

  .admin-issue-filter-group {
    justify-content: flex-start;
  }

  .admin-issue-filter-group :deep(.admin-filter-field) {
    flex: 1 1 150px;
  }

  .admin-issue-action-group {
    justify-content: flex-start;
  }
}

@media (min-width: 1600px) {
  .admin-issue-layout {
    grid-template-columns: minmax(0, 1.25fr) minmax(340px, 0.75fr);
  }
}
</style>
