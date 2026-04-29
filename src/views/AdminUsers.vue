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
                <button v-if="canReadUsers" class="ui-action-btn whitespace-nowrap" @click="scrollToSection('users')">用户服务</button>
                <button v-if="showServiceSection" class="ui-action-btn whitespace-nowrap" @click="scrollToSection('service')">消耗对账</button>
                <button class="ui-action-btn whitespace-nowrap" @click="goHome">返回首页</button>
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
                    <div class="ui-info-line"><span>未开通服务用户</span><strong class="text-amber-100">{{ notEnabledActiveUsers.length }}</strong></div>
                    <div class="ui-info-line"><span>待对账用户</span><strong class="text-amber-100">{{ pendingBillingUsers }}</strong></div>
                    <div class="ui-info-line"><span>已开通服务</span><strong>{{ activeServiceUsers }}</strong></div>
                  </div>
                  <div class="mt-4 space-y-2">
                    <p class="text-xs uppercase tracking-[0.12em] text-white/40">Top 消耗用户</p>
                    <div v-if="topSpenders.length === 0" class="text-xs text-white/45">暂无归因成本数据</div>
                    <div v-for="item in topSpenders" :key="`spender-${item.id}`" class="insight-row">
                      <div>
                        <p class="text-sm text-white/88">{{ item.displayName || item.email || item.id }}</p>
                        <p class="text-[11px] text-white/45">{{ item.service?.serviceIdentifier || '-' }}</p>
                      </div>
                      <strong>{{ formatUsd(item.officialUsage?.totalCostAmount, 2) }}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section v-if="canReadUsers" ref="usersRef" class="ui-glass-card mb-8 scroll-mt-6 rounded-2xl p-5 md:p-6">
            <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 class="section-title">用户服务</h2>
                <p class="section-caption">围绕用户服务状态、开通操作、官方消耗和待处理事项组织。</p>
              </div>
              <button class="ui-micro-btn" :disabled="loadingUsers" @click="loadUsers">
                {{ loadingUsers ? '刷新中...' : '刷新用户列表' }}
              </button>
            </div>

            <div class="mb-5 grid grid-cols-1 gap-3 md:grid-cols-4">
              <div class="service-metric">
                <p>服务开通率</p>
                <strong>{{ serviceActivationRate }}%</strong>
              </div>
              <div class="service-metric">
                <p>待处理服务</p>
                <strong>{{ notEnabledActiveUsers.length }}</strong>
              </div>
              <div class="service-metric">
                <p>待对账用户</p>
                <strong>{{ pendingBillingUsers }}</strong>
              </div>
              <div class="service-metric">
                <p>当前显示</p>
                <strong>{{ filteredUsers.length }}</strong>
              </div>
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
              <table class="w-full min-w-[1120px] text-sm">
                <thead>
                  <tr class="border-b border-white/10 text-left text-xs uppercase tracking-[0.12em] text-white/40">
                    <th class="px-3 py-4">用户</th>
                    <th class="px-3 py-4">服务状态</th>
                    <th class="px-3 py-4">官方消耗</th>
                    <th class="px-3 py-4">对账</th>
                    <th v-if="showUserActions" class="px-3 py-4">服务操作</th>
                    <th v-if="canManageRoles || canManageUserStatus" class="px-3 py-4">账号与角色</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in pagedUsers" :key="item.id" class="border-b border-white/5 align-top hover:bg-white/[0.03]">
                    <td class="px-3 py-4">
                      <p class="font-medium text-white/90">{{ item.displayName || '-' }}</p>
                      <p class="text-xs text-white/50">{{ item.email }}</p>
                      <p class="mt-1 text-[11px] text-white/35">ID: {{ item.id }}</p>
                      <div class="mt-2 flex flex-wrap gap-1.5">
                        <span class="ui-status-pill" :class="statusClass(item.status)">{{ statusLabel(item.status) }}</span>
                        <span v-for="role in item.roles || []" :key="`${item.id}-${role}`" class="ui-tag-pill">{{ roleLabel(role) }}</span>
                      </div>
                      <p v-if="item.suspendedReason" class="mt-2 max-w-[180px] text-[11px] leading-5 text-white/45">
                        {{ item.suspendedReason }}
                      </p>
                    </td>
                    <td class="px-3 py-4">
                      <span class="ui-status-pill" :class="serviceStatusClass(item.service?.serviceStatus)">{{ serviceStatusLabel(item.service?.serviceStatus) }}</span>
                      <p class="mt-2 text-xs text-white/45">{{ item.service?.serviceIdentifier || '尚未开通' }}</p>
                      <p v-if="item.service?.lastError" class="mt-1 max-w-[180px] text-[11px] leading-5 text-rose-100/70">{{ item.service.lastError }}</p>
                    </td>
                    <td class="px-3 py-4 text-white/85">
                      <p>{{ item.officialUsage?.totalCalls || 0 }} 次</p>
                      <p class="mt-1 text-xs text-white/45">{{ formatUsd(item.officialUsage?.totalCostAmount, 4) }} {{ item.officialUsage?.currency || 'USD' }}</p>
                      <p class="mt-1 text-[11px] text-white/35">{{ topModelLabel(item) }}</p>
                      <p class="mt-1 text-[11px] text-white/35">本地估算 {{ formatUsd(item.estimatedUsage?.totalCostAmount || item.usage?.totalCostUsd, 4) }} USD</p>
                    </td>
                    <td class="px-3 py-4">
                      <p class="mt-1 text-[11px]" :class="item.usageMeta?.pendingBillingCount ? 'text-amber-200/80' : 'text-white/35'">
                        {{ item.reconciliation?.pendingCount ? `待对账 ${item.reconciliation.pendingCount} 条` : '无待对账' }}
                      </p>
                      <p class="mt-1 text-[11px]" :class="item.reconciliation?.unmatchedCount ? 'text-rose-200/80' : 'text-white/35'">
                        {{ item.reconciliation?.unmatchedCount ? `异常 ${item.reconciliation.unmatchedCount} 条` : '无异常账单' }}
                      </p>
                      <p class="mt-1 text-[11px] text-white/35">差异 {{ formatUsd(item.reconciliation?.diffAmount, 4) }} USD</p>
                      <p class="mt-1 text-[11px] text-white/35">最近活跃 {{ formatDateTime(item.usageMeta?.lastActivityAt) }}</p>
                    </td>
                    <td v-if="showUserActions" class="px-3 py-4">
                      <div class="action-editor-card">
                        <div v-if="canActivateService || canDisableService || canResetService || canUpdateServiceLimits" class="action-editor-block">
                          <button
                            v-if="canActivateService && ['not_enabled', 'create_failed', 'deleted'].includes(item.service?.serviceStatus || 'not_enabled')"
                            class="ui-micro-btn ui-micro-btn-primary action-editor-main"
                            :disabled="serviceLoading[item.id] || item.status === 'deleted'"
                            @click="activateService(item)"
                          >
                            {{ serviceLoading[item.id] ? '开通中...' : '开通服务' }}
                          </button>
                          <div v-if="item.service?.serviceStatus === 'active'" class="action-editor-actions">
                            <button v-if="canDisableService" class="ui-micro-btn" :disabled="serviceLoading[item.id]" @click="disableService(item)">停用服务</button>
                            <button v-if="canResetService" class="ui-micro-btn" :disabled="serviceLoading[item.id]" @click="resetService(item)">重置凭证</button>
                            <button v-if="canUpdateServiceLimits" class="ui-micro-btn" :disabled="serviceLoading[item.id]" @click="updateServiceLimits(item)">调整额度</button>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td v-if="canManageRoles || canManageUserStatus" class="px-3 py-4">
                      <div class="account-editor-card">
                        <div v-if="canManageRoles" class="action-editor-block">
                          <p class="text-[11px] text-white/45">角色</p>
                          <select
                            v-model="selectedRoles[item.id]"
                            class="ui-text-input action-editor-select"
                            :disabled="item.status === 'deleted' || isSelf(item)"
                          >
                            <option v-for="role in roleOptions" :key="`${item.id}-${role.value}`" :value="role.value">
                              {{ role.label }}
                            </option>
                          </select>
                          <button
                            class="ui-micro-btn ui-micro-btn-primary action-editor-main"
                            :disabled="saving[item.id] || item.status === 'deleted' || isSelf(item)"
                            @click="saveRoles(item)"
                          >
                            {{ saving[item.id] ? '保存中...' : (isSelf(item) ? '禁止操作自己' : '保存角色') }}
                          </button>
                        </div>
                        <div v-if="canManageUserStatus" class="action-editor-block">
                          <p class="text-[11px] text-white/45">账号</p>
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
                <h2 class="section-title">消耗对账</h2>
                <p class="section-caption">官方消耗同步、请求查询和服务调用日志集中在这里处理。</p>
              </div>
              <button class="ui-micro-btn" :disabled="loading302" @click="load302All">
                {{ loading302 ? '刷新中...' : '刷新服务数据' }}
              </button>
              <button v-if="canReconcileBilling" class="ui-micro-btn ui-micro-btn-primary" :disabled="reconcilingBilling" @click="reconcileBilling">
                {{ reconcilingBilling ? '同步中...' : '同步官方消耗' }}
              </button>
            </div>

            <div v-if="serviceLoadNotice" class="service-alert">
              {{ serviceLoadNotice }}
            </div>

            <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div class="ui-glass-card rounded-xl p-4">
                <p class="text-xs uppercase tracking-[0.12em] text-white/40">账户余额</p>
                <p class="mt-2 text-2xl font-semibold text-white">{{ canReadUsage ? balanceDisplay : '--' }}</p>
                <p class="mt-2 text-xs text-white/45">{{ canReadUsage ? '当前服务余额' : '需要权限：admin.usage.read_all' }}</p>
              </div>
              <div class="ui-glass-card rounded-xl p-4">
                <p class="text-xs uppercase tracking-[0.12em] text-white/40">已开通服务</p>
                <p class="mt-2 text-2xl font-semibold text-white">{{ canReadUsers ? activeServiceUsers : '--' }}</p>
                <p class="mt-2 text-xs text-white/45">当前 active 服务凭证用户数</p>
              </div>
              <div class="ui-glass-card rounded-xl p-4">
                <p class="text-xs uppercase tracking-[0.12em] text-white/40">日志结果数</p>
                <p class="mt-2 text-2xl font-semibold text-white">{{ canReadUsage ? apiLogs.length : '--' }}</p>
                <p class="mt-2 text-xs text-white/45">{{ canReadUsage ? '当前日志查询返回行数' : '需要权限：admin.usage.read_all' }}</p>
              </div>
            </div>

            <div v-if="canReadUsage" class="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_1.8fr]">
              <div class="ui-glass-card rounded-2xl p-4">
                <h3 class="text-sm font-medium text-white">消耗详情（请求 ID）</h3>
                <div class="mt-3 flex flex-wrap gap-2">
                  <input v-model="recordRequestId" class="ui-text-input" placeholder="粘贴请求 ID" />
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
                  <h3 class="text-sm font-medium text-white">服务调用日志查询</h3>
                  <div class="flex flex-wrap items-center gap-2">
                    <input v-model="log302Query.start" type="datetime-local" class="ui-text-input !w-[190px]" />
                    <input v-model="log302Query.end" type="datetime-local" class="ui-text-input !w-[190px]" />
                    <input v-model.number="log302Query.page" type="number" min="1" class="ui-number-input" />
                    <input v-model.number="log302Query.limit" type="number" min="1" max="50" class="ui-number-input" />
                    <button class="ui-micro-btn" :disabled="loadingApiLogs" @click="loadApiLogs">查询</button>
                  </div>
                </div>
                <div v-if="apiLogs.length === 0" class="empty-notice">暂无服务调用日志</div>
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

            <div v-if="!canReadUsage && !canReconcileBilling" class="empty-notice">
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
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  activateAdminUserService,
  deleteAdminUser,
  disableAdminUserService,
  getAdminAuditLogs,
  getAdminUsageSummary,
  getAdminUsageTimeseries,
  getAdminUsers,
  reconcileAdminBilling,
  resetAdminUserService,
  updateAdminUserServiceLimits,
  updateAdminUserRoles,
  updateAdminUserStatus
} from '@/api/admin'
import { useAdminServiceOps } from '@/hooks/useAdminServiceOps'
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
const saving = ref({})
const statusLoading = ref({})
const deleting = ref({})
const serviceLoading = ref({})
const reconcilingBilling = ref(false)
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
const canActivateService = computed(() => auth.hasPermission('admin.service_access.activate'))
const canDisableService = computed(() => auth.hasPermission('admin.service_access.disable'))
const canResetService = computed(() => auth.hasPermission('admin.service_access.reset'))
const canUpdateServiceLimits = computed(() => auth.hasPermission('admin.service_access.update_limits'))
const canReconcileBilling = computed(() => auth.hasPermission('admin.billing.reconcile'))
const showServiceSection = computed(() => canReadUsage.value || canReconcileBilling.value)
const showUserActions = computed(() => canActivateService.value || canDisableService.value || canResetService.value || canUpdateServiceLimits.value || canManageUserStatus.value)
const {
  apiLogs,
  balanceDisplay,
  load302All,
  loadApiLogs,
  loading302,
  loadingApiLogs,
  loadingRecord,
  log302Query,
  queryRecord,
  recordData,
  recordRequestId,
  serviceLoadNotice
} = useAdminServiceOps({
  canReadUsage,
  canManageApiKeys: computed(() => false),
  canAssignApiKeys: computed(() => false),
  loadUsers: () => loadUsers(),
  loadLogs: () => loadLogs()
})

const navItems = computed(() => {
  const items = [
    { key: 'overview', label: '概览', note: '总览' }
  ]
  if (canReadUsers.value) items.push({ key: 'users', label: '用户服务', note: '开通' })
  if (showServiceSection.value) items.push({ key: 'service', label: '消耗对账', note: '同步' })
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
  if (canActivateService.value || canDisableService.value || canResetService.value) items.push('服务访问')
  if (canReconcileBilling.value) items.push('对账')
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
  { label: '官方消耗 (USD)', value: canReadUsage.value ? Number(usageSummary.value.totalCostUsd || 0).toFixed(2) : '--', note: canReadUsage.value ? '累计官方消耗' : '无用量权限' },
  { label: '审计条目', value: canReadAudit.value ? pagination.value.total : '--', note: canReadAudit.value ? '当前审计日志总条数' : '无审计权限' },
  { label: '已开通服务', value: canReadUsers.value ? activeServiceUsers.value : '--', note: canReadUsers.value ? '当前可调用服务的用户数' : '缺少权限' }
])

const formatUsd = (value, digits = 2) => Number(value || 0).toFixed(digits)

const topSpenders = computed(() => {
  return [...users.value]
    .filter((item) => Number(item?.officialUsage?.totalCostAmount || 0) > 0)
    .sort((a, b) => Number(b?.officialUsage?.totalCostAmount || 0) - Number(a?.officialUsage?.totalCostAmount || 0))
    .slice(0, 5)
})

const notEnabledActiveUsers = computed(() => {
  return users.value.filter((item) => {
    const status = String(item.status || 'active')
    const serviceStatus = String(item.service?.serviceStatus || 'not_enabled')
    return status === 'active' && serviceStatus !== 'active'
  })
})

const pendingBillingUsers = computed(() => {
  return users.value.filter((item) => Number(item?.reconciliation?.pendingCount || 0) > 0).length
})

const activeServiceUsers = computed(() => users.value.filter((item) => item.service?.serviceStatus === 'active').length)
const serviceActivationRate = computed(() => {
  const total = users.value.filter((item) => String(item.status || 'active') === 'active').length
  if (!total) return 0
  return Math.round((activeServiceUsers.value / total) * 100)
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
      const costGap = Number(b?.officialUsage?.totalCostAmount || 0) - Number(a?.officialUsage?.totalCostAmount || 0)
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

const serviceStatusClass = (status) => {
  const val = String(status || 'not_enabled')
  if (val === 'active') return 'ui-status-pill-active'
  if (val === 'disabled' || val === 'deleted') return 'ui-status-pill-suspended'
  if (val === 'create_failed') return 'ui-status-pill-deleted'
  return ''
}

const serviceStatusLabel = (status) => {
  const val = String(status || 'not_enabled')
  if (val === 'active') return '已开通'
  if (val === 'disabled') return '已停用'
  if (val === 'create_failed') return '创建失败'
  if (val === 'deleted') return '已删除'
  return '未开通'
}

const topModelLabel = (user) => {
  const model = user?.officialUsage?.byModel?.[0]
  if (!model) return '暂无模型明细'
  return `${model.model || '未命名模型'} · ${model.calls || 0} 次`
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

const loadUsage = async () => {
  if (!canReadUsage.value) return
  loadingUsage.value = true
  try {
    const [summaryRsp, seriesRsp] = await Promise.all([getAdminUsageSummary(), getAdminUsageTimeseries()])
    usageSummary.value = summaryRsp?.data || usageSummary.value
    usageSeries.value = Array.isArray(seriesRsp?.data) ? seriesRsp.data : []
  } catch (error) {
    if (!error?.__handled) window.$message?.error(getErrorMessage(error, '加载用量概览失败'))
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
    for (const item of list) {
      nextSelection[item.id] = Array.isArray(item.roles) && item.roles.length ? item.roles[0] : 'user'
    }
    selectedRoles.value = nextSelection
  } catch (error) {
    if (!error?.__handled) window.$message?.error(getErrorMessage(error, '加载用户列表失败'))
  } finally {
    loadingUsers.value = false
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
    await Promise.all([loadUsers(), loadLogs()])
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
    await Promise.all([loadUsers(), loadLogs()])
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
    await Promise.all([loadUsers(), loadLogs()])
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
    await Promise.all([loadUsers(), loadLogs()])
  } catch (error) {
    if (!error?.__handled) window.$message?.error(getErrorMessage(error, '删除用户失败'))
  } finally {
    deleting.value = { ...deleting.value, [user.id]: false }
  }
}

const activateService = async (user) => {
  if (!canActivateService.value) return
  serviceLoading.value = { ...serviceLoading.value, [user.id]: true }
  try {
    await activateAdminUserService(user.id, { limitCost: 0, limitDailyCost: 0, expiredOn: 0 })
    window.$message?.success('服务已开通')
    await Promise.all([loadUsers(), loadLogs()])
  } catch (error) {
    if (!error?.__handled) window.$message?.error(getErrorMessage(error, '开通服务失败'))
  } finally {
    serviceLoading.value = { ...serviceLoading.value, [user.id]: false }
  }
}

const disableService = async (user) => {
  if (!canDisableService.value) return
  const reason = window.prompt('请输入停用原因（可选）：', '') || ''
  serviceLoading.value = { ...serviceLoading.value, [user.id]: true }
  try {
    await disableAdminUserService(user.id, reason)
    window.$message?.success('服务已停用')
    await Promise.all([loadUsers(), loadLogs()])
  } catch (error) {
    if (!error?.__handled) window.$message?.error(getErrorMessage(error, '停用服务失败'))
  } finally {
    serviceLoading.value = { ...serviceLoading.value, [user.id]: false }
  }
}

const resetService = async (user) => {
  if (!canResetService.value) return
  const ok = window.confirm(`确认重置 ${user.email} 的服务凭证吗？历史消耗记录会保留。`)
  if (!ok) return
  serviceLoading.value = { ...serviceLoading.value, [user.id]: true }
  try {
    await resetAdminUserService(user.id)
    window.$message?.success('服务凭证已重置')
    await Promise.all([loadUsers(), loadLogs()])
  } catch (error) {
    if (!error?.__handled) window.$message?.error(getErrorMessage(error, '重置服务凭证失败'))
  } finally {
    serviceLoading.value = { ...serviceLoading.value, [user.id]: false }
  }
}

const updateServiceLimits = async (user) => {
  if (!canUpdateServiceLimits.value) return
  const limitCost = Number(window.prompt('请输入总额度（USD，0 表示不限制）：', user.service?.limitCost ?? 0) || 0)
  const limitDailyCost = Number(window.prompt('请输入日额度（USD，0 表示不限制）：', user.service?.limitDailyCost ?? 0) || 0)
  if (!Number.isFinite(limitCost) || !Number.isFinite(limitDailyCost) || limitCost < 0 || limitDailyCost < 0) {
    window.$message?.warning('额度必须是非负数字')
    return
  }
  serviceLoading.value = { ...serviceLoading.value, [user.id]: true }
  try {
    await updateAdminUserServiceLimits(user.id, {
      limitCost,
      limitDailyCost,
      expiredOn: Number(user.service?.expiredOn || 0)
    })
    window.$message?.success('服务额度已更新')
    await Promise.all([loadUsers(), loadLogs()])
  } catch (error) {
    if (!error?.__handled) window.$message?.error(getErrorMessage(error, '调整服务额度失败'))
  } finally {
    serviceLoading.value = { ...serviceLoading.value, [user.id]: false }
  }
}

const reconcileBilling = async () => {
  if (!canReconcileBilling.value) return
  reconcilingBilling.value = true
  try {
    const rsp = await reconcileAdminBilling()
    const data = rsp?.data || {}
    window.$message?.success(`同步完成：${data.matched || 0} 条已匹配，${data.unmatched || 0} 条未匹配`)
    await Promise.all([loadUsers(), loadUsage(), loadLogs()])
  } catch (error) {
    if (!error?.__handled) window.$message?.error(getErrorMessage(error, '同步官方消耗失败'))
  } finally {
    reconcilingBilling.value = false
  }
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
    if (!error?.__handled) window.$message?.error(getErrorMessage(error, '加载审计日志失败'))
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

.action-editor-card,
.account-editor-card {
  display: flex;
  min-width: 220px;
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

.service-metric {
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.035);
  padding: 14px;
}

.service-metric p {
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.42);
}

.service-metric strong {
  margin-top: 8px;
  display: block;
  font-size: 24px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.94);
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
