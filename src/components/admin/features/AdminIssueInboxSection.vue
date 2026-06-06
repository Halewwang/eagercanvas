<template>
  <AdminSectionHeader
    class="mb-5"
    title="问题收件箱"
    caption="汇总线上报错、慢请求、Provider/DB 异常和前端运行问题，供 Codex 定位修复。"
  >
    <template #actions>
      <div class="admin-issue-toolbar">
        <select
          class="admin-issue-select"
          :value="issueQuery.status"
          @change="emit('update-issue-query', 'status', $event.target.value)"
        >
          <option value="">全部状态</option>
          <option value="open">Open</option>
          <option value="investigating">Investigating</option>
          <option value="resolved">Resolved</option>
          <option value="ignored">Ignored</option>
        </select>
        <select
          class="admin-issue-select"
          :value="issueQuery.severity"
          @change="emit('update-issue-query', 'severity', $event.target.value)"
        >
          <option value="">全部级别</option>
          <option value="p0">P0</option>
          <option value="p1">P1</option>
          <option value="p2">P2</option>
          <option value="p3">P3</option>
        </select>
        <select
          class="admin-issue-select"
          :value="issueQuery.source_layer"
          @change="emit('update-issue-query', 'source_layer', $event.target.value)"
        >
          <option value="">全部层级</option>
          <option value="frontend">Frontend</option>
          <option value="backend">Backend</option>
          <option value="database">Database</option>
          <option value="provider">Provider</option>
          <option value="performance">Performance</option>
          <option value="ux">UX</option>
        </select>
        <button class="admin-issue-button" type="button" :disabled="loadingIssues" @click="emit('load-issues')">
          刷新
        </button>
        <button
          v-if="canExportIssues"
          class="admin-issue-button"
          type="button"
          :disabled="issueActionLoading === 'export'"
          @click="emit('export-issues')"
        >
          导出 Codex
        </button>
      </div>
    </template>
  </AdminSectionHeader>

  <AdminEmptyState v-if="!canReadIssues">
    当前角色没有问题收件箱读取权限。
  </AdminEmptyState>

  <div v-else class="admin-issue-layout">
    <AdminPanelCard
      :title="`问题列表 (${issuePagination.total || issues.length})`"
      :caption="loadingIssues ? '正在加载最新问题分组' : '按 fingerprint 聚合后的问题分组'"
      panel-class="admin-panel-card rounded-2xl p-4 md:p-5"
    >
      <AdminEmptyState v-if="!loadingIssues && issues.length === 0">暂无 Issue 分组</AdminEmptyState>
      <AdminTableShell v-else min-width-class="min-w-[760px]">
        <template #header>
          <th class="px-3 py-3">级别</th>
          <th class="px-3 py-3">层级</th>
          <th class="px-3 py-3">标题</th>
          <th class="px-3 py-3">次数</th>
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
            <td class="px-3 py-3 text-white/80">{{ String(issue.severity || '').toUpperCase() }}</td>
            <td class="px-3 py-3 text-white/70">{{ issue.source_layer || '-' }}</td>
            <td class="px-3 py-3">
              <button class="admin-issue-title-button" type="button" @click="emit('open-issue', issue.id)">
                {{ issue.title || issue.fingerprint }}
              </button>
              <div class="mt-1 text-xs text-white/40">{{ issue.latest_request_id || issue.fingerprint }}</div>
            </td>
            <td class="px-3 py-3 text-white/70">{{ issue.event_count || 0 }}</td>
            <td class="px-3 py-3 text-white/60">{{ formatDateTime(issue.last_seen_at) }}</td>
            <td class="px-3 py-3">
              <AdminStatusPill :class-name="statusClass(issue.status)">
                {{ issue.status || 'open' }}
              </AdminStatusPill>
            </td>
            <td class="px-3 py-3">
              <div class="flex flex-wrap gap-2">
                <button class="admin-issue-link" type="button" @click="emit('open-issue', issue.id)">
                  详情
                </button>
                <button
                  v-if="canNotifyIssues"
                  class="admin-issue-link"
                  type="button"
                  :disabled="issueActionLoading === `notify:${issue.id}`"
                  @click="emit('notify-issue', issue.id)"
                >
                  通知
                </button>
              </div>
            </td>
          </tr>
        </template>
      </AdminTableShell>

      <div class="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-white/45">
        <span>Page {{ issuePagination.page || issueQuery.page }} / {{ totalPages }}</span>
        <div class="flex gap-2">
          <button
            class="admin-issue-button"
            type="button"
            :disabled="(issuePagination.page || 1) <= 1"
            @click="emit('update-issue-query', 'page', (issuePagination.page || 1) - 1); emit('load-issues')"
          >
            上一页
          </button>
          <button
            class="admin-issue-button"
            type="button"
            :disabled="(issuePagination.page || 1) >= totalPages"
            @click="emit('update-issue-query', 'page', (issuePagination.page || 1) + 1); emit('load-issues')"
          >
            下一页
          </button>
        </div>
      </div>
    </AdminPanelCard>

    <AdminPanelCard
      title="问题详情"
      :caption="loadingIssueDetail ? '正在加载事件证据' : 'Codex 修复所需的根因线索'"
      panel-class="admin-panel-card rounded-2xl p-4 md:p-5"
    >
      <AdminEmptyState v-if="!selectedIssue">
        选择一个问题查看 request、route、provider、database 和 sample events。
      </AdminEmptyState>

      <div v-else class="space-y-4">
        <div>
          <div class="text-sm font-semibold text-white">{{ selectedIssue.group.title }}</div>
          <div class="mt-2 break-all text-xs text-white/45">{{ selectedIssue.group.fingerprint }}</div>
        </div>

        <div class="grid grid-cols-2 gap-3 text-xs">
          <div class="admin-issue-kv">
            <span>Root</span>
            <strong>{{ selectedIssue.group.root_cause_layer || selectedIssue.group.source_layer || '-' }}</strong>
          </div>
          <div class="admin-issue-kv">
            <span>Confidence</span>
            <strong>{{ selectedIssue.group.root_cause_confidence || '-' }}</strong>
          </div>
          <div class="admin-issue-kv">
            <span>Users</span>
            <strong>{{ selectedIssue.group.affected_users || 0 }}</strong>
          </div>
          <div class="admin-issue-kv">
            <span>Routes</span>
            <strong>{{ selectedIssue.group.affected_routes || 0 }}</strong>
          </div>
        </div>

        <div v-if="canUpdateIssues" class="flex flex-wrap gap-2">
          <button
            v-for="status in statusOptions"
            :key="status"
            class="admin-issue-button"
            type="button"
            :disabled="selectedIssue.group.status === status || issueActionLoading === `status:${selectedIssue.group.id}`"
            @click="emit('update-issue-status', { issueGroupId: selectedIssue.group.id, status })"
          >
            {{ status }}
          </button>
        </div>

        <pre class="admin-issue-json">{{ toPrettyJson(selectedIssue.group.codex_handoff || selectedIssue.group.evidence_summary) }}</pre>

        <div>
          <div class="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-white/45">Sample Events</div>
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
          最近导出：{{ lastExport.markdownPath || lastExport.jsonPath }}
        </div>
      </div>
    </AdminPanelCard>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import AdminEmptyState from '@/components/admin/AdminEmptyState.vue'
import AdminPanelCard from '@/components/admin/AdminPanelCard.vue'
import AdminSectionHeader from '@/components/admin/AdminSectionHeader.vue'
import AdminStatusPill from '@/components/admin/AdminStatusPill.vue'
import AdminTableShell from '@/components/admin/AdminTableShell.vue'

const emit = defineEmits([
  'export-issues',
  'load-issues',
  'notify-issue',
  'open-issue',
  'update-issue-query',
  'update-issue-status'
])

const props = defineProps({
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
  toPrettyJson: { type: Function, default: (value) => JSON.stringify(value || {}, null, 2) }
})

const statusOptions = ['open', 'investigating', 'resolved', 'ignored']
const totalPages = computed(() => Math.max(1, Math.ceil(Number(props.issuePagination.total || 0) / Number(props.issuePagination.limit || 20))))

const statusClass = (status) => {
  if (status === 'resolved') return 'ui-status-pill-active'
  if (status === 'ignored') return 'ui-status-pill-deleted'
  if (status === 'investigating') return 'ui-status-pill-suspended'
  return ''
}
</script>

<style scoped>
.admin-issue-select,
.admin-issue-button {
  min-width: 0;
  min-height: 32px;
  border: 1px solid rgb(255 255 255 / 12%);
  border-radius: 8px;
  padding: 0 10px;
  color: rgb(255 255 255 / 82%);
  background: rgb(255 255 255 / 6%);
  font-size: 12px;
}

.admin-issue-toolbar {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  max-width: 100%;
}

.admin-issue-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 20px;
  min-width: 0;
}

.admin-issue-layout :deep(.admin-panel-card) {
  min-width: 0;
}

.admin-issue-button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.admin-issue-title-button,
.admin-issue-link {
  color: rgb(255 255 255 / 86%);
  text-align: left;
}

.admin-issue-title-button:hover,
.admin-issue-link:hover {
  color: #fff;
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

@media (min-width: 1600px) {
  .admin-issue-layout {
    grid-template-columns: minmax(0, 1.25fr) minmax(340px, 0.75fr);
  }
}
</style>
