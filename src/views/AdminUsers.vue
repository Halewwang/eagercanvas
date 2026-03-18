<template>
  <div ref="adminShellRef" class="admin-shell min-h-screen overflow-y-auto px-3 py-4 md:px-6 md:py-6">
    <div class="admin-frame w-full rounded-[20px] border border-white/10">
      <div class="grid grid-cols-1 lg:grid-cols-[260px_1fr]">
        <aside class="admin-sidebar hidden self-start border-r border-white/10 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
          <div class="px-5 pt-5">
            <div class="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
              <p class="text-xs uppercase tracking-[0.18em] text-white/45">EagerCanvas</p>
              <p class="mt-1 text-sm font-medium text-white/90">Admin Console</p>
              <p class="mt-3 text-xs leading-5 text-white/55">Permission-aware control center for members, usage and service operations.</p>
            </div>
          </div>

          <nav class="mt-6 space-y-1 px-4">
            <button
              v-for="item in navItems"
              :key="item.key"
              class="menu-item"
              :class="{ 'menu-item-active': activeSection === item.key }"
              @click="scrollToSection(item.key)"
            >
              <span>{{ item.label }}</span>
              <span class="menu-item-note">{{ item.note }}</span>
            </button>
          </nav>

          <div class="mt-6 px-4">
            <div class="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p class="text-xs uppercase tracking-[0.16em] text-white/45">Access Scope</p>
              <div class="mt-3 flex flex-wrap gap-2">
                <span v-for="item in accessScope" :key="item" class="permission-chip">{{ item }}</span>
              </div>
            </div>
          </div>

          <div class="mt-auto p-4">
            <div class="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p class="text-sm font-medium text-white/90">Operator Session</p>
              <p class="mt-2 text-xs text-white/55">{{ adminAccountLabel }}</p>
              <p class="mt-1 text-xs text-white/45">{{ auth.roles.value.join(', ') || 'No role loaded' }}</p>
            </div>
          </div>
        </aside>

        <main class="admin-main p-5 md:p-7">
          <div class="mb-4 flex flex-wrap gap-2 lg:hidden">
            <button
              v-for="item in navItems"
              :key="`mobile-${item.key}`"
              class="ui-micro-btn"
              :class="{ 'ui-micro-btn-primary': activeSection === item.key }"
              @click="scrollToSection(item.key)"
            >
              {{ item.label }}
            </button>
          </div>

          <header class="mb-8 border-b border-white/10 pb-6">
            <div class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div class="max-w-3xl">
                <p class="text-xs uppercase tracking-[0.2em] text-white/45">Admin Dashboard</p>
                <h1 class="mt-2 text-2xl font-semibold text-white md:text-3xl">Welcome Back, {{ displayName }}</h1>
                <p class="mt-3 text-sm leading-6 text-white/55">
                  当前页面会按权限显示可管理区块，并且只请求当前角色可访问的数据，避免进入后台即触发无效接口。
                </p>
                <div class="mt-4 flex flex-wrap gap-2">
                  <span v-for="item in accessScope" :key="`scope-${item}`" class="permission-chip">{{ item }}</span>
                </div>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <button class="ui-action-btn" :disabled="isRefreshing" @click="loadAll">
                  {{ isRefreshing ? 'Refreshing...' : 'Refresh Visible Data' }}
                </button>
                <button v-if="canReadUsers" class="ui-action-btn" @click="scrollToSection('users')">Manage Users</button>
                <button v-if="showServiceSection" class="ui-action-btn" @click="scrollToSection('service')">Service Ops</button>
                <button class="ui-action-btn" @click="goHome">Back</button>
              </div>
            </div>
          </header>

          <section ref="overviewRef" class="mb-8 scroll-mt-6">
            <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 class="section-title">Overview</h2>
                <p class="section-caption">核心指标、权限摘要和常用操作入口。</p>
              </div>
              <button class="ui-micro-btn" :disabled="loadingOverview" @click="refreshOverview">
                {{ loadingOverview ? 'Refreshing...' : 'Refresh Overview' }}
              </button>
            </div>

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
              <article v-for="card in cards" :key="card.label" class="ui-glass-card rounded-2xl p-4">
                <p class="text-[11px] uppercase tracking-[0.16em] text-white/40">{{ card.label }}</p>
                <p class="mt-3 text-3xl font-semibold text-white">{{ card.value }}</p>
                <p class="mt-2 text-xs text-white/55">{{ card.note }}</p>
              </article>
            </div>

            <div class="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-[1.5fr_1fr]">
              <div class="ui-glass-card rounded-2xl p-4 md:p-5">
                <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 class="text-lg font-medium text-white">Usage Trend</h3>
                    <p class="mt-1 text-xs text-white/45">最近日级请求量视图</p>
                  </div>
                  <span class="text-xs text-white/45">Updated {{ nowLabel }}</span>
                </div>

                <div v-if="!canReadUsage" class="empty-notice">
                  当前角色没有全局用量读取权限，已跳过相关接口请求。
                </div>
                <div v-else-if="usageSeries.length === 0" class="empty-notice">
                  No usage data
                </div>
                <div v-else class="space-y-3">
                  <div v-for="row in usageSeries" :key="row.date" class="grid grid-cols-[90px_1fr_80px] items-center gap-3">
                    <span class="text-xs text-white/55">{{ row.date }}</span>
                    <div class="h-2 overflow-hidden rounded bg-white/10">
                      <div class="h-full rounded bg-white/50" :style="{ width: `${barWidth(row.total_calls)}%` }" />
                    </div>
                    <span class="text-right text-xs text-white/75">{{ row.total_calls }}</span>
                  </div>
                </div>
              </div>

              <div class="space-y-5">
                <div class="ui-glass-card rounded-2xl p-4 md:p-5">
                  <h3 class="text-lg font-medium text-white">Admin Session</h3>
                  <div class="mt-4 space-y-3 text-sm">
                    <div class="ui-info-line"><span>Account</span><strong>{{ adminAccountLabel }}</strong></div>
                    <div class="ui-info-line"><span>Roles</span><strong>{{ auth.roles.value.join(', ') || '-' }}</strong></div>
                    <div class="ui-info-line"><span>Permissions</span><strong>{{ auth.permissions.value.length }}</strong></div>
                    <div class="ui-info-line"><span>Status</span><strong class="text-white">Active</strong></div>
                  </div>
                </div>

                <div class="ui-glass-card rounded-2xl p-4 md:p-5">
                  <h3 class="text-lg font-medium text-white">Quick Actions</h3>
                  <div class="mt-4 grid grid-cols-1 gap-2">
                    <button v-if="canReadUsers" class="ui-micro-btn text-left" @click="scrollToSection('users')">Open user governance</button>
                    <button v-if="showServiceSection" class="ui-micro-btn text-left" @click="scrollToSection('service')">Open service operations</button>
                    <button v-if="canReadAudit" class="ui-micro-btn text-left" @click="scrollToSection('audit')">Open audit trail</button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section v-if="canReadUsers" ref="usersRef" class="ui-glass-card mb-8 scroll-mt-6 rounded-2xl p-5 md:p-6">
            <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 class="section-title">Users & Roles</h2>
                <p class="section-caption">搜索、筛选、角色调整和账号状态操作。</p>
              </div>
              <button class="ui-micro-btn" :disabled="loadingUsers" @click="loadUsers">
                {{ loadingUsers ? 'Refreshing...' : 'Refresh Users' }}
              </button>
            </div>

            <div class="mb-4 flex flex-wrap gap-2">
              <span class="summary-pill">Active {{ userStats.active }}</span>
              <span class="summary-pill">Suspended {{ userStats.suspended }}</span>
              <span class="summary-pill">Deleted {{ userStats.deleted }}</span>
              <span class="summary-pill">Visible {{ filteredUsers.length }}</span>
            </div>

            <div class="mb-4 grid grid-cols-1 gap-3 xl:grid-cols-[1fr_170px_auto] xl:items-end">
              <div>
                <p class="mb-2 text-xs uppercase tracking-[0.12em] text-white/45">Search User</p>
                <input
                  v-model.trim="userSearchQuery"
                  class="ui-text-input"
                  placeholder="Search by user id, email or display name"
                />
              </div>
              <div>
                <p class="mb-2 text-xs uppercase tracking-[0.12em] text-white/45">Status</p>
                <select v-model="userStatusFilter" class="ui-text-input">
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="deleted">Deleted</option>
                </select>
              </div>
              <p class="text-xs text-white/55">
                Showing {{ userPageStart }}-{{ userPageEnd }} of {{ filteredUsers.length }} users
              </p>
            </div>

            <div v-if="filteredUsers.length === 0" class="empty-notice">
              {{ users.length === 0 ? 'No user data' : 'No matched users' }}
            </div>
            <div v-else class="overflow-x-auto">
              <table class="w-full min-w-[1380px] text-sm">
                <thead>
                  <tr class="border-b border-white/10 text-left text-xs uppercase tracking-[0.12em] text-white/40">
                    <th class="px-3 py-4">User</th>
                    <th class="px-3 py-4">Status</th>
                    <th class="px-3 py-4">Roles</th>
                    <th class="px-3 py-4">Calls</th>
                    <th v-if="showAssignmentsColumn" class="px-3 py-4">Assigned Keys</th>
                    <th v-if="canManageRoles" class="px-3 py-4">Role Editor</th>
                    <th v-if="showUserActions" class="px-3 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in pagedUsers" :key="item.id" class="border-b border-white/5 align-top hover:bg-white/[0.03]">
                    <td class="px-3 py-4">
                      <p class="font-medium text-white/90">{{ item.displayName || '-' }}</p>
                      <p class="text-xs text-white/50">{{ item.email }}</p>
                      <p class="mt-1 text-[11px] text-white/35">ID: {{ item.id }}</p>
                    </td>
                    <td class="px-3 py-4">
                      <span class="ui-status-pill" :class="statusClass(item.status)">{{ item.status || 'active' }}</span>
                      <p v-if="item.suspendedReason" class="mt-2 max-w-[180px] text-[11px] leading-5 text-white/45">
                        {{ item.suspendedReason }}
                      </p>
                    </td>
                    <td class="px-3 py-4">
                      <div class="flex flex-wrap gap-1.5">
                        <span v-for="role in item.roles || []" :key="`${item.id}-${role}`" class="ui-tag-pill">{{ role }}</span>
                      </div>
                    </td>
                    <td class="px-3 py-4 text-white/85">
                      <p>{{ item.usage?.totalCalls || 0 }}</p>
                      <p class="mt-1 text-xs text-white/45">{{ Number(item.usage?.totalCostUsd || 0).toFixed(4) }} USD</p>
                    </td>
                    <td v-if="showAssignmentsColumn" class="px-3 py-4">
                      <div class="flex flex-wrap gap-2">
                        <span
                          v-for="assigned in item.assignedApiKeys || []"
                          :key="`${item.id}-${assigned.apiName}`"
                          class="assignment-pill"
                        >
                          {{ assigned.apiName }}
                          <button
                            v-if="canAssignApiKeys"
                            class="assignment-pill-action"
                            :disabled="assignmentLoading[item.id] || item.status === 'deleted'"
                            @click="unassignApiKey(item, assigned.apiName)"
                          >
                            x
                          </button>
                        </span>
                        <span v-if="!(item.assignedApiKeys || []).length" class="text-xs text-white/45">No key assigned</span>
                      </div>
                    </td>
                    <td v-if="canManageRoles" class="px-3 py-4">
                      <div class="space-y-3">
                        <div class="flex max-w-[280px] flex-wrap gap-2">
                          <label
                            v-for="role in roleOptions"
                            :key="`${item.id}-${role}`"
                            class="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-xs text-white/65"
                          >
                            <input
                              type="checkbox"
                              :checked="isSelected(item.id, role)"
                              :disabled="item.status === 'deleted' || isSelf(item)"
                              @change="toggleRole(item.id, role, $event)"
                            />
                            {{ role }}
                          </label>
                        </div>
                        <button
                          class="ui-micro-btn ui-micro-btn-primary"
                          :disabled="saving[item.id] || item.status === 'deleted' || isSelf(item)"
                          @click="saveRoles(item)"
                        >
                          {{ saving[item.id] ? 'Saving...' : (isSelf(item) ? 'Self Locked' : 'Save Roles') }}
                        </button>
                      </div>
                    </td>
                    <td v-if="showUserActions" class="px-3 py-4">
                      <div class="user-action-stack">
                        <div v-if="canAssignApiKeys" class="user-action-line">
                          <select
                            v-model="assignSelections[item.id]"
                            class="ui-text-input !w-[180px]"
                            :disabled="item.status === 'deleted' || !apiKeyOptions.length"
                          >
                            <option value="">Select API key</option>
                            <option v-for="name in apiKeyOptions" :key="`${item.id}-${name}`" :value="name">{{ name }}</option>
                          </select>
                          <button
                            class="ui-micro-btn"
                            :disabled="assignmentLoading[item.id] || item.status === 'deleted' || !assignSelections[item.id]"
                            @click="assignApiKey(item)"
                          >
                            {{ assignmentLoading[item.id] ? 'Assigning...' : 'Assign Key' }}
                          </button>
                        </div>
                        <p v-if="canAssignApiKeys && !apiKeyOptions.length" class="text-[11px] text-white/45">
                          No API key inventory loaded for assignment.
                        </p>
                        <div class="flex flex-wrap gap-2">
                          <button
                            v-if="canManageUserStatus && item.status === 'active'"
                            class="ui-micro-btn"
                            :disabled="statusLoading[item.id] || isSelf(item)"
                            @click="suspendUser(item)"
                          >
                            {{ isSelf(item) ? 'Self Locked' : 'Suspend' }}
                          </button>
                          <button
                            v-if="canManageUserStatus && item.status === 'suspended'"
                            class="ui-micro-btn"
                            :disabled="statusLoading[item.id] || isSelf(item)"
                            @click="activateUser(item)"
                          >
                            {{ statusLoading[item.id] ? 'Updating...' : (isSelf(item) ? 'Self Locked' : 'Activate') }}
                          </button>
                          <button
                            v-if="canManageUserStatus"
                            class="ui-micro-btn ui-micro-btn-danger"
                            :disabled="deleting[item.id] || item.status === 'deleted' || isSelf(item)"
                            @click="deleteUser(item)"
                          >
                            {{ deleting[item.id] ? 'Deleting...' : (isSelf(item) ? 'Self Locked' : 'Delete') }}
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div v-if="totalUserPages > 1" class="mt-5 flex flex-wrap items-center justify-end gap-2">
              <button class="ui-micro-btn" :disabled="userPage <= 1" @click="setUserPage(userPage - 1)">Prev</button>
              <button
                v-for="page in visibleUserPages"
                :key="`user-page-${page}`"
                class="ui-micro-btn"
                :class="{ 'ui-micro-btn-primary': page === userPage }"
                @click="setUserPage(page)"
              >
                {{ page }}
              </button>
              <button class="ui-micro-btn" :disabled="userPage >= totalUserPages" @click="setUserPage(userPage + 1)">Next</button>
            </div>
          </section>

          <section v-if="showServiceSection" ref="serviceRef" class="ui-glass-card mb-8 scroll-mt-6 rounded-2xl p-5 md:p-6 space-y-6">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 class="section-title">Eager Service Management</h2>
                <p class="section-caption">余额、请求日志和 API key 生命周期管理。</p>
              </div>
              <button class="ui-micro-btn" :disabled="loading302" @click="load302All">
                {{ loading302 ? 'Refreshing...' : 'Refresh Service Data' }}
              </button>
            </div>

            <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div class="ui-glass-card rounded-xl p-4">
                <p class="text-xs uppercase tracking-[0.12em] text-white/40">Account Balance</p>
                <p class="mt-2 text-2xl font-semibold text-white">{{ canReadUsage ? balanceDisplay : '--' }}</p>
                <p class="mt-2 text-xs text-white/45">{{ canReadUsage ? 'Provider dashboard balance' : 'Permission required: admin.usage.read_all' }}</p>
              </div>
              <div class="ui-glass-card rounded-xl p-4">
                <p class="text-xs uppercase tracking-[0.12em] text-white/40">API Keys</p>
                <p class="mt-2 text-2xl font-semibold text-white">{{ canManageApiKeys ? apiKeys.length : '--' }}</p>
                <p class="mt-2 text-xs text-white/45">{{ canManageApiKeys ? 'Manageable upstream keys' : 'Permission required: admin.api_key.manage' }}</p>
              </div>
              <div class="ui-glass-card rounded-xl p-4">
                <p class="text-xs uppercase tracking-[0.12em] text-white/40">API Log Results</p>
                <p class="mt-2 text-2xl font-semibold text-white">{{ canReadUsage ? apiLogs.length : '--' }}</p>
                <p class="mt-2 text-xs text-white/45">{{ canReadUsage ? 'Current query result rows' : 'Permission required: admin.usage.read_all' }}</p>
              </div>
            </div>

            <div v-if="canReadUsage" class="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_1.8fr]">
              <div class="ui-glass-card rounded-2xl p-4">
                <h3 class="text-sm font-medium text-white">Deduction Detail (request-id)</h3>
                <div class="mt-3 flex flex-wrap gap-2">
                  <input v-model="recordRequestId" class="ui-text-input" placeholder="Paste request-id" />
                  <button class="ui-micro-btn" :disabled="loadingRecord" @click="queryRecord">
                    {{ loadingRecord ? 'Querying...' : 'Query' }}
                  </button>
                </div>
                <div v-if="recordData" class="mt-4 grid grid-cols-2 gap-2 text-xs text-white/75 md:grid-cols-5">
                  <div>Model: {{ recordData.model || '-' }}</div>
                  <div>Cost: {{ recordData.cost ?? '-' }}</div>
                  <div>Input: {{ recordData.input_token ?? '-' }}</div>
                  <div>Output: {{ recordData.output_token ?? '-' }}</div>
                  <div>Latency: {{ recordData.process_time ?? '-' }}</div>
                </div>
              </div>

              <div class="ui-glass-card rounded-2xl p-4">
                <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 class="text-sm font-medium text-white">API Log Query</h3>
                  <div class="flex flex-wrap items-center gap-2">
                    <input v-model="log302Query.start" type="datetime-local" class="ui-text-input !w-[190px]" />
                    <input v-model="log302Query.end" type="datetime-local" class="ui-text-input !w-[190px]" />
                    <input v-model.number="log302Query.page" type="number" min="1" class="ui-number-input" />
                    <input v-model.number="log302Query.limit" type="number" min="1" max="50" class="ui-number-input" />
                    <button class="ui-micro-btn" :disabled="loadingApiLogs" @click="loadApiLogs">Search</button>
                  </div>
                </div>
                <div v-if="apiLogs.length === 0" class="empty-notice">No API logs</div>
                <div v-else class="overflow-x-auto">
                  <table class="w-full min-w-[860px] text-sm">
                    <thead>
                      <tr class="border-b border-white/10 text-left text-xs uppercase tracking-[0.12em] text-white/40">
                        <th class="px-2 py-2">Request ID</th>
                        <th class="px-2 py-2">Model</th>
                        <th class="px-2 py-2">Cost</th>
                        <th class="px-2 py-2">Status</th>
                        <th class="px-2 py-2">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(item, idx) in apiLogs" :key="item.request_id || item.id || idx" class="border-b border-white/5">
                        <td class="px-2 py-2 text-white/80">{{ item.request_id || item.requestId || item.id || '-' }}</td>
                        <td class="px-2 py-2 text-white/80">{{ item.model || item.model_name || '-' }}</td>
                        <td class="px-2 py-2 text-white/80">{{ item.cost ?? item.cost_usd ?? '-' }}</td>
                        <td class="px-2 py-2 text-white/70">{{ item.status || item.code || '-' }}</td>
                        <td class="px-2 py-2 text-white/60">{{ item.created_at || item.createdAt || item.time || '-' }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div v-if="canManageApiKeys" class="space-y-6">
              <div class="ui-glass-card rounded-2xl p-4">
                <h3 class="text-sm font-medium text-white">Create API Key</h3>
                <div class="mt-3 grid grid-cols-1 gap-2 md:grid-cols-4">
                  <input v-model="createKeyForm.api_name" class="ui-text-input" placeholder="api_name" />
                  <input v-model.number="createKeyForm.limit_cost" type="number" min="0" class="ui-text-input" placeholder="limit_cost" />
                  <input v-model.number="createKeyForm.limit_daily_cost" type="number" min="0" class="ui-text-input" placeholder="limit_daily_cost" />
                  <input v-model.number="createKeyForm.expired_on" type="number" min="0" class="ui-text-input" placeholder="expired_on(unix)" />
                </div>
                <div class="mt-3 flex flex-wrap gap-3 text-xs text-white/65">
                  <label><input v-model="createKeyForm.allow_save_logs" type="checkbox" /> allow_save_logs</label>
                  <label><input v-model="createKeyForm.allow_custom_model" type="checkbox" /> allow_custom_model</label>
                  <label><input v-model="createKeyForm.allow_manage_key" type="checkbox" /> allow_manage_key</label>
                </div>
                <button class="ui-micro-btn ui-micro-btn-primary mt-3" :disabled="creatingApiKey" @click="createApiKey">
                  {{ creatingApiKey ? 'Creating...' : 'Create Key' }}
                </button>
              </div>

              <div>
                <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 class="text-sm font-medium text-white">API Keys</h3>
                  <p class="text-xs text-white/45">Create, update and delete upstream keys</p>
                </div>
                <div v-if="apiKeys.length === 0" class="empty-notice">No API keys</div>
                <div v-else class="overflow-x-auto">
                  <table class="w-full min-w-[1100px] text-sm">
                    <thead>
                      <tr class="border-b border-white/10 text-left text-xs uppercase tracking-[0.12em] text-white/40">
                        <th class="px-2 py-2">Name</th>
                        <th class="px-2 py-2">API Key</th>
                        <th class="px-2 py-2">Current Cost</th>
                        <th class="px-2 py-2">Limit Cost</th>
                        <th class="px-2 py-2">Daily Limit</th>
                        <th class="px-2 py-2">Expire</th>
                        <th class="px-2 py-2">Flags</th>
                        <th class="px-2 py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="item in apiKeys" :key="item.id || item.api_name" class="border-b border-white/5 align-top">
                        <td class="px-2 py-2 text-white/85">{{ item.api_name }}</td>
                        <td class="px-2 py-2 text-white/70">{{ maskApiKey(item.api_key) }}</td>
                        <td class="px-2 py-2 text-white/75">{{ item.current_cost ?? 0 }}</td>
                        <td class="px-2 py-2"><input v-model.number="keyDrafts[item.api_name].limit_cost" type="number" min="0" class="ui-text-input !w-[110px]" /></td>
                        <td class="px-2 py-2"><input v-model.number="keyDrafts[item.api_name].limit_daily_cost" type="number" min="0" class="ui-text-input !w-[110px]" /></td>
                        <td class="px-2 py-2"><input v-model.number="keyDrafts[item.api_name].expired_on" type="number" min="0" class="ui-text-input !w-[120px]" /></td>
                        <td class="px-2 py-2 text-xs text-white/65">
                          <label class="block"><input v-model="keyDrafts[item.api_name].allow_save_logs" type="checkbox" /> logs</label>
                          <label class="block"><input v-model="keyDrafts[item.api_name].allow_custom_model" type="checkbox" /> custom model</label>
                          <label class="block"><input v-model="keyDrafts[item.api_name].allow_manage_key" type="checkbox" /> manage key</label>
                        </td>
                        <td class="px-2 py-2">
                          <div class="flex flex-wrap gap-2">
                            <button class="ui-micro-btn" :disabled="updatingKeys[item.api_name]" @click="updateApiKey(item)">
                              {{ updatingKeys[item.api_name] ? 'Saving...' : 'Update' }}
                            </button>
                            <button class="ui-micro-btn ui-micro-btn-danger" :disabled="deletingKeys[item.api_name]" @click="removeApiKey(item)">
                              {{ deletingKeys[item.api_name] ? 'Deleting...' : 'Delete' }}
                            </button>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div v-if="!canReadUsage && !canManageApiKeys" class="empty-notice">
              当前角色没有可用的 Service 管理权限。
            </div>
          </section>

          <section v-if="canReadAudit" ref="auditRef" class="ui-glass-card scroll-mt-6 rounded-2xl p-5 md:p-6">
            <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 class="section-title">Admin Audit Logs</h2>
                <p class="section-caption">后台关键操作审计轨迹。</p>
              </div>
              <div class="flex items-center gap-2 text-xs">
                <input v-model.number="logQuery.page" type="number" min="1" class="ui-number-input" />
                <input v-model.number="logQuery.limit" type="number" min="1" max="100" class="ui-number-input" />
                <button class="ui-micro-btn" :disabled="loadingLogs" @click="loadLogs">Search</button>
              </div>
            </div>

            <div v-if="auditLogs.length === 0" class="empty-notice">No audit logs</div>
            <div v-else class="overflow-x-auto">
              <table class="w-full min-w-[980px] text-sm">
                <thead>
                  <tr class="border-b border-white/10 text-left text-xs uppercase tracking-[0.12em] text-white/40">
                    <th class="px-3 py-3">Time</th>
                    <th class="px-3 py-3">Action</th>
                    <th class="px-3 py-3">Operator</th>
                    <th class="px-3 py-3">Target</th>
                    <th class="px-3 py-3">Metadata</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="log in auditLogs" :key="log.id" class="border-b border-white/5 align-top hover:bg-white/[0.03]">
                    <td class="px-3 py-3 text-xs text-white/70">{{ formatDateTime(log.createdAt) }}</td>
                    <td class="px-3 py-3 text-white/85">{{ log.action }}</td>
                    <td class="px-3 py-3 text-white/75">{{ log.operator?.email || '-' }}</td>
                    <td class="px-3 py-3 text-white/75">{{ log.target?.email || '-' }}</td>
                    <td class="px-3 py-3"><pre class="max-w-[420px] whitespace-pre-wrap text-xs text-white/55">{{ toPrettyJson(log.metadata) }}</pre></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p class="mt-3 text-xs text-white/45">Page {{ pagination.page }} · Limit {{ pagination.limit }} · Total {{ pagination.total }}</p>
          </section>
        </main>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  assignAdminApiKeyToUser,
  createAdmin302ApiKey,
  deleteAdmin302ApiKey,
  deleteAdminUser,
  getAdmin302ApiKeys,
  getAdmin302ApiRecord,
  getAdmin302Balance,
  getAdmin302Record,
  getAdminAuditLogs,
  getAdminUsageSummary,
  getAdminUsageTimeseries,
  getAdminUsers,
  unassignAdminApiKeyFromUser,
  updateAdmin302ApiKey,
  updateAdminUserRoles,
  updateAdminUserStatus
} from '@/api/admin'
import { useAuthStore } from '@/stores/auth'
import { getErrorMessage } from '@/utils'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const adminShellRef = ref(null)
const overviewRef = ref(null)
const usersRef = ref(null)
const serviceRef = ref(null)
const auditRef = ref(null)
const activeSection = ref('overview')

const roleOptions = ['super_admin', 'admin', 'ops', 'support', 'user']

const users = ref([])
const userSearchQuery = ref('')
const userStatusFilter = ref('all')
const userPage = ref(1)
const userPageSize = 10
const selectedRoles = ref({})
const assignSelections = ref({})
const saving = ref({})
const statusLoading = ref({})
const deleting = ref({})
const assignmentLoading = ref({})
const loadingUsers = ref(false)

const usageSummary = ref({
  totalCalls: 0,
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalImages: 0,
  totalVideoSeconds: 0,
  totalCostUsd: 0,
  totalUsers: 0
})
const usageSeries = ref([])
const loadingUsage = ref(false)

const auditLogs = ref([])
const loadingLogs = ref(false)
const pagination = ref({ page: 1, limit: 20, total: 0 })
const logQuery = ref({ page: 1, limit: 20 })

const balance = ref('')
const loadingBalance = ref(false)
const recordRequestId = ref('')
const recordData = ref(null)
const loadingRecord = ref(false)
const log302Query = reactive({ page: 1, limit: 20, start: '', end: '' })
const apiLogs = ref([])
const loadingApiLogs = ref(false)
const apiKeys = ref([])
const keyDrafts = ref({})
const loadingKeys = ref(false)
const creatingApiKey = ref(false)
const updatingKeys = ref({})
const deletingKeys = ref({})
const createKeyForm = reactive({
  api_name: '',
  allow_save_logs: false,
  allow_custom_model: false,
  allow_manage_key: false,
  limit_cost: 0,
  limit_daily_cost: 0,
  expired_on: 0
})

const canReadUsers = computed(() => auth.hasPermission('admin.user.read'))
const canManageRoles = computed(() => auth.hasPermission('admin.user.role.update'))
const canManageUserStatus = computed(() => auth.hasPermission('admin.user.status.update'))
const canReadUsage = computed(() => auth.hasPermission('admin.usage.read_all'))
const canReadAudit = computed(() => auth.hasPermission('admin.audit.read'))
const canAssignApiKeys = computed(() => auth.hasPermission('admin.api_key.assign'))
const canManageApiKeys = computed(() => auth.hasPermission('admin.api_key.manage'))
const showServiceSection = computed(() => canReadUsage.value || canManageApiKeys.value || canAssignApiKeys.value)
const showUserActions = computed(() => canAssignApiKeys.value || canManageUserStatus.value)
const showAssignmentsColumn = computed(() => canAssignApiKeys.value || users.value.some((item) => (item.assignedApiKeys || []).length > 0))

const navItems = computed(() => {
  const items = [
    { key: 'overview', label: 'Overview', note: 'Summary' }
  ]
  if (canReadUsers.value) items.push({ key: 'users', label: 'Users & Roles', note: 'Accounts' })
  if (showServiceSection.value) items.push({ key: 'service', label: 'Service Ops', note: '302' })
  if (canReadAudit.value) items.push({ key: 'audit', label: 'Audit Logs', note: 'Trace' })
  return items
})

const routeNameBySection = {
  overview: 'AdminDashboard',
  users: 'AdminUsers',
  service: 'AdminService',
  audit: 'AdminAudit'
}

const sectionByRouteName = {
  AdminDashboard: 'overview',
  AdminUsers: 'users',
  AdminService: 'service',
  AdminAudit: 'audit'
}

watch(navItems, (items) => {
  if (!items.some((item) => item.key === activeSection.value)) {
    activeSection.value = items[0]?.key || 'overview'
  }
}, { immediate: true })

const isRefreshing = computed(() => loadingOverview.value || loadingUsers.value || loadingLogs.value || loading302.value)
const loadingOverview = computed(() => loadingUsage.value)
const loading302 = computed(() => loadingBalance.value || loadingRecord.value || loadingApiLogs.value || loadingKeys.value)
const balanceDisplay = computed(() => (balance.value ? `$${balance.value}` : '--'))
const nowLabel = computed(() => new Date().toLocaleDateString())

const displayName = computed(() => {
  const name = String(auth.user.value?.displayName || '').trim()
  return name || auth.adminUser.value?.email || auth.user.value?.email || 'Admin'
})

const adminAccountLabel = computed(() => auth.adminUser.value?.email || auth.user.value?.email || '-')

const accessScope = computed(() => {
  const items = ['Dashboard']
  if (canReadUsers.value) items.push('Users')
  if (canReadUsage.value) items.push('Usage')
  if (canManageApiKeys.value) items.push('API Keys')
  else if (canAssignApiKeys.value) items.push('Assignments')
  if (canReadAudit.value) items.push('Audit')
  return items
})

const userStats = computed(() => users.value.reduce((acc, item) => {
  const status = String(item.status || 'active')
  acc.total += 1
  if (status === 'suspended') acc.suspended += 1
  else if (status === 'deleted') acc.deleted += 1
  else acc.active += 1
  return acc
}, { total: 0, active: 0, suspended: 0, deleted: 0 }))

const cards = computed(() => [
  { label: 'Managed Users', value: canReadUsers.value ? userStats.value.total : '--', note: canReadUsers.value ? 'Users in admin scope' : 'Permission required' },
  { label: 'Suspended', value: canReadUsers.value ? userStats.value.suspended : '--', note: canReadUsers.value ? 'Accounts currently blocked' : 'Permission required' },
  { label: 'Total Calls', value: canReadUsage.value ? usageSummary.value.totalCalls || 0 : '--', note: canReadUsage.value ? 'Global request volume' : 'Usage not available' },
  { label: 'Cost (USD)', value: canReadUsage.value ? Number(usageSummary.value.totalCostUsd || 0).toFixed(2) : '--', note: canReadUsage.value ? 'Aggregated spend' : 'Usage not available' },
  { label: 'Audit Rows', value: canReadAudit.value ? pagination.value.total : '--', note: canReadAudit.value ? 'Current audit trail size' : 'Audit not available' },
  { label: 'API Keys', value: canManageApiKeys.value ? apiKeys.value.length : '--', note: canManageApiKeys.value ? 'Manageable upstream keys' : 'Key management not available' }
])

const filteredUsers = computed(() => {
  const keyword = String(userSearchQuery.value || '').trim().toLowerCase()
  const filterStatus = String(userStatusFilter.value || 'all')
  return users.value.filter((item) => {
    const matchesKeyword = !keyword || [
      item.id,
      item.email,
      item.displayName
    ].some((value) => String(value || '').toLowerCase().includes(keyword))
    const status = String(item.status || 'active')
    const matchesStatus = filterStatus === 'all' || status === filterStatus
    return matchesKeyword && matchesStatus
  })
})

const totalUserPages = computed(() => Math.max(1, Math.ceil(filteredUsers.value.length / userPageSize)))

const pagedUsers = computed(() => {
  const start = (userPage.value - 1) * userPageSize
  return filteredUsers.value.slice(start, start + userPageSize)
})

const userPageStart = computed(() => {
  if (filteredUsers.value.length === 0) return 0
  return (userPage.value - 1) * userPageSize + 1
})

const userPageEnd = computed(() => {
  if (filteredUsers.value.length === 0) return 0
  return Math.min(userPage.value * userPageSize, filteredUsers.value.length)
})

const visibleUserPages = computed(() => {
  const total = totalUserPages.value
  const current = userPage.value
  if (total <= 5) return Array.from({ length: total }, (_, idx) => idx + 1)
  if (current <= 3) return [1, 2, 3, 4, 5]
  if (current >= total - 2) return [total - 4, total - 3, total - 2, total - 1, total]
  return [current - 2, current - 1, current, current + 1, current + 2]
})

const apiKeyOptions = computed(() => apiKeys.value.map((item) => item.api_name).filter(Boolean))

const goHome = () => router.push('/')

const getSectionEl = (key) => {
  if (key === 'users') return usersRef.value
  if (key === 'service') return serviceRef.value
  if (key === 'audit') return auditRef.value
  return overviewRef.value
}

const scrollToSection = (key, { updateRoute = true } = {}) => {
  activeSection.value = key
  if (updateRoute) {
    const name = routeNameBySection[key]
    if (name && route.name !== name) {
      router.replace({ name })
    }
  }
  const el = getSectionEl(key)
  if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const onMainScroll = () => {
  const sections = navItems.value
    .map((item) => ({ key: item.key, el: getSectionEl(item.key) }))
    .filter((item) => !!item.el)

  let candidate = sections[0]?.key || 'overview'
  let min = Number.POSITIVE_INFINITY
  for (const item of sections) {
    const top = Math.abs(item.el.getBoundingClientRect().top - 120)
    if (top < min) {
      min = top
      candidate = item.key
    }
  }
  activeSection.value = candidate
}

const setUserPage = (page) => {
  const next = Math.min(Math.max(Number(page) || 1, 1), totalUserPages.value)
  userPage.value = next
}

watch([userSearchQuery, userStatusFilter], () => {
  userPage.value = 1
})

watch(filteredUsers, () => {
  if (userPage.value > totalUserPages.value) {
    userPage.value = totalUserPages.value
  }
})

const statusClass = (status) => {
  const val = String(status || 'active')
  if (val === 'suspended') return 'ui-status-pill-suspended'
  if (val === 'deleted') return 'ui-status-pill-deleted'
  return 'ui-status-pill-active'
}

const formatDateTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString()
}

const barWidth = (value) => {
  const max = Math.max(...usageSeries.value.map((item) => Number(item.total_calls || 0)), 1)
  return Math.round((Number(value || 0) / max) * 100)
}

const toPrettyJson = (value) => {
  try {
    return JSON.stringify(value || {}, null, 2)
  } catch {
    return '{}'
  }
}

const isSelected = (userId, role) => {
  const list = selectedRoles.value[userId] || []
  return list.includes(role)
}

const toggleRole = (userId, role, event) => {
  const checked = !!event?.target?.checked
  const list = [...(selectedRoles.value[userId] || [])]
  const set = new Set(list)
  if (checked) set.add(role)
  else set.delete(role)
  selectedRoles.value[userId] = [...set]
}

const maskApiKey = (value) => {
  const key = String(value || '')
  if (key.length <= 10) return key || '-'
  return `${key.slice(0, 6)}...${key.slice(-4)}`
}

const toUnixSeconds = (value) => {
  if (!value) return undefined
  const ts = Date.parse(value)
  return Number.isFinite(ts) ? Math.floor(ts / 1000) : undefined
}

const buildDraft = (item) => ({
  api_name: item.api_name,
  allow_save_logs: !!item.allow_save_logs,
  allow_custom_model: !!item.allow_custom_model,
  allow_manage_key: !!item.allow_manage_key,
  limit_cost: Number(item.limit_cost || 0),
  limit_daily_cost: Number(item.limit_daily_cost || 0),
  expired_on: Number(item.expired_on || 0)
})

const isSelf = (user) => String(user?.id || '') === String(auth.adminUser.value?.id || auth.user.value?.id || '')

const loadUsage = async () => {
  if (!canReadUsage.value) return
  loadingUsage.value = true
  try {
    const [summaryRsp, seriesRsp] = await Promise.all([getAdminUsageSummary(), getAdminUsageTimeseries()])
    usageSummary.value = summaryRsp?.data || usageSummary.value
    usageSeries.value = Array.isArray(seriesRsp?.data) ? seriesRsp.data : []
  } catch (error) {
    if (!error?.__handled) window.$message?.error(getErrorMessage(error, 'Failed to load usage dashboard'))
  } finally {
    loadingUsage.value = false
  }
}

const loadUsers = async () => {
  if (!canReadUsers.value) return
  loadingUsers.value = true
  try {
    const rsp = await getAdminUsers()
    const list = Array.isArray(rsp?.data) ? rsp.data : []
    users.value = list
    const nextSelection = {}
    const nextAssignments = { ...assignSelections.value }
    for (const item of list) {
      nextSelection[item.id] = Array.isArray(item.roles) ? [...item.roles] : ['user']
      if (!Object.prototype.hasOwnProperty.call(nextAssignments, item.id)) nextAssignments[item.id] = ''
    }
    selectedRoles.value = nextSelection
    assignSelections.value = nextAssignments
  } catch (error) {
    if (!error?.__handled) window.$message?.error(getErrorMessage(error, 'Failed to load users'))
  } finally {
    loadingUsers.value = false
  }
}

const saveRoles = async (user) => {
  if (!canManageRoles.value || isSelf(user)) return
  const roles = [...new Set((selectedRoles.value[user.id] || []).filter(Boolean))]
  if (!roles.length) return window.$message?.warning('At least one role is required')
  saving.value = { ...saving.value, [user.id]: true }
  try {
    await updateAdminUserRoles(user.id, roles)
    window.$message?.success('Roles updated')
    await Promise.all([loadUsers(), loadLogs()])
  } catch (error) {
    if (!error?.__handled) window.$message?.error(getErrorMessage(error, 'Failed to update roles'))
  } finally {
    saving.value = { ...saving.value, [user.id]: false }
  }
}

const suspendUser = async (user) => {
  if (!canManageUserStatus.value || isSelf(user)) return
  const reason = window.prompt('Suspend reason (optional):', '') || ''
  statusLoading.value = { ...statusLoading.value, [user.id]: true }
  try {
    await updateAdminUserStatus(user.id, 'suspended', reason)
    window.$message?.success('User suspended')
    await Promise.all([loadUsers(), loadLogs()])
  } catch (error) {
    if (!error?.__handled) window.$message?.error(getErrorMessage(error, 'Failed to suspend user'))
  } finally {
    statusLoading.value = { ...statusLoading.value, [user.id]: false }
  }
}

const activateUser = async (user) => {
  if (!canManageUserStatus.value || isSelf(user)) return
  statusLoading.value = { ...statusLoading.value, [user.id]: true }
  try {
    await updateAdminUserStatus(user.id, 'active')
    window.$message?.success('User activated')
    await Promise.all([loadUsers(), loadLogs()])
  } catch (error) {
    if (!error?.__handled) window.$message?.error(getErrorMessage(error, 'Failed to activate user'))
  } finally {
    statusLoading.value = { ...statusLoading.value, [user.id]: false }
  }
}

const deleteUser = async (user) => {
  if (!canManageUserStatus.value || isSelf(user)) return
  const ok = window.confirm(`Delete user ${user.email}? This will disable account access.`)
  if (!ok) return
  deleting.value = { ...deleting.value, [user.id]: true }
  try {
    await deleteAdminUser(user.id)
    window.$message?.success('User deleted')
    await Promise.all([loadUsers(), loadLogs()])
  } catch (error) {
    if (!error?.__handled) window.$message?.error(getErrorMessage(error, 'Failed to delete user'))
  } finally {
    deleting.value = { ...deleting.value, [user.id]: false }
  }
}

const assignApiKey = async (user) => {
  if (!canAssignApiKeys.value) return
  const apiName = String(assignSelections.value[user.id] || '').trim()
  if (!apiName) return window.$message?.warning('Select an API key first')
  assignmentLoading.value = { ...assignmentLoading.value, [user.id]: true }
  try {
    await assignAdminApiKeyToUser(user.id, apiName)
    window.$message?.success('API key assigned')
    assignSelections.value = { ...assignSelections.value, [user.id]: '' }
    await Promise.all([loadUsers(), loadLogs()])
  } catch (error) {
    if (!error?.__handled) window.$message?.error(getErrorMessage(error, 'Failed to assign API key'))
  } finally {
    assignmentLoading.value = { ...assignmentLoading.value, [user.id]: false }
  }
}

const unassignApiKey = async (user, apiName) => {
  if (!canAssignApiKeys.value) return
  assignmentLoading.value = { ...assignmentLoading.value, [user.id]: true }
  try {
    await unassignAdminApiKeyFromUser(user.id, apiName)
    window.$message?.success('API key unassigned')
    await Promise.all([loadUsers(), loadLogs()])
  } catch (error) {
    if (!error?.__handled) window.$message?.error(getErrorMessage(error, 'Failed to unassign API key'))
  } finally {
    assignmentLoading.value = { ...assignmentLoading.value, [user.id]: false }
  }
}

const load302Balance = async () => {
  if (!canReadUsage.value) return
  loadingBalance.value = true
  try {
    const rsp = await getAdmin302Balance()
    balance.value = String(rsp?.data?.balance ?? '')
  } catch (error) {
    if (!error?.__handled) window.$message?.error(getErrorMessage(error, 'Failed to load Eager Service balance'))
  } finally {
    loadingBalance.value = false
  }
}

const queryRecord = async () => {
  if (!canReadUsage.value) return
  const id = String(recordRequestId.value || '').trim()
  if (!id) return window.$message?.warning('Please input request-id')
  loadingRecord.value = true
  try {
    const rsp = await getAdmin302Record(id)
    recordData.value = rsp?.data || null
  } catch (error) {
    if (!error?.__handled) window.$message?.error(getErrorMessage(error, 'Failed to query record'))
  } finally {
    loadingRecord.value = false
  }
}

const loadApiLogs = async () => {
  if (!canReadUsage.value) return
  loadingApiLogs.value = true
  try {
    const rsp = await getAdmin302ApiRecord({
      page: log302Query.page,
      limit: log302Query.limit,
      start_time: toUnixSeconds(log302Query.start),
      end_time: toUnixSeconds(log302Query.end)
    })
    apiLogs.value = Array.isArray(rsp?.data?.items) ? rsp.data.items : []
  } catch (error) {
    if (!error?.__handled) window.$message?.error(getErrorMessage(error, 'Failed to load API logs'))
  } finally {
    loadingApiLogs.value = false
  }
}

const loadApiKeys = async ({ silent = false } = {}) => {
  if (!canManageApiKeys.value && !canAssignApiKeys.value) return
  loadingKeys.value = true
  try {
    const rsp = await getAdmin302ApiKeys()
    const list = Array.isArray(rsp?.data) ? rsp.data : []
    apiKeys.value = list
    const drafts = {}
    for (const item of list) drafts[item.api_name] = buildDraft(item)
    keyDrafts.value = drafts
  } catch (error) {
    if (!silent && !error?.__handled) window.$message?.error(getErrorMessage(error, 'Failed to load API keys'))
  } finally {
    loadingKeys.value = false
  }
}

const createApiKey = async () => {
  if (!canManageApiKeys.value) return
  if (!String(createKeyForm.api_name || '').trim()) return window.$message?.warning('api_name is required')
  creatingApiKey.value = true
  try {
    await createAdmin302ApiKey({ ...createKeyForm, api_name: createKeyForm.api_name.trim() })
    window.$message?.success('API key created')
    createKeyForm.api_name = ''
    createKeyForm.allow_save_logs = false
    createKeyForm.allow_custom_model = false
    createKeyForm.allow_manage_key = false
    createKeyForm.limit_cost = 0
    createKeyForm.limit_daily_cost = 0
    createKeyForm.expired_on = 0
    await loadApiKeys()
  } catch (error) {
    if (!error?.__handled) window.$message?.error(getErrorMessage(error, 'Failed to create API key'))
  } finally {
    creatingApiKey.value = false
  }
}

const updateApiKey = async (item) => {
  if (!canManageApiKeys.value) return
  const name = item.api_name
  const draft = keyDrafts.value[name]
  if (!draft) return
  updatingKeys.value = { ...updatingKeys.value, [name]: true }
  try {
    await updateAdmin302ApiKey(name, { ...draft, api_name: name })
    window.$message?.success('API key updated')
    await loadApiKeys()
  } catch (error) {
    if (!error?.__handled) window.$message?.error(getErrorMessage(error, 'Failed to update API key'))
  } finally {
    updatingKeys.value = { ...updatingKeys.value, [name]: false }
  }
}

const removeApiKey = async (item) => {
  if (!canManageApiKeys.value) return
  const name = item.api_name
  const ok = window.confirm(`Delete API key ${name}?`)
  if (!ok) return
  deletingKeys.value = { ...deletingKeys.value, [name]: true }
  try {
    await deleteAdmin302ApiKey(name)
    window.$message?.success('API key deleted')
    await Promise.all([loadApiKeys(), loadUsers(), loadLogs()])
  } catch (error) {
    if (!error?.__handled) window.$message?.error(getErrorMessage(error, 'Failed to delete API key'))
  } finally {
    deletingKeys.value = { ...deletingKeys.value, [name]: false }
  }
}

const load302All = async () => {
  const tasks = []
  if (canReadUsage.value) {
    tasks.push(load302Balance(), loadApiLogs())
  }
  if (canManageApiKeys.value || canAssignApiKeys.value) {
    tasks.push(loadApiKeys({ silent: !canManageApiKeys.value }))
  }
  await Promise.all(tasks)
}

const loadLogs = async () => {
  if (!canReadAudit.value) return
  loadingLogs.value = true
  try {
    const rsp = await getAdminAuditLogs({ page: logQuery.value.page, limit: logQuery.value.limit })
    auditLogs.value = Array.isArray(rsp?.data) ? rsp.data : []
    pagination.value = {
      page: Number(rsp?.pagination?.page || logQuery.value.page || 1),
      limit: Number(rsp?.pagination?.limit || logQuery.value.limit || 20),
      total: Number(rsp?.pagination?.total || 0)
    }
  } catch (error) {
    if (!error?.__handled) window.$message?.error(getErrorMessage(error, 'Failed to load audit logs'))
  } finally {
    loadingLogs.value = false
  }
}

const refreshOverview = async () => {
  await loadUsage()
}

const loadAll = async () => {
  const allowed = await auth.loadAdminSession({ force: true })
  if (!allowed) {
    router.replace('/')
    return
  }

  const tasks = []
  if (canReadUsage.value) tasks.push(loadUsage())
  if (canReadUsers.value) tasks.push(loadUsers())
  if (showServiceSection.value) tasks.push(load302All())
  if (canReadAudit.value) tasks.push(loadLogs())
  await Promise.all(tasks)
}

onMounted(async () => {
  await loadAll()
  await nextTick()
  const preferredSection = sectionByRouteName[route.name] || 'overview'
  if (navItems.value.some((item) => item.key === preferredSection)) {
    scrollToSection(preferredSection, { updateRoute: false })
  } else {
    onMainScroll()
    if (route.name !== 'AdminDashboard') {
      router.replace({ name: 'AdminDashboard' })
    }
  }
  const scrollTarget = adminShellRef.value || window
  scrollTarget.addEventListener('scroll', onMainScroll, { passive: true })
})

watch(() => route.name, async (name) => {
  const preferredSection = sectionByRouteName[name] || 'overview'
  await nextTick()
  if (navItems.value.some((item) => item.key === preferredSection)) {
    scrollToSection(preferredSection, { updateRoute: false })
  } else if (route.name !== 'AdminDashboard') {
    router.replace({ name: 'AdminDashboard' })
  }
})

onBeforeUnmount(() => {
  const scrollTarget = adminShellRef.value || window
  scrollTarget.removeEventListener('scroll', onMainScroll)
})
</script>

<style scoped>
.admin-shell {
  background:
    radial-gradient(900px 420px at 16% -10%, rgba(255, 255, 255, 0.05), transparent 60%),
    radial-gradient(900px 420px at 88% -12%, rgba(255, 255, 255, 0.04), transparent 60%),
    linear-gradient(180deg, #0a0a0b 0%, #09090a 100%);
  font-family: 'Sora', 'Avenir Next', 'SF Pro Text', sans-serif;
}

.admin-frame {
  background: linear-gradient(180deg, #141416 0%, #101012 100%);
  box-shadow: 0 22px 80px rgba(0, 0, 0, 0.45);
}

.admin-sidebar {
  background: linear-gradient(180deg, rgba(8, 8, 9, 0.72) 0%, rgba(12, 12, 14, 0.8) 100%);
}

.admin-main {
  background: linear-gradient(180deg, rgba(18, 18, 20, 0.72) 0%, rgba(11, 11, 13, 0.84) 100%);
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
}

.section-caption {
  margin-top: 6px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.48);
}

.menu-item {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-radius: 12px;
  border: 1px solid transparent;
  padding: 10px 12px;
  text-align: left;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.62);
  transition: all 0.2s ease;
}

.menu-item:hover {
  color: rgba(255, 255, 255, 0.92);
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.12);
}

.menu-item-active {
  color: rgba(255, 255, 255, 0.94);
  background: rgba(255, 255, 255, 0.09);
  border-color: rgba(255, 255, 255, 0.2);
}

.menu-item-note {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.36);
}

.permission-chip {
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.05);
  padding: 5px 10px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.76);
}

.summary-pill {
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.04);
  padding: 5px 10px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.72);
}

.assignment-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.05);
  padding: 4px 8px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.82);
}

.assignment-pill-action {
  border: 0;
  background: transparent;
  color: rgba(255, 255, 255, 0.58);
}

.user-action-stack {
  display: flex;
  min-width: 260px;
  flex-direction: column;
  gap: 10px;
}

.user-action-line {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.empty-notice {
  border-radius: 12px;
  border: 1px dashed rgba(255, 255, 255, 0.15);
  padding: 18px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
}
</style>
