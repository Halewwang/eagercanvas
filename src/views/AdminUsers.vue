<template>
  <div ref="adminShellRef" class="admin-shell min-h-screen overflow-x-hidden px-3 py-4 md:px-6 md:py-6">
    <div class="admin-frame w-full rounded-[20px] border border-white/10">
      <div class="admin-layout relative">
        <aside class="admin-sidebar hidden lg:fixed lg:bottom-6 lg:left-6 lg:top-6 lg:flex lg:w-[232px] lg:flex-col lg:overflow-hidden lg:rounded-[20px]">
          <div class="px-5 pt-5">
            <div class="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
              <p class="text-xs uppercase tracking-[0.18em] text-white/45">EagerCanvas</p>
              <p class="mt-1 text-sm font-medium text-white/90">管理控制台</p>
              <p class="mt-3 text-xs leading-5 text-white/55">面向成员、用量与服务操作的权限感知管理中枢。</p>
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
              <p class="text-xs uppercase tracking-[0.16em] text-white/45">访问范围</p>
              <div class="mt-3 flex flex-wrap gap-2">
                <span v-for="item in accessScope" :key="item" class="permission-chip">{{ item }}</span>
              </div>
            </div>
          </div>

          <div class="mt-auto p-4">
            <div class="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p class="text-sm font-medium text-white/90">当前操作会话</p>
              <p class="mt-2 text-xs text-white/55">{{ adminAccountLabel }}</p>
              <p class="mt-1 text-xs text-white/45">{{ auth.roles.value.join(', ') || '未加载角色' }}</p>
            </div>
          </div>
        </aside>

        <main class="admin-main w-full min-w-0 p-5 md:p-7 lg:pl-[260px]">
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
                <p class="text-xs uppercase tracking-[0.2em] text-white/45">管理后台</p>
                <h1 class="mt-2 text-2xl font-semibold text-white md:text-3xl">欢迎回来，{{ displayName }}</h1>
                <p class="mt-3 text-sm leading-6 text-white/55">
                  当前页面会按权限显示可管理区块，并且只请求当前角色可访问的数据，避免进入后台即触发无效接口。
                </p>
                <div class="mt-4 flex flex-wrap gap-2">
                  <span v-for="item in accessScope" :key="`scope-${item}`" class="permission-chip">{{ item }}</span>
                </div>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <button class="ui-action-btn whitespace-nowrap" :disabled="isRefreshing" @click="loadAll">
                  {{ isRefreshing ? '刷新中...' : '刷新当前可见数据' }}
                </button>
                <button v-if="canReadUsers" class="ui-action-btn whitespace-nowrap" @click="scrollToSection('users')">用户管理</button>
                <button v-if="showServiceSection" class="ui-action-btn whitespace-nowrap" @click="scrollToSection('service')">服务运维</button>
                <button class="ui-action-btn whitespace-nowrap" @click="goHome">返回</button>
              </div>
            </div>
          </header>

          <section ref="overviewRef" class="mb-8 scroll-mt-6">
            <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 class="section-title">概览</h2>
                <p class="section-caption">核心指标、权限摘要和常用操作入口。</p>
              </div>
              <button class="ui-micro-btn" :disabled="loadingOverview" @click="refreshOverview">
                {{ loadingOverview ? '刷新中...' : '刷新概览' }}
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
                    <h3 class="text-lg font-medium text-white">用量趋势</h3>
                    <p class="mt-1 text-xs text-white/45">最近日级请求量视图</p>
                  </div>
                  <span class="text-xs text-white/45">更新于 {{ nowLabel }}</span>
                </div>

                <div v-if="!canReadUsage" class="empty-notice">
                  当前角色没有全局用量读取权限，已跳过相关接口请求。
                </div>
                <div v-else-if="usageSeries.length === 0" class="empty-notice">
                  暂无用量数据
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
                  <h3 class="text-lg font-medium text-white">管理员会话</h3>
                  <div class="mt-4 space-y-3 text-sm">
                    <div class="ui-info-line"><span>账号</span><strong>{{ adminAccountLabel }}</strong></div>
                    <div class="ui-info-line"><span>角色</span><strong>{{ formatRoleList(auth.roles.value) || '-' }}</strong></div>
                    <div class="ui-info-line"><span>权限数</span><strong>{{ auth.permissions.value.length }}</strong></div>
                    <div class="ui-info-line"><span>状态</span><strong class="text-white">正常</strong></div>
                  </div>
                </div>

                <div class="ui-glass-card rounded-2xl p-4 md:p-5">
                  <h3 class="text-lg font-medium text-white">重点观察</h3>
                  <div class="mt-4 space-y-3 text-sm">
                    <div class="ui-info-line"><span>待分配 Key 用户</span><strong class="text-amber-100">{{ unassignedActiveUsers.length }}</strong></div>
                    <div class="ui-info-line"><span>待对账用户</span><strong class="text-amber-100">{{ pendingBillingUsers }}</strong></div>
                    <div class="ui-info-line"><span>活跃 Key</span><strong>{{ activeAttributedKeys }}</strong></div>
                  </div>
                  <div class="mt-4 space-y-2">
                    <p class="text-xs uppercase tracking-[0.12em] text-white/40">Top 消耗用户</p>
                    <div v-if="topSpenders.length === 0" class="text-xs text-white/45">暂无归因成本数据</div>
                    <div v-for="item in topSpenders" :key="`spender-${item.id}`" class="insight-row">
                      <div>
                        <p class="text-sm text-white/88">{{ item.displayName || item.email || item.id }}</p>
                        <p class="text-[11px] text-white/45">{{ primaryApiKey(item) }}</p>
                      </div>
                      <strong>{{ formatUsd(item.usage?.totalCostUsd, 2) }}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section v-if="canReadUsers" ref="usersRef" class="ui-glass-card mb-8 scroll-mt-6 rounded-2xl p-5 md:p-6">
            <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 class="section-title">用户与角色</h2>
                <p class="section-caption">搜索、筛选、角色调整和账号状态操作。</p>
              </div>
              <button class="ui-micro-btn" :disabled="loadingUsers" @click="loadUsers">
                {{ loadingUsers ? '刷新中...' : '刷新用户列表' }}
              </button>
            </div>

            <div class="mb-4 flex flex-wrap gap-2">
              <span class="summary-pill">正常 {{ userStats.active }}</span>
              <span class="summary-pill">已暂停 {{ userStats.suspended }}</span>
              <span class="summary-pill">已删除 {{ userStats.deleted }}</span>
              <span class="summary-pill">当前显示 {{ filteredUsers.length }}</span>
            </div>

            <div class="mb-4 grid grid-cols-1 gap-3 xl:grid-cols-[1fr_170px_auto] xl:items-end">
              <div>
                <p class="mb-2 text-xs uppercase tracking-[0.12em] text-white/45">搜索用户</p>
                <input
                  v-model.trim="userSearchQuery"
                  class="ui-text-input"
                  placeholder="按用户 ID、邮箱或昵称搜索"
                />
              </div>
              <div>
                <p class="mb-2 text-xs uppercase tracking-[0.12em] text-white/45">状态筛选</p>
                <select v-model="userStatusFilter" class="ui-text-input">
                  <option value="all">全部</option>
                  <option value="active">正常</option>
                  <option value="suspended">已暂停</option>
                  <option value="deleted">已删除</option>
                </select>
              </div>
              <p class="text-xs text-white/55">
                显示第 {{ userPageStart }}-{{ userPageEnd }} 条，共 {{ filteredUsers.length }} 位用户
              </p>
            </div>

            <div v-if="filteredUsers.length === 0" class="empty-notice">
              {{ users.length === 0 ? '暂无用户数据' : '没有匹配的用户' }}
            </div>
            <div v-else class="overflow-x-auto">
              <table class="w-full min-w-[1380px] text-sm">
                <thead>
                  <tr class="border-b border-white/10 text-left text-xs uppercase tracking-[0.12em] text-white/40">
                    <th class="px-3 py-4">用户</th>
                    <th class="px-3 py-4">状态</th>
                    <th class="px-3 py-4">角色</th>
                    <th class="px-3 py-4">调用量</th>
                    <th class="px-3 py-4">归因状态</th>
                    <th v-if="showAssignmentsColumn" class="px-3 py-4">已分配密钥</th>
                    <th v-if="canManageRoles" class="px-3 py-4">角色编辑</th>
                    <th v-if="showUserActions" class="px-3 py-4">操作</th>
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
                      <span class="ui-status-pill" :class="statusClass(item.status)">{{ statusLabel(item.status) }}</span>
                      <p v-if="item.suspendedReason" class="mt-2 max-w-[180px] text-[11px] leading-5 text-white/45">
                        {{ item.suspendedReason }}
                      </p>
                    </td>
                    <td class="px-3 py-4">
                      <div class="flex flex-wrap gap-1.5">
                        <span v-for="role in item.roles || []" :key="`${item.id}-${role}`" class="ui-tag-pill">{{ roleLabel(role) }}</span>
                      </div>
                    </td>
                    <td class="px-3 py-4 text-white/85">
                      <p>{{ item.usage?.totalCalls || 0 }}</p>
                      <p class="mt-1 text-xs text-white/45">{{ formatUsd(item.usage?.totalCostUsd, 4) }} USD</p>
                      <p class="mt-1 text-[11px] text-white/35">{{ item.usage?.totalTokens || 0 }} tokens</p>
                    </td>
                    <td class="px-3 py-4">
                      <p class="text-sm text-white/82">{{ primaryApiKey(item) }}</p>
                      <p class="mt-1 text-xs text-white/45">最近活跃 {{ formatDateTime(item.usageMeta?.lastActivityAt) }}</p>
                      <p class="mt-1 text-[11px]" :class="item.usageMeta?.pendingBillingCount ? 'text-amber-200/80' : 'text-white/35'">
                        {{ item.usageMeta?.pendingBillingCount ? `待对账 ${item.usageMeta?.pendingBillingCount} 条` : '已完成对账' }}
                      </p>
                      <div v-if="(item.usageMeta?.byApiKey || []).length" class="mt-2 flex flex-wrap gap-1.5">
                        <span v-for="keyUsage in item.usageMeta.byApiKey.slice(0, 2)" :key="`${item.id}-${keyUsage.apiName}`" class="assignment-pill">
                          {{ keyUsage.apiName }} · {{ formatUsd(keyUsage.totalCostUsd) }}
                        </span>
                      </div>
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
                        <span v-if="!(item.assignedApiKeys || []).length" class="text-xs text-white/45">未分配密钥</span>
                      </div>
                    </td>
                    <td v-if="canManageRoles" class="px-3 py-4">
                      <div class="role-editor-card">
                        <p class="text-[11px] uppercase tracking-[0.12em] text-white/35">目标角色</p>
                        <select
                          v-model="selectedRoles[item.id]"
                          class="ui-text-input !w-[180px]"
                          :disabled="item.status === 'deleted' || isSelf(item)"
                        >
                          <option v-for="role in roleOptions" :key="`${item.id}-${role.value}`" :value="role.value">
                            {{ role.label }}
                          </option>
                        </select>
                        <button
                          class="ui-micro-btn ui-micro-btn-primary"
                          :disabled="saving[item.id] || item.status === 'deleted' || isSelf(item)"
                          @click="saveRoles(item)"
                        >
                          {{ saving[item.id] ? '保存中...' : (isSelf(item) ? '禁止操作自己' : '保存角色') }}
                        </button>
                      </div>
                    </td>
                    <td v-if="showUserActions" class="px-3 py-4">
                      <div class="action-editor-card">
                        <p class="text-[11px] uppercase tracking-[0.12em] text-white/35">操作中心</p>
                        <div v-if="canAssignApiKeys" class="action-editor-block">
                          <p class="text-[11px] text-white/45">API 密钥分配</p>
                          <select
                            v-model="assignSelections[item.id]"
                            class="ui-text-input action-editor-select"
                            :disabled="item.status === 'deleted' || !apiKeyOptions.length"
                          >
                            <option value="">选择 API 密钥</option>
                            <option v-for="name in apiKeyOptions" :key="`${item.id}-${name}`" :value="name">{{ name }}</option>
                          </select>
                          <button
                            class="ui-micro-btn ui-micro-btn-primary action-editor-main"
                            :disabled="assignmentLoading[item.id] || item.status === 'deleted' || !assignSelections[item.id]"
                            @click="assignApiKey(item)"
                          >
                            {{ assignmentLoading[item.id] ? '分配中...' : '分配密钥' }}
                          </button>
                        </div>
                        <p v-if="canAssignApiKeys && !apiKeyOptions.length" class="text-[11px] text-white/45">
                          当前没有可用于分配的 API 密钥库存。
                        </p>
                        <div class="action-editor-block">
                          <p class="text-[11px] text-white/45">账号状态</p>
                          <div class="action-editor-actions">
                          <button
                            v-if="canManageUserStatus && item.status === 'active'"
                            class="ui-micro-btn"
                            :disabled="statusLoading[item.id] || isSelf(item)"
                            @click="suspendUser(item)"
                          >
                            {{ isSelf(item) ? '禁止操作自己' : '暂停' }}
                          </button>
                          <button
                            v-if="canManageUserStatus && item.status === 'suspended'"
                            class="ui-micro-btn"
                            :disabled="statusLoading[item.id] || isSelf(item)"
                            @click="activateUser(item)"
                          >
                            {{ statusLoading[item.id] ? '更新中...' : (isSelf(item) ? '禁止操作自己' : '恢复') }}
                          </button>
                          <button
                            v-if="canManageUserStatus"
                            class="ui-micro-btn ui-micro-btn-danger"
                            :disabled="deleting[item.id] || item.status === 'deleted' || isSelf(item)"
                            @click="deleteUser(item)"
                          >
                            {{ deleting[item.id] ? '删除中...' : (isSelf(item) ? '禁止操作自己' : '删除') }}
                          </button>
                        </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div v-if="totalUserPages > 1" class="mt-5 flex flex-wrap items-center justify-end gap-2">
              <button class="ui-micro-btn" :disabled="userPage <= 1" @click="setUserPage(userPage - 1)">上一页</button>
              <button
                v-for="page in visibleUserPages"
                :key="`user-page-${page}`"
                class="ui-micro-btn"
                :class="{ 'ui-micro-btn-primary': page === userPage }"
                @click="setUserPage(page)"
              >
                {{ page }}
              </button>
              <button class="ui-micro-btn" :disabled="userPage >= totalUserPages" @click="setUserPage(userPage + 1)">下一页</button>
            </div>
          </section>

          <section v-if="showServiceSection" ref="serviceRef" class="ui-glass-card mb-8 scroll-mt-6 rounded-2xl p-5 md:p-6 space-y-6">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 class="section-title">Eager 服务管理</h2>
                <p class="section-caption">余额、请求日志和 API key 生命周期管理。</p>
              </div>
              <button class="ui-micro-btn" :disabled="loading302" @click="load302All">
                {{ loading302 ? '刷新中...' : '刷新服务数据' }}
              </button>
            </div>

            <div v-if="serviceLoadNotice" class="service-alert">
              {{ serviceLoadNotice }}
            </div>

            <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div class="ui-glass-card rounded-xl p-4">
                <p class="text-xs uppercase tracking-[0.12em] text-white/40">账户余额</p>
                <p class="mt-2 text-2xl font-semibold text-white">{{ canReadUsage ? balanceDisplay : '--' }}</p>
                <p class="mt-2 text-xs text-white/45">{{ canReadUsage ? '上游服务商仪表盘余额' : '需要权限：admin.usage.read_all' }}</p>
              </div>
              <div class="ui-glass-card rounded-xl p-4">
                <p class="text-xs uppercase tracking-[0.12em] text-white/40">API 密钥</p>
                <p class="mt-2 text-2xl font-semibold text-white">{{ canManageApiKeys ? apiKeys.length : '--' }}</p>
                <p class="mt-2 text-xs text-white/45">{{ canManageApiKeys ? '当前可管理的上游密钥数' : '需要权限：admin.api_key.manage' }}</p>
              </div>
              <div class="ui-glass-card rounded-xl p-4">
                <p class="text-xs uppercase tracking-[0.12em] text-white/40">日志结果数</p>
                <p class="mt-2 text-2xl font-semibold text-white">{{ canReadUsage ? apiLogs.length : '--' }}</p>
                <p class="mt-2 text-xs text-white/45">{{ canReadUsage ? '当前日志查询返回行数' : '需要权限：admin.usage.read_all' }}</p>
              </div>
            </div>

            <div v-if="canReadUsage" class="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_1.8fr]">
              <div class="ui-glass-card rounded-2xl p-4">
                <h3 class="text-sm font-medium text-white">扣费详情（request-id）</h3>
                <div class="mt-3 flex flex-wrap gap-2">
                  <input v-model="recordRequestId" class="ui-text-input" placeholder="粘贴 request-id" />
                  <button class="ui-micro-btn" :disabled="loadingRecord" @click="queryRecord">
                    {{ loadingRecord ? '查询中...' : '查询' }}
                  </button>
                </div>
                <div v-if="recordData" class="mt-4 grid grid-cols-2 gap-2 text-xs text-white/75 md:grid-cols-5">
                  <div>模型：{{ recordData.model || '-' }}</div>
                  <div>成本：{{ recordData.cost ?? '-' }}</div>
                  <div>输入：{{ recordData.input_token ?? '-' }}</div>
                  <div>输出：{{ recordData.output_token ?? '-' }}</div>
                  <div>耗时：{{ recordData.process_time ?? '-' }}</div>
                </div>
              </div>

              <div class="ui-glass-card rounded-2xl p-4">
                <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 class="text-sm font-medium text-white">API 日志查询</h3>
                  <div class="flex flex-wrap items-center gap-2">
                    <input v-model="log302Query.start" type="datetime-local" class="ui-text-input !w-[190px]" />
                    <input v-model="log302Query.end" type="datetime-local" class="ui-text-input !w-[190px]" />
                    <input v-model.number="log302Query.page" type="number" min="1" class="ui-number-input" />
                    <input v-model.number="log302Query.limit" type="number" min="1" max="50" class="ui-number-input" />
                    <button class="ui-micro-btn" :disabled="loadingApiLogs" @click="loadApiLogs">查询</button>
                  </div>
                </div>
                <div v-if="apiLogs.length === 0" class="empty-notice">暂无 API 日志</div>
                <div v-else class="overflow-x-auto">
                  <table class="w-full min-w-[860px] text-sm">
                    <thead>
                      <tr class="border-b border-white/10 text-left text-xs uppercase tracking-[0.12em] text-white/40">
                        <th class="px-2 py-2">请求 ID</th>
                        <th class="px-2 py-2">模型</th>
                        <th class="px-2 py-2">成本</th>
                        <th class="px-2 py-2">状态</th>
                        <th class="px-2 py-2">时间</th>
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
                <h3 class="text-sm font-medium text-white">创建 API 密钥</h3>
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
                  {{ creatingApiKey ? '创建中...' : '创建密钥' }}
                </button>
              </div>

              <div>
                <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 class="text-sm font-medium text-white">API 密钥列表</h3>
                  <p class="text-xs text-white/45">创建、更新和删除上游密钥</p>
                </div>
                <div v-if="apiKeys.length === 0" class="empty-notice">暂无 API 密钥</div>
                <div v-else class="overflow-x-auto">
                  <table class="w-full min-w-[1100px] text-sm">
                    <thead>
                      <tr class="border-b border-white/10 text-left text-xs uppercase tracking-[0.12em] text-white/40">
                        <th class="px-2 py-2">名称</th>
                        <th class="px-2 py-2">已分配用户</th>
                        <th class="px-2 py-2">API 密钥</th>
                        <th class="px-2 py-2">本地归因成本</th>
                        <th class="px-2 py-2">当前成本</th>
                        <th class="px-2 py-2">总限额</th>
                        <th class="px-2 py-2">日限额</th>
                        <th class="px-2 py-2">过期时间</th>
                        <th class="px-2 py-2">开关</th>
                        <th class="px-2 py-2">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="item in apiKeys" :key="item.id || item.api_name" class="border-b border-white/5 align-top">
                        <td class="px-2 py-2 text-white/85">{{ item.api_name }}</td>
                        <td class="px-2 py-2 text-white/70">
                          <p>{{ keyInsightMap[item.api_name]?.assignedUsers || 0 }}</p>
                          <p class="mt-1 text-[11px] text-white/35">{{ keyInsightMap[item.api_name]?.activeUsers || 0 }} 活跃</p>
                        </td>
                        <td class="px-2 py-2 text-white/70">{{ maskApiKey(item.api_key) }}</td>
                        <td class="px-2 py-2 text-white/75">{{ formatUsd(keyInsightMap[item.api_name]?.attributedCostUsd || 0) }}</td>
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
                              {{ updatingKeys[item.api_name] ? '保存中...' : '更新' }}
                            </button>
                            <button class="ui-micro-btn ui-micro-btn-danger" :disabled="deletingKeys[item.api_name]" @click="removeApiKey(item)">
                              {{ deletingKeys[item.api_name] ? '删除中...' : '删除' }}
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
              当前角色没有可用的服务管理权限。
            </div>
          </section>

          <section v-if="canReadAudit" ref="auditRef" class="ui-glass-card scroll-mt-6 rounded-2xl p-5 md:p-6">
            <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 class="section-title">后台审计日志</h2>
                <p class="section-caption">后台关键操作审计轨迹。</p>
              </div>
              <div class="flex items-center gap-2 text-xs">
                <input v-model.number="logQuery.page" type="number" min="1" class="ui-number-input" />
                <input v-model.number="logQuery.limit" type="number" min="1" max="100" class="ui-number-input" />
                <button class="ui-micro-btn" :disabled="loadingLogs" @click="loadLogs">查询</button>
              </div>
            </div>

            <div v-if="auditLogs.length === 0" class="empty-notice">暂无审计日志</div>
            <div v-else class="overflow-x-auto">
              <table class="w-full min-w-[980px] text-sm">
                <thead>
                  <tr class="border-b border-white/10 text-left text-xs uppercase tracking-[0.12em] text-white/40">
                    <th class="px-3 py-3">时间</th>
                    <th class="px-3 py-3">动作</th>
                    <th class="px-3 py-3">操作者</th>
                    <th class="px-3 py-3">目标对象</th>
                    <th class="px-3 py-3">元数据</th>
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

            <p class="mt-3 text-xs text-white/45">第 {{ pagination.page }} 页 · 每页 {{ pagination.limit }} 条 · 共 {{ pagination.total }} 条</p>
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
  deleteAdminUser,
  getAdminAuditLogs,
  getAdminUsageSummary,
  getAdminUsageTimeseries,
  getAdminUsers,
  unassignAdminApiKeyFromUser,
  updateAdminUserRoles,
  updateAdminUserStatus
} from '@/api/admin'
import { useAdminServiceOps } from '@/hooks/useAdminServiceOps'
import { useAuthStore } from '@/stores/auth'
import { getErrorMessage } from '@/utils'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

let loadUsagePromise = null
let loadUsersPromise = null
let loadLogsPromise = null
let loadAllPromise = null

const adminShellRef = ref(null)
const overviewRef = ref(null)
const usersRef = ref(null)
const serviceRef = ref(null)
const auditRef = ref(null)
const activeSection = ref('overview')

const roleOptions = [
  { value: 'super_admin', label: '超级管理员' },
  { value: 'admin', label: '管理员' },
  { value: 'ops', label: '运维' },
  { value: 'support', label: '客服' },
  { value: 'user', label: '普通用户' }
]
const roleLabelMap = Object.fromEntries(roleOptions.map((item) => [item.value, item.label]))

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

const canReadUsers = computed(() => auth.hasPermission('admin.user.read'))
const canManageRoles = computed(() => auth.hasPermission('admin.user.role.update'))
const canManageUserStatus = computed(() => auth.hasPermission('admin.user.status.update'))
const canReadUsage = computed(() => auth.hasPermission('admin.usage.read_all'))
const canReadAudit = computed(() => auth.hasPermission('admin.audit.read'))
const canAssignApiKeys = computed(() => auth.hasPermission('admin.api_key.assign'))
const canManageApiKeys = computed(() => auth.hasPermission('admin.api_key.manage'))
const showServiceSection = computed(() => canReadUsage.value || canManageApiKeys.value || canAssignApiKeys.value)
const showUserActions = computed(() => canAssignApiKeys.value || canManageUserStatus.value)
const {
  apiKeyOptions,
  apiKeys,
  apiLogs,
  balanceDisplay,
  createApiKey,
  createKeyForm,
  creatingApiKey,
  deletingKeys,
  keyDrafts,
  load302All,
  loadApiLogs,
  loading302,
  loadingApiLogs,
  loadingKeys,
  loadingRecord,
  log302Query,
  maskApiKey,
  queryRecord,
  recordData,
  recordRequestId,
  removeApiKey,
  serviceLoadNotice,
  updateApiKey,
  updatingKeys
} = useAdminServiceOps({
  canReadUsage,
  canManageApiKeys,
  canAssignApiKeys,
  loadUsers: () => loadUsers(),
  loadLogs: () => loadLogs()
})
const showAssignmentsColumn = computed(() => canAssignApiKeys.value || users.value.some((item) => (item.assignedApiKeys || []).length > 0))

const navItems = computed(() => {
  const items = [
    { key: 'overview', label: '概览', note: '总览' }
  ]
  if (canReadUsers.value) items.push({ key: 'users', label: '用户与角色', note: '账号' })
  if (showServiceSection.value) items.push({ key: 'service', label: '服务运维', note: '302' })
  if (canReadAudit.value) items.push({ key: 'audit', label: '审计日志', note: '追踪' })
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
const nowLabel = computed(() => new Date().toLocaleDateString())

const displayName = computed(() => {
  const name = String(auth.user.value?.displayName || '').trim()
  return name || auth.adminUser.value?.email || auth.user.value?.email || '管理员'
})

const adminAccountLabel = computed(() => auth.adminUser.value?.email || auth.user.value?.email || '-')

const accessScope = computed(() => {
  const items = ['概览']
  if (canReadUsers.value) items.push('用户')
  if (canReadUsage.value) items.push('用量')
  if (canManageApiKeys.value) items.push('API 密钥')
  else if (canAssignApiKeys.value) items.push('分配')
  if (canReadAudit.value) items.push('审计')
  return items
})

const roleLabel = (role) => roleLabelMap[String(role || '').trim()] || String(role || '').trim() || '-'

const formatRoleList = (roles = []) => {
  return (Array.isArray(roles) ? roles : []).map((item) => roleLabel(item)).join('、')
}

const userStats = computed(() => users.value.reduce((acc, item) => {
  const status = String(item.status || 'active')
  acc.total += 1
  if (status === 'suspended') acc.suspended += 1
  else if (status === 'deleted') acc.deleted += 1
  else acc.active += 1
  return acc
}, { total: 0, active: 0, suspended: 0, deleted: 0 }))

const cards = computed(() => [
  { label: '管理用户数', value: canReadUsers.value ? userStats.value.total : '--', note: canReadUsers.value ? '当前后台可见用户总数' : '缺少权限' },
  { label: '已暂停', value: canReadUsers.value ? userStats.value.suspended : '--', note: canReadUsers.value ? '当前被暂停的账号数' : '缺少权限' },
  { label: '总调用量', value: canReadUsage.value ? usageSummary.value.totalCalls || 0 : '--', note: canReadUsage.value ? '全局请求总次数' : '无用量权限' },
  { label: '成本 (USD)', value: canReadUsage.value ? Number(usageSummary.value.totalCostUsd || 0).toFixed(2) : '--', note: canReadUsage.value ? '累计消耗成本' : '无用量权限' },
  { label: '审计条目', value: canReadAudit.value ? pagination.value.total : '--', note: canReadAudit.value ? '当前审计日志总条数' : '无审计权限' },
  { label: 'API 密钥', value: canManageApiKeys.value ? apiKeys.value.length : '--', note: canManageApiKeys.value ? '当前可管理的上游密钥数' : '无密钥管理权限' }
])

const primaryApiKey = (user) => {
  const attributed = user?.usageMeta?.byApiKey?.[0]?.apiName
  const assigned = user?.assignedApiKeys?.[0]?.apiName
  return attributed || assigned || '未归因'
}

const formatUsd = (value, digits = 2) => Number(value || 0).toFixed(digits)

const topSpenders = computed(() => {
  return [...users.value]
    .filter((item) => Number(item?.usage?.totalCostUsd || 0) > 0)
    .sort((a, b) => Number(b?.usage?.totalCostUsd || 0) - Number(a?.usage?.totalCostUsd || 0))
    .slice(0, 5)
})

const unassignedActiveUsers = computed(() => {
  return users.value.filter((item) => {
    const status = String(item.status || 'active')
    const hasAssignedKey = Array.isArray(item.assignedApiKeys) && item.assignedApiKeys.length > 0
    return status === 'active' && !hasAssignedKey
  })
})

const pendingBillingUsers = computed(() => {
  return users.value.filter((item) => Number(item?.usageMeta?.pendingBillingCount || 0) > 0).length
})

const keyInsightMap = computed(() => {
  const map = {}

  for (const user of users.value) {
    const isActive = String(user.status || 'active') === 'active'
    for (const assigned of user.assignedApiKeys || []) {
      const apiName = String(assigned.apiName || '').trim()
      if (!apiName) continue
      const current = map[apiName] || {
        assignedUsers: 0,
        activeUsers: 0,
        attributedCostUsd: 0
      }
      current.assignedUsers += 1
      if (isActive) current.activeUsers += 1
      map[apiName] = current
    }

    for (const usageItem of user.usageMeta?.byApiKey || []) {
      const apiName = String(usageItem.apiName || '').trim()
      if (!apiName) continue
      const current = map[apiName] || {
        assignedUsers: 0,
        activeUsers: 0,
        attributedCostUsd: 0
      }
      current.attributedCostUsd += Number(usageItem.totalCostUsd || 0)
      map[apiName] = current
    }
  }

  return map
})

const activeAttributedKeys = computed(() => {
  return Object.values(keyInsightMap.value).filter((item) => Number(item.attributedCostUsd || 0) > 0).length
})

const filteredUsers = computed(() => {
  const keyword = String(userSearchQuery.value || '').trim().toLowerCase()
  const filterStatus = String(userStatusFilter.value || 'all')
  return users.value
    .filter((item) => {
      const matchesKeyword = !keyword || [
        item.id,
        item.email,
        item.displayName
      ].some((value) => String(value || '').toLowerCase().includes(keyword))
      const status = String(item.status || 'active')
      const matchesStatus = filterStatus === 'all' || status === filterStatus
      return matchesKeyword && matchesStatus
    })
    .sort((a, b) => {
      const costGap = Number(b?.usage?.totalCostUsd || 0) - Number(a?.usage?.totalCostUsd || 0)
      if (costGap !== 0) return costGap
      return String(b?.usageMeta?.lastActivityAt || b?.createdAt || '').localeCompare(String(a?.usageMeta?.lastActivityAt || a?.createdAt || ''))
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

const statusLabel = (status) => {
  const val = String(status || 'active')
  if (val === 'suspended') return '已暂停'
  if (val === 'deleted') return '已删除'
  return '正常'
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

const isSelf = (user) => String(user?.id || '') === String(auth.adminUser.value?.id || auth.user.value?.id || '')

const loadUsage = async ({ force = false } = {}) => {
  if (!canReadUsage.value) return
  if (loadUsagePromise && !force) return loadUsagePromise
  loadingUsage.value = true
  loadUsagePromise = (async () => {
    try {
      const [summaryRsp, seriesRsp] = await Promise.all([getAdminUsageSummary(), getAdminUsageTimeseries()])
      usageSummary.value = summaryRsp?.data || usageSummary.value
      usageSeries.value = Array.isArray(seriesRsp?.data) ? seriesRsp.data : []
    } catch (error) {
      if (!error?.__handled) window.$message?.error(getErrorMessage(error, '加载用量概览失败'))
    } finally {
      loadingUsage.value = false
    }
  })()
  try {
    return await loadUsagePromise
  } finally {
    loadUsagePromise = null
  }
}

const loadUsers = async ({ force = false } = {}) => {
  if (!canReadUsers.value) return
  if (loadUsersPromise && !force) return loadUsersPromise
  loadingUsers.value = true
  loadUsersPromise = (async () => {
    try {
      const rsp = await getAdminUsers()
      const list = Array.isArray(rsp?.data) ? rsp.data : []
      users.value = list
      const nextSelection = {}
      const nextAssignments = { ...assignSelections.value }
      for (const item of list) {
        nextSelection[item.id] = Array.isArray(item.roles) && item.roles.length ? item.roles[0] : 'user'
        if (!Object.prototype.hasOwnProperty.call(nextAssignments, item.id)) nextAssignments[item.id] = ''
      }
      selectedRoles.value = nextSelection
      assignSelections.value = nextAssignments
    } catch (error) {
      if (!error?.__handled) window.$message?.error(getErrorMessage(error, '加载用户列表失败'))
    } finally {
      loadingUsers.value = false
    }
  })()
  try {
    return await loadUsersPromise
  } finally {
    loadUsersPromise = null
  }
}

const saveRoles = async (user) => {
  if (!canManageRoles.value || isSelf(user)) return
  const role = String(selectedRoles.value[user.id] || '').trim()
  if (!role) return window.$message?.warning('请选择角色')
  saving.value = { ...saving.value, [user.id]: true }
  try {
    await updateAdminUserRoles(user.id, [role])
    window.$message?.success('角色更新成功')
    await Promise.all([loadUsers({ force: true }), loadLogs({ force: true })])
  } catch (error) {
    if (!error?.__handled) window.$message?.error(getErrorMessage(error, '更新角色失败'))
  } finally {
    saving.value = { ...saving.value, [user.id]: false }
  }
}

const suspendUser = async (user) => {
  if (!canManageUserStatus.value || isSelf(user)) return
  const reason = window.prompt('请输入暂停原因（可选）：', '') || ''
  statusLoading.value = { ...statusLoading.value, [user.id]: true }
  try {
    await updateAdminUserStatus(user.id, 'suspended', reason)
    window.$message?.success('用户已暂停')
    await Promise.all([loadUsers({ force: true }), loadLogs({ force: true })])
  } catch (error) {
    if (!error?.__handled) window.$message?.error(getErrorMessage(error, '暂停用户失败'))
  } finally {
    statusLoading.value = { ...statusLoading.value, [user.id]: false }
  }
}

const activateUser = async (user) => {
  if (!canManageUserStatus.value || isSelf(user)) return
  statusLoading.value = { ...statusLoading.value, [user.id]: true }
  try {
    await updateAdminUserStatus(user.id, 'active')
    window.$message?.success('用户已恢复')
    await Promise.all([loadUsers({ force: true }), loadLogs({ force: true })])
  } catch (error) {
    if (!error?.__handled) window.$message?.error(getErrorMessage(error, '恢复用户失败'))
  } finally {
    statusLoading.value = { ...statusLoading.value, [user.id]: false }
  }
}

const deleteUser = async (user) => {
  if (!canManageUserStatus.value || isSelf(user)) return
  const ok = window.confirm(`确认删除用户 ${user.email} 吗？删除后将禁用该账号访问。`)
  if (!ok) return
  deleting.value = { ...deleting.value, [user.id]: true }
  try {
    await deleteAdminUser(user.id)
    window.$message?.success('用户已删除')
    await Promise.all([loadUsers({ force: true }), loadLogs({ force: true })])
  } catch (error) {
    if (!error?.__handled) window.$message?.error(getErrorMessage(error, '删除用户失败'))
  } finally {
    deleting.value = { ...deleting.value, [user.id]: false }
  }
}

const assignApiKey = async (user) => {
  if (!canAssignApiKeys.value) return
  const apiName = String(assignSelections.value[user.id] || '').trim()
  if (!apiName) return window.$message?.warning('请先选择一个 API 密钥')
  assignmentLoading.value = { ...assignmentLoading.value, [user.id]: true }
  try {
    await assignAdminApiKeyToUser(user.id, apiName)
    window.$message?.success('API 密钥分配成功')
    assignSelections.value = { ...assignSelections.value, [user.id]: '' }
    await Promise.all([loadUsers({ force: true }), loadLogs({ force: true })])
  } catch (error) {
    if (!error?.__handled) window.$message?.error(getErrorMessage(error, '分配 API 密钥失败'))
  } finally {
    assignmentLoading.value = { ...assignmentLoading.value, [user.id]: false }
  }
}

const unassignApiKey = async (user, apiName) => {
  if (!canAssignApiKeys.value) return
  assignmentLoading.value = { ...assignmentLoading.value, [user.id]: true }
  try {
    await unassignAdminApiKeyFromUser(user.id, apiName)
    window.$message?.success('API 密钥解绑成功')
    await Promise.all([loadUsers({ force: true }), loadLogs({ force: true })])
  } catch (error) {
    if (!error?.__handled) window.$message?.error(getErrorMessage(error, '解绑 API 密钥失败'))
  } finally {
    assignmentLoading.value = { ...assignmentLoading.value, [user.id]: false }
  }
}

const loadLogs = async ({ force = false } = {}) => {
  if (!canReadAudit.value) return
  if (loadLogsPromise && !force) return loadLogsPromise
  loadingLogs.value = true
  loadLogsPromise = (async () => {
    try {
      const rsp = await getAdminAuditLogs({ page: logQuery.value.page, limit: logQuery.value.limit })
      auditLogs.value = Array.isArray(rsp?.data) ? rsp.data : []
      pagination.value = {
        page: Number(rsp?.pagination?.page || logQuery.value.page || 1),
        limit: Number(rsp?.pagination?.limit || logQuery.value.limit || 20),
        total: Number(rsp?.pagination?.total || 0)
      }
    } catch (error) {
      if (!error?.__handled) window.$message?.error(getErrorMessage(error, '加载审计日志失败'))
    } finally {
      loadingLogs.value = false
    }
  })()
  try {
    return await loadLogsPromise
  } finally {
    loadLogsPromise = null
  }
}

const refreshOverview = async () => {
  await loadUsage({ force: true })
}

const loadAll = async ({ force = false } = {}) => {
  if (loadAllPromise && !force) return loadAllPromise
  const allowed = await auth.loadAdminSession({ force: true })
  if (!allowed) {
    router.replace('/')
    return
  }

  loadAllPromise = (async () => {
    const tasks = []
    if (canReadUsage.value) tasks.push(loadUsage({ force }))
    if (canReadUsers.value) tasks.push(loadUsers({ force }))
    if (showServiceSection.value) tasks.push(load302All({ force }))
    if (canReadAudit.value) tasks.push(loadLogs({ force }))
    await Promise.all(tasks)
  })()
  try {
    return await loadAllPromise
  } finally {
    loadAllPromise = null
  }
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
  window.addEventListener('scroll', onMainScroll, { passive: true })
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
  window.removeEventListener('scroll', onMainScroll)
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
  overflow: hidden;
}

.admin-sidebar {
  background: linear-gradient(180deg, rgba(8, 8, 9, 0.72) 0%, rgba(12, 12, 14, 0.8) 100%);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.admin-main {
  background: linear-gradient(180deg, rgba(18, 18, 20, 0.72) 0%, rgba(11, 11, 13, 0.84) 100%);
  min-width: 0;
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

.role-editor-card {
  display: flex;
  min-width: 180px;
  flex-direction: column;
  gap: 10px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  padding: 12px;
}

.action-editor-card {
  display: flex;
  min-width: 260px;
  flex-direction: column;
  gap: 12px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  padding: 12px;
}

.action-editor-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.action-editor-select {
  width: 100%;
  min-width: 180px;
}

.action-editor-main {
  width: 100%;
}

.action-editor-actions {
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

.service-alert {
  border-radius: 14px;
  border: 1px solid rgba(255, 196, 0, 0.22);
  background: rgba(255, 196, 0, 0.08);
  padding: 14px 16px;
  font-size: 13px;
  line-height: 1.6;
  color: rgba(255, 233, 169, 0.92);
}

.insight-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.02));
  padding: 10px 12px;
}
</style>
