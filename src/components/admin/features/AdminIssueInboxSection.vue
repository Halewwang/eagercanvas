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
      <AdminMicroButton size="md" :disabled="loadingIssues" @click="emit('load-issues')">刷新</AdminMicroButton>
    </AdminFilterToolbar>

    <div class="admin-issue-action-group">
      <div class="admin-issue-batch-group">
        <span v-if="canExportIssues" class="admin-issue-batch-summary">
          已选 {{ selectedIssueCount }} 项 · 导出 {{ selectedExportGroupCount }} 组
        </span>
      </div>
      <div class="admin-issue-export-group">
        <AdminMicroButton
          v-if="canExportIssues && canNotifyIssues"
          size="md"
          :disabled="issueActionLoading === 'send-email' || issueActionLoading === 'export'"
          @click="emit('send-issue-digest-email')"
        >
          发送当前筛选到邮箱
        </AdminMicroButton>
        <AdminMicroButton
          v-if="canExportIssues"
          size="md"
          :disabled="selectedIssueCount <= 0 || issueActionLoading === 'export'"
          @click="emit('export-issues', { selectedOnly: true })"
        >
          导出选中
        </AdminMicroButton>
        <AdminMicroButton
          v-if="canExportIssues"
          size="md"
          tone="primary"
          :disabled="issueActionLoading === 'export'"
          @click="emit('export-issues')"
        >
          导出当前筛选
        </AdminMicroButton>
      </div>
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
      <AdminTableShell v-else min-width-class="min-w-[980px] table-fixed">
        <template #header>
          <th class="admin-issue-check-column px-3 py-3">
            <input
              class="admin-issue-checkbox"
              type="checkbox"
              aria-label="选择当前筛选所有问题"
              :checked="allVisibleIssuesSelected"
              :disabled="loadingIssues || issues.length === 0"
              @change="emit('toggle-all-issue-selection', $event.target.checked)"
            >
          </th>
          <th class="admin-issue-severity-column px-3 py-3">级别</th>
          <th class="admin-issue-layer-column px-3 py-3">层级</th>
          <th class="admin-issue-title-column px-3 py-3">标题</th>
          <th class="admin-issue-count-column px-3 py-3">次数</th>
          <th class="admin-issue-merged-column px-3 py-3">同类</th>
          <th class="admin-issue-date-column px-3 py-3">最近</th>
          <th class="admin-issue-status-column px-3 py-3">状态</th>
          <th class="admin-issue-actions-column px-3 py-3">操作</th>
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
            <td class="admin-issue-title-cell px-3 py-3">
              <button
                class="admin-issue-title-button"
                type="button"
                :title="issue.title || issue.fingerprint"
                @click="emit('open-issue', issue)"
              >
                {{ issue.title || issue.fingerprint }}
              </button>
              <div class="admin-issue-request-id mt-1 text-xs text-white/40" :title="issue.latest_request_id || issue.fingerprint">
                {{ issue.latest_request_id || issue.fingerprint }}
              </div>
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
              <div class="admin-issue-row-actions">
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

      <AdminPaginationBar
        v-if="issues.length > 0"
        :page="issueListPage"
        :limit="issueListLimit"
        :total="issueListTotal"
        :loading="loadingIssues"
        item-label="组"
        @set-page="setIssueListPage"
      />
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
              v-for="event in visibleIssueEvents"
              :key="event.id"
              class="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs text-white/65"
            >
              <div class="flex flex-wrap items-center justify-between gap-2">
                <span>{{ formatDateTime(event.created_at) }}</span>
                <span>{{ event.request_id || event.error_code || '-' }}</span>
              </div>
              <div class="mt-2">{{ event.message_summary || event.path_template || event.route || '-' }}</div>
              <pre
                v-if="hasEventDiagnostics(event)"
                class="admin-issue-event-diagnostics"
              >{{ toPrettyJson(getEventDiagnostics(event)) }}</pre>
            </div>
          </div>
          <AdminPaginationBar
            v-if="selectedIssueEvents.length > ISSUE_EVENT_PAGE_SIZE"
            :page="eventPage"
            :limit="ISSUE_EVENT_PAGE_SIZE"
            :total="selectedIssueEvents.length"
            item-label="条事件"
            @set-page="setIssueEventPage"
          />
        </div>

        <div v-if="lastExport" class="break-all rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs text-white/55">
          最近导出：{{ lastExport.markdownFileName || lastExport.jsonFileName || lastExport.markdownPath || lastExport.jsonPath }}
        </div>
      </div>
    </AdminPanelCard>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import AdminControlField from '@/components/admin/AdminControlField.vue'
import AdminEmptyState from '@/components/admin/AdminEmptyState.vue'
import AdminFilterField from '@/components/admin/AdminFilterField.vue'
import AdminFilterToolbar from '@/components/admin/AdminFilterToolbar.vue'
import AdminMicroButton from '@/components/admin/AdminMicroButton.vue'
import AdminPaginationBar from '@/components/admin/AdminPaginationBar.vue'
import AdminPanelCard from '@/components/admin/AdminPanelCard.vue'
import AdminSectionHeader from '@/components/admin/AdminSectionHeader.vue'
import AdminStatusPill from '@/components/admin/AdminStatusPill.vue'
import AdminTableShell from '@/components/admin/AdminTableShell.vue'

const emit = defineEmits([
  'export-issues',
  'load-issues',
  'notify-issue',
  'open-issue',
  'send-issue-digest-email',
  'toggle-all-issue-selection',
  'toggle-issue-selection',
  'update-issue-query',
  'update-issue-status'
])

const props = defineProps({
  allVisibleIssuesSelected: { type: Boolean, default: false },
  canExportIssues: { type: Boolean, default: false },
  canNotifyIssues: { type: Boolean, default: false },
  canReadIssues: { type: Boolean, default: false },
  canUpdateIssues: { type: Boolean, default: false },
  formatDateTime: { type: Function, default: (value) => value || '-' },
  issueActionLoading: { type: String, default: '' },
  issuePagination: { type: Object, default: () => ({ page: 1, limit: 10, total: 0 }) },
  issueQuery: { type: Object, default: () => ({ status: 'open', severity: '', source_layer: '', page: 1, limit: 10 }) },
  issues: { type: Array, default: () => [] },
  lastExport: { type: Object, default: null },
  loadingIssueDetail: { type: Boolean, default: false },
  loadingIssues: { type: Boolean, default: false },
  selectedIssue: { type: Object, default: null },
  selectedExportGroupCount: { type: Number, default: 0 },
  selectedExportGroupIds: { type: Array, default: () => [] },
  selectedIssueCount: { type: Number, default: 0 },
  selectedIssueIds: { type: Array, default: () => [] },
  toPrettyJson: { type: Function, default: (value) => JSON.stringify(value || {}, null, 2) }
})

const ISSUE_EVENT_PAGE_SIZE = 4
const statusOptions = ['open', 'investigating', 'resolved', 'ignored']
const eventPage = ref(1)
const issueListPage = computed(() => Number(props.issuePagination.page || props.issueQuery.page || 1))
const issueListLimit = computed(() => Number(props.issuePagination.limit || props.issueQuery.limit || 10))
const issueListTotal = computed(() => Number(props.issuePagination.total || props.issues.length || 0))
const selectedIssueEvents = computed(() => (Array.isArray(props.selectedIssue?.events) ? props.selectedIssue.events : []))
const issueEventTotalPages = computed(() => Math.max(1, Math.ceil(selectedIssueEvents.value.length / ISSUE_EVENT_PAGE_SIZE)))
const visibleIssueEvents = computed(() => {
  const start = (eventPage.value - 1) * ISSUE_EVENT_PAGE_SIZE
  return selectedIssueEvents.value.slice(start, start + ISSUE_EVENT_PAGE_SIZE)
})

const setIssueListPage = (page) => {
  emit('update-issue-query', 'page', page)
  emit('load-issues')
}

const setIssueEventPage = (page) => {
  const parsed = Number(page)
  eventPage.value = Number.isFinite(parsed)
    ? Math.max(1, Math.min(issueEventTotalPages.value, parsed))
    : 1
}

watch(() => props.selectedIssue?.group?.id, () => {
  eventPage.value = 1
})

watch(selectedIssueEvents, () => {
  if (eventPage.value > issueEventTotalPages.value) eventPage.value = issueEventTotalPages.value
})

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

const isPlainObject = (value) => value && typeof value === 'object' && !Array.isArray(value)

const getEventDiagnostics = (event = {}) => {
  const metadata = isPlainObject(event.metadata) ? event.metadata : null
  if (!metadata) return null
  return isPlainObject(metadata.details) ? metadata.details : metadata
}

const hasEventDiagnostics = (event = {}) => {
  const diagnostics = getEventDiagnostics(event)
  return isPlainObject(diagnostics) && Object.keys(diagnostics).length > 0
}

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
  display: block;
  max-width: 100%;
  overflow: hidden;
  color: rgb(255 255 255 / 86%);
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.admin-issue-title-button:hover {
  color: #fff;
}

.admin-issue-check-column {
  width: 44px;
}

.admin-issue-severity-column,
.admin-issue-count-column,
.admin-issue-merged-column {
  width: 64px;
}

.admin-issue-layer-column,
.admin-issue-status-column {
  width: 88px;
}

.admin-issue-date-column {
  width: 150px;
}

.admin-issue-actions-column {
  width: 168px;
}

.admin-issue-title-column,
.admin-issue-title-cell {
  width: 320px;
  max-width: 320px;
  min-width: 0;
}

.admin-issue-request-id {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.admin-issue-row-actions {
  display: flex;
  flex-wrap: nowrap;
  gap: 8px;
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
  flex: 1 1 180px;
  min-width: 150px;
}

.admin-issue-filter-group :deep(.ui-text-input),
.admin-issue-filter-group :deep(.ui-micro-btn),
.admin-issue-action-group :deep(.ui-micro-btn),
.admin-issue-batch-summary {
  min-height: 38px;
}

.admin-issue-action-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
}

.admin-issue-batch-group,
.admin-issue-export-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.admin-issue-export-group {
  justify-content: flex-end;
}

.admin-issue-batch-summary {
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

.admin-issue-event-diagnostics {
  max-height: 180px;
  overflow: auto;
  margin-top: 10px;
  border: 1px solid rgb(255 255 255 / 10%);
  border-radius: 8px;
  padding: 10px;
  color: rgb(255 255 255 / 64%);
  background: rgb(0 0 0 / 18%);
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

  .admin-issue-batch-group,
  .admin-issue-export-group {
    width: 100%;
    justify-content: flex-start;
  }
}

@media (min-width: 1600px) {
  .admin-issue-layout {
    grid-template-columns: minmax(0, 1.25fr) minmax(340px, 0.75fr);
  }
}
</style>
