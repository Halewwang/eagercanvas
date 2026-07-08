import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { test } from 'node:test'

const adminFeaturesDir = new URL('../components/admin/features/', import.meta.url)
const source = readFileSync(new URL('./AdminUsers.vue', import.meta.url), 'utf8')
const usageAdminSource = readFileSync(new URL('./UsageAdmin.vue', import.meta.url), 'utf8')
const styleUrl = new URL('../style.css', import.meta.url)
const adminCompactMetricCardUrl = new URL('../components/admin/AdminCompactMetricCard.vue', import.meta.url)
const adminControlFieldUrl = new URL('../components/admin/AdminControlField.vue', import.meta.url)
const adminFilterFieldUrl = new URL('../components/admin/AdminFilterField.vue', import.meta.url)
const adminFilterToolbarUrl = new URL('../components/admin/AdminFilterToolbar.vue', import.meta.url)
const adminMobileNavUrl = new URL('../components/admin/AdminMobileNav.vue', import.meta.url)
const adminEmptyStateUrl = new URL('../components/admin/AdminEmptyState.vue', import.meta.url)
const adminEditorActionsUrl = new URL('../components/admin/AdminEditorActions.vue', import.meta.url)
const adminEditorBlockUrl = new URL('../components/admin/AdminEditorBlock.vue', import.meta.url)
const adminEditorCardUrl = new URL('../components/admin/AdminEditorCard.vue', import.meta.url)
const adminEditorMainButtonUrl = new URL('../components/admin/AdminEditorMainButton.vue', import.meta.url)
const adminEditorSelectUrl = new URL('../components/admin/AdminEditorSelect.vue', import.meta.url)
const adminGlassMetricCardUrl = new URL('../components/admin/AdminGlassMetricCard.vue', import.meta.url)
const adminGlassSurfaceUrl = new URL('../components/admin/AdminGlassSurface.vue', import.meta.url)
const adminHeaderActionButtonUrl = new URL('../components/admin/AdminHeaderActionButton.vue', import.meta.url)
const adminInfoLineUrl = new URL('../components/admin/AdminInfoLine.vue', import.meta.url)
const adminMicroButtonUrl = new URL('../components/admin/AdminMicroButton.vue', import.meta.url)
const adminPermissionChipUrl = new URL('../components/admin/AdminPermissionChip.vue', import.meta.url)
const adminDashboardSectionFrameUrl = new URL('../components/admin/AdminDashboardSectionFrame.vue', import.meta.url)
const adminPanelCardUrl = new URL('../components/admin/AdminPanelCard.vue', import.meta.url)
const adminPageHeaderUrl = new URL('../components/admin/AdminPageHeader.vue', import.meta.url)
const adminNoticeUrl = new URL('../components/admin/AdminNotice.vue', import.meta.url)
const adminPaginationBarUrl = new URL('../components/admin/AdminPaginationBar.vue', import.meta.url)
const adminSidebarUrl = new URL('../components/admin/AdminSidebar.vue', import.meta.url)
const adminSidebarFrameUrl = new URL('../components/admin/AdminSidebarFrame.vue', import.meta.url)
const adminSidebarNavItemUrl = new URL('../components/admin/AdminSidebarNavItem.vue', import.meta.url)
const adminSectionHeaderUrl = new URL('../components/admin/AdminSectionHeader.vue', import.meta.url)
const adminShellUrl = new URL('../components/admin/AdminShell.vue', import.meta.url)
const adminStatusPillUrl = new URL('../components/admin/AdminStatusPill.vue', import.meta.url)
const adminTableShellUrl = new URL('../components/admin/AdminTableShell.vue', import.meta.url)
const adminTagPillUrl = new URL('../components/admin/AdminTagPill.vue', import.meta.url)
const adminAuditLogSectionUrl = new URL('../components/admin/features/AdminAuditLogSection.vue', import.meta.url)
const adminAuditLogFiltersUrl = new URL('../components/admin/features/AdminAuditLogFilters.vue', import.meta.url)
const adminAuditLogPaginationSummaryUrl = new URL('../components/admin/features/AdminAuditLogPaginationSummary.vue', import.meta.url)
const adminAuditLogRowUrl = new URL('../components/admin/features/AdminAuditLogRow.vue', import.meta.url)
const adminDashboardSectionsUrl = new URL('../components/admin/features/AdminDashboardSections.vue', import.meta.url)
const adminIssueInboxSectionUrl = new URL('../components/admin/features/AdminIssueInboxSection.vue', import.meta.url)
const adminOverviewInsightPanelUrl = new URL('../components/admin/features/AdminOverviewInsightPanel.vue', import.meta.url)
const adminOverviewMetricGridUrl = new URL('../components/admin/features/AdminOverviewMetricGrid.vue', import.meta.url)
const adminOverviewSectionUrl = new URL('../components/admin/features/AdminOverviewSection.vue', import.meta.url)
const adminOverviewSessionPanelUrl = new URL('../components/admin/features/AdminOverviewSessionPanel.vue', import.meta.url)
const adminOverviewTopSpendersListUrl = new URL('../components/admin/features/AdminOverviewTopSpendersList.vue', import.meta.url)
const adminOverviewUsageTrendPanelUrl = new URL('../components/admin/features/AdminOverviewUsageTrendPanel.vue', import.meta.url)
const userAccountActionsUrl = new URL('../components/admin/features/AdminUserAccountActions.vue', import.meta.url)
const userRoleActionsUrl = new URL('../components/admin/features/AdminUserRoleActions.vue', import.meta.url)
const userStatusActionsUrl = new URL('../components/admin/features/AdminUserStatusActions.vue', import.meta.url)
const userIdentityCellUrl = new URL('../components/admin/features/AdminUserIdentityCell.vue', import.meta.url)
const userIdentityMetaUrl = new URL('../components/admin/features/AdminUserIdentityMeta.vue', import.meta.url)
const userReconciliationCellUrl = new URL('../components/admin/features/AdminUserReconciliationCell.vue', import.meta.url)
const userServiceFiltersUrl = new URL('../components/admin/features/AdminUserServiceFilters.vue', import.meta.url)
const userServiceFilterSummaryUrl = new URL('../components/admin/features/AdminUserServiceFilterSummary.vue', import.meta.url)
const userServiceHeaderUrl = new URL('../components/admin/features/AdminUserServiceHeader.vue', import.meta.url)
const userServiceStatusCellUrl = new URL('../components/admin/features/AdminUserServiceStatusCell.vue', import.meta.url)
const userServiceActionsUrl = new URL('../components/admin/features/AdminUserServiceActions.vue', import.meta.url)
const userServiceActivationActionUrl = new URL('../components/admin/features/AdminUserServiceActivationAction.vue', import.meta.url)
const userManualServiceKeyModalUrl = new URL('../components/admin/features/AdminManualServiceKeyModal.vue', import.meta.url)
const userServiceActiveActionsUrl = new URL('../components/admin/features/AdminUserServiceActiveActions.vue', import.meta.url)
const userServiceActionsCellUrl = new URL('../components/admin/features/AdminUserServiceActionsCell.vue', import.meta.url)
const userAccountActionsCellUrl = new URL('../components/admin/features/AdminUserAccountActionsCell.vue', import.meta.url)
const userOperationsCellUrl = new URL('../components/admin/features/AdminUserOperationsCell.vue', import.meta.url)
const userServicePaginationUrl = new URL('../components/admin/features/AdminUserServicePagination.vue', import.meta.url)
const userServiceEmptyStateUrl = new URL('../components/admin/features/AdminUserServiceEmptyState.vue', import.meta.url)
const userServiceResultsPanelUrl = new URL('../components/admin/features/AdminUserServiceResultsPanel.vue', import.meta.url)
const userServiceRowUrl = new URL('../components/admin/features/AdminUserServiceRow.vue', import.meta.url)
const userServiceSummaryMetricsUrl = new URL('../components/admin/features/AdminUserServiceSummaryMetrics.vue', import.meta.url)
const userServiceTableHeaderUrl = new URL('../components/admin/features/AdminUserServiceTableHeader.vue', import.meta.url)
const userServiceTableUrl = new URL('../components/admin/features/AdminUserServiceTable.vue', import.meta.url)
const userUsageCellUrl = new URL('../components/admin/features/AdminUserUsageCell.vue', import.meta.url)
const userServiceSectionUrl = new URL('../components/admin/features/AdminUserServiceSection.vue', import.meta.url)
const serviceApiLogFiltersUrl = new URL('../components/admin/features/AdminServiceApiLogFilters.vue', import.meta.url)
const serviceApiLogRowUrl = new URL('../components/admin/features/AdminServiceApiLogRow.vue', import.meta.url)
const serviceApiLogsPanelUrl = new URL('../components/admin/features/AdminServiceApiLogsPanel.vue', import.meta.url)
const serviceRecordQueryPanelUrl = new URL('../components/admin/features/AdminServiceRecordQueryPanel.vue', import.meta.url)
const serviceRecordSummaryUrl = new URL('../components/admin/features/AdminServiceRecordSummary.vue', import.meta.url)
const serviceReconciliationHeaderUrl = new URL('../components/admin/features/AdminServiceReconciliationHeader.vue', import.meta.url)
const serviceReconciliationSummaryMetricsUrl = new URL('../components/admin/features/AdminServiceReconciliationSummaryMetrics.vue', import.meta.url)
const serviceReconciliationSectionUrl = new URL('../components/admin/features/AdminServiceReconciliationSection.vue', import.meta.url)
const adminSectionNavigationUrl = new URL('../hooks/useAdminSectionNavigation.js', import.meta.url)
const adminUsersStateUrl = new URL('../hooks/useAdminUsersState.js', import.meta.url)
const adminUserActionsUrl = new URL('../hooks/useAdminUserActions.js', import.meta.url)
const adminServiceOpsUrl = new URL('../hooks/useAdminServiceOps.js', import.meta.url)
const adminDashboardRefreshUrl = new URL('../hooks/useAdminDashboardRefresh.js', import.meta.url)
const adminDashboardSectionPropsUrl = new URL('../hooks/useAdminDashboardSectionProps.js', import.meta.url)
const adminUsersDashboardSectionsUrl = new URL('../hooks/useAdminUsersDashboardSections.js', import.meta.url)
const adminDashboardDataUrl = new URL('../hooks/useAdminDashboardData.js', import.meta.url)
const adminAccessStateUrl = new URL('../hooks/useAdminAccessState.js', import.meta.url)
const adminDisplayStateUrl = new URL('../hooks/useAdminDisplayState.js', import.meta.url)
const adminDisplayUrl = new URL('../utils/adminDisplay.js', import.meta.url)
const usageAdminSidebarUrl = new URL('../components/admin/features/UsageAdminSidebar.vue', import.meta.url)
const usageOverviewSectionUrl = new URL('../components/admin/features/UsageAdminOverviewSection.vue', import.meta.url)
const usageCredentialsSectionUrl = new URL('../components/admin/features/UsageAdminCredentialsSection.vue', import.meta.url)
const usageUsersSectionUrl = new URL('../components/admin/features/UsageAdminUsersSection.vue', import.meta.url)
const adminCompactMetricCardSource = existsSync(adminCompactMetricCardUrl) ? readFileSync(adminCompactMetricCardUrl, 'utf8') : ''
const adminControlFieldSource = existsSync(adminControlFieldUrl) ? readFileSync(adminControlFieldUrl, 'utf8') : ''
const adminFilterFieldSource = existsSync(adminFilterFieldUrl) ? readFileSync(adminFilterFieldUrl, 'utf8') : ''
const adminFilterToolbarSource = existsSync(adminFilterToolbarUrl) ? readFileSync(adminFilterToolbarUrl, 'utf8') : ''
const adminMobileNavSource = existsSync(adminMobileNavUrl) ? readFileSync(adminMobileNavUrl, 'utf8') : ''
const adminEmptyStateSource = existsSync(adminEmptyStateUrl) ? readFileSync(adminEmptyStateUrl, 'utf8') : ''
const adminEditorActionsSource = existsSync(adminEditorActionsUrl) ? readFileSync(adminEditorActionsUrl, 'utf8') : ''
const adminEditorBlockSource = existsSync(adminEditorBlockUrl) ? readFileSync(adminEditorBlockUrl, 'utf8') : ''
const adminEditorCardSource = existsSync(adminEditorCardUrl) ? readFileSync(adminEditorCardUrl, 'utf8') : ''
const adminEditorMainButtonSource = existsSync(adminEditorMainButtonUrl) ? readFileSync(adminEditorMainButtonUrl, 'utf8') : ''
const adminEditorSelectSource = existsSync(adminEditorSelectUrl) ? readFileSync(adminEditorSelectUrl, 'utf8') : ''
const adminGlassMetricCardSource = existsSync(adminGlassMetricCardUrl) ? readFileSync(adminGlassMetricCardUrl, 'utf8') : ''
const adminGlassSurfaceSource = existsSync(adminGlassSurfaceUrl) ? readFileSync(adminGlassSurfaceUrl, 'utf8') : ''
const adminHeaderActionButtonSource = existsSync(adminHeaderActionButtonUrl)
  ? readFileSync(adminHeaderActionButtonUrl, 'utf8')
  : ''
const adminInfoLineSource = existsSync(adminInfoLineUrl) ? readFileSync(adminInfoLineUrl, 'utf8') : ''
const adminMicroButtonSource = existsSync(adminMicroButtonUrl) ? readFileSync(adminMicroButtonUrl, 'utf8') : ''
const adminPermissionChipSource = existsSync(adminPermissionChipUrl) ? readFileSync(adminPermissionChipUrl, 'utf8') : ''
const adminDashboardSectionFrameSource = existsSync(adminDashboardSectionFrameUrl)
  ? readFileSync(adminDashboardSectionFrameUrl, 'utf8')
  : ''
const adminPanelCardSource = existsSync(adminPanelCardUrl) ? readFileSync(adminPanelCardUrl, 'utf8') : ''
const adminPageHeaderSource = existsSync(adminPageHeaderUrl) ? readFileSync(adminPageHeaderUrl, 'utf8') : ''
const adminNoticeSource = existsSync(adminNoticeUrl) ? readFileSync(adminNoticeUrl, 'utf8') : ''
const adminPaginationBarSource = existsSync(adminPaginationBarUrl) ? readFileSync(adminPaginationBarUrl, 'utf8') : ''
const adminSidebarSource = existsSync(adminSidebarUrl) ? readFileSync(adminSidebarUrl, 'utf8') : ''
const adminSidebarFrameSource = existsSync(adminSidebarFrameUrl) ? readFileSync(adminSidebarFrameUrl, 'utf8') : ''
const adminSidebarNavItemSource = existsSync(adminSidebarNavItemUrl) ? readFileSync(adminSidebarNavItemUrl, 'utf8') : ''
const adminSectionHeaderSource = existsSync(adminSectionHeaderUrl) ? readFileSync(adminSectionHeaderUrl, 'utf8') : ''
const adminShellSource = existsSync(adminShellUrl) ? readFileSync(adminShellUrl, 'utf8') : ''
const adminStatusPillSource = existsSync(adminStatusPillUrl) ? readFileSync(adminStatusPillUrl, 'utf8') : ''
const adminTableShellSource = existsSync(adminTableShellUrl) ? readFileSync(adminTableShellUrl, 'utf8') : ''
const adminTagPillSource = existsSync(adminTagPillUrl) ? readFileSync(adminTagPillUrl, 'utf8') : ''
const adminAuditLogSectionSource = existsSync(adminAuditLogSectionUrl) ? readFileSync(adminAuditLogSectionUrl, 'utf8') : ''
const adminAuditLogFiltersSource = existsSync(adminAuditLogFiltersUrl) ? readFileSync(adminAuditLogFiltersUrl, 'utf8') : ''
const adminAuditLogPaginationSummarySource = existsSync(adminAuditLogPaginationSummaryUrl)
  ? readFileSync(adminAuditLogPaginationSummaryUrl, 'utf8')
  : ''
const adminAuditLogRowSource = existsSync(adminAuditLogRowUrl) ? readFileSync(adminAuditLogRowUrl, 'utf8') : ''
const adminDashboardSectionsSource = existsSync(adminDashboardSectionsUrl) ? readFileSync(adminDashboardSectionsUrl, 'utf8') : ''
const adminIssueInboxSectionSource = existsSync(adminIssueInboxSectionUrl) ? readFileSync(adminIssueInboxSectionUrl, 'utf8') : ''
const adminOverviewInsightPanelSource = existsSync(adminOverviewInsightPanelUrl) ? readFileSync(adminOverviewInsightPanelUrl, 'utf8') : ''
const adminOverviewMetricGridSource = existsSync(adminOverviewMetricGridUrl) ? readFileSync(adminOverviewMetricGridUrl, 'utf8') : ''
const adminOverviewSectionSource = existsSync(adminOverviewSectionUrl) ? readFileSync(adminOverviewSectionUrl, 'utf8') : ''
const adminOverviewSessionPanelSource = existsSync(adminOverviewSessionPanelUrl) ? readFileSync(adminOverviewSessionPanelUrl, 'utf8') : ''
const adminOverviewTopSpendersListSource = existsSync(adminOverviewTopSpendersListUrl)
  ? readFileSync(adminOverviewTopSpendersListUrl, 'utf8')
  : ''
const adminOverviewUsageTrendPanelSource = existsSync(adminOverviewUsageTrendPanelUrl) ? readFileSync(adminOverviewUsageTrendPanelUrl, 'utf8') : ''
const userAccountActionsSource = existsSync(userAccountActionsUrl) ? readFileSync(userAccountActionsUrl, 'utf8') : ''
const userRoleActionsSource = existsSync(userRoleActionsUrl) ? readFileSync(userRoleActionsUrl, 'utf8') : ''
const userStatusActionsSource = existsSync(userStatusActionsUrl) ? readFileSync(userStatusActionsUrl, 'utf8') : ''
const userIdentityCellSource = existsSync(userIdentityCellUrl) ? readFileSync(userIdentityCellUrl, 'utf8') : ''
const userIdentityMetaSource = existsSync(userIdentityMetaUrl) ? readFileSync(userIdentityMetaUrl, 'utf8') : ''
const userReconciliationCellSource = existsSync(userReconciliationCellUrl) ? readFileSync(userReconciliationCellUrl, 'utf8') : ''
const userServiceFiltersSource = existsSync(userServiceFiltersUrl) ? readFileSync(userServiceFiltersUrl, 'utf8') : ''
const userServiceFilterSummarySource = existsSync(userServiceFilterSummaryUrl)
  ? readFileSync(userServiceFilterSummaryUrl, 'utf8')
  : ''
const userServiceHeaderSource = existsSync(userServiceHeaderUrl) ? readFileSync(userServiceHeaderUrl, 'utf8') : ''
const userServiceStatusCellSource = existsSync(userServiceStatusCellUrl) ? readFileSync(userServiceStatusCellUrl, 'utf8') : ''
const userServiceActionsSource = existsSync(userServiceActionsUrl) ? readFileSync(userServiceActionsUrl, 'utf8') : ''
const userServiceActivationActionSource = existsSync(userServiceActivationActionUrl)
  ? readFileSync(userServiceActivationActionUrl, 'utf8')
  : ''
const userManualServiceKeyModalSource = existsSync(userManualServiceKeyModalUrl)
  ? readFileSync(userManualServiceKeyModalUrl, 'utf8')
  : ''
const userServiceActiveActionsSource = existsSync(userServiceActiveActionsUrl)
  ? readFileSync(userServiceActiveActionsUrl, 'utf8')
  : ''
const userServiceActionsCellSource = existsSync(userServiceActionsCellUrl) ? readFileSync(userServiceActionsCellUrl, 'utf8') : ''
const userAccountActionsCellSource = existsSync(userAccountActionsCellUrl) ? readFileSync(userAccountActionsCellUrl, 'utf8') : ''
const userOperationsCellSource = existsSync(userOperationsCellUrl) ? readFileSync(userOperationsCellUrl, 'utf8') : ''
const userServicePaginationSource = existsSync(userServicePaginationUrl) ? readFileSync(userServicePaginationUrl, 'utf8') : ''
const userServiceEmptyStateSource = existsSync(userServiceEmptyStateUrl) ? readFileSync(userServiceEmptyStateUrl, 'utf8') : ''
const userServiceResultsPanelSource = existsSync(userServiceResultsPanelUrl) ? readFileSync(userServiceResultsPanelUrl, 'utf8') : ''
const userServiceRowSource = existsSync(userServiceRowUrl) ? readFileSync(userServiceRowUrl, 'utf8') : ''
const userServiceSummaryMetricsSource = existsSync(userServiceSummaryMetricsUrl) ? readFileSync(userServiceSummaryMetricsUrl, 'utf8') : ''
const userServiceTableHeaderSource = existsSync(userServiceTableHeaderUrl) ? readFileSync(userServiceTableHeaderUrl, 'utf8') : ''
const userServiceTableSource = existsSync(userServiceTableUrl) ? readFileSync(userServiceTableUrl, 'utf8') : ''
const userServiceSectionSource = existsSync(userServiceSectionUrl) ? readFileSync(userServiceSectionUrl, 'utf8') : ''
const userUsageCellSource = existsSync(userUsageCellUrl) ? readFileSync(userUsageCellUrl, 'utf8') : ''
const serviceApiLogFiltersSource = existsSync(serviceApiLogFiltersUrl) ? readFileSync(serviceApiLogFiltersUrl, 'utf8') : ''
const serviceApiLogRowSource = existsSync(serviceApiLogRowUrl) ? readFileSync(serviceApiLogRowUrl, 'utf8') : ''
const serviceApiLogsPanelSource = existsSync(serviceApiLogsPanelUrl) ? readFileSync(serviceApiLogsPanelUrl, 'utf8') : ''
const serviceRecordQueryPanelSource = existsSync(serviceRecordQueryPanelUrl) ? readFileSync(serviceRecordQueryPanelUrl, 'utf8') : ''
const serviceRecordSummarySource = existsSync(serviceRecordSummaryUrl) ? readFileSync(serviceRecordSummaryUrl, 'utf8') : ''
const serviceReconciliationHeaderSource = existsSync(serviceReconciliationHeaderUrl)
  ? readFileSync(serviceReconciliationHeaderUrl, 'utf8')
  : ''
const serviceReconciliationSummaryMetricsSource = existsSync(serviceReconciliationSummaryMetricsUrl)
  ? readFileSync(serviceReconciliationSummaryMetricsUrl, 'utf8')
  : ''
const serviceReconciliationSectionSource = existsSync(serviceReconciliationSectionUrl) ? readFileSync(serviceReconciliationSectionUrl, 'utf8') : ''
const adminSectionNavigationSource = existsSync(adminSectionNavigationUrl) ? readFileSync(adminSectionNavigationUrl, 'utf8') : ''
const adminUsersStateSource = existsSync(adminUsersStateUrl) ? readFileSync(adminUsersStateUrl, 'utf8') : ''
const adminUserActionsSource = existsSync(adminUserActionsUrl) ? readFileSync(adminUserActionsUrl, 'utf8') : ''
const adminServiceOpsSource = existsSync(adminServiceOpsUrl) ? readFileSync(adminServiceOpsUrl, 'utf8') : ''
const adminDashboardRefreshSource = existsSync(adminDashboardRefreshUrl) ? readFileSync(adminDashboardRefreshUrl, 'utf8') : ''
const adminDashboardSectionPropsSource = existsSync(adminDashboardSectionPropsUrl) ? readFileSync(adminDashboardSectionPropsUrl, 'utf8') : ''
const adminUsersDashboardSectionsSource = existsSync(adminUsersDashboardSectionsUrl)
  ? readFileSync(adminUsersDashboardSectionsUrl, 'utf8')
  : ''
const adminDashboardDataSource = existsSync(adminDashboardDataUrl) ? readFileSync(adminDashboardDataUrl, 'utf8') : ''
const adminAccessStateSource = existsSync(adminAccessStateUrl) ? readFileSync(adminAccessStateUrl, 'utf8') : ''
const adminDisplayStateSource = existsSync(adminDisplayStateUrl) ? readFileSync(adminDisplayStateUrl, 'utf8') : ''
const adminDisplaySource = existsSync(adminDisplayUrl) ? readFileSync(adminDisplayUrl, 'utf8') : ''
const usageAdminSidebarSource = existsSync(usageAdminSidebarUrl) ? readFileSync(usageAdminSidebarUrl, 'utf8') : ''
const adminUsersModuleSource = `${source}\n${adminDashboardSectionsSource}\n${adminAuditLogSectionSource}\n${adminAuditLogFiltersSource}\n${adminAuditLogPaginationSummarySource}\n${adminAuditLogRowSource}\n${adminOverviewInsightPanelSource}\n${adminOverviewMetricGridSource}\n${adminOverviewSectionSource}\n${adminOverviewSessionPanelSource}\n${adminOverviewTopSpendersListSource}\n${adminOverviewUsageTrendPanelSource}\n${adminInfoLineSource}\n${adminDashboardSectionFrameSource}\n${userAccountActionsSource}\n${userAccountActionsCellSource}\n${userOperationsCellSource}\n${userRoleActionsSource}\n${userStatusActionsSource}\n${userIdentityCellSource}\n${userIdentityMetaSource}\n${userReconciliationCellSource}\n${userServiceFiltersSource}\n${userServiceFilterSummarySource}\n${userServiceHeaderSource}\n${userServiceStatusCellSource}\n${userServiceActionsSource}\n${userServiceActionsCellSource}\n${userServicePaginationSource}\n${userServiceEmptyStateSource}\n${userServiceResultsPanelSource}\n${userServiceRowSource}\n${userServiceSummaryMetricsSource}\n${userServiceTableHeaderSource}\n${userServiceTableSource}\n${userServiceSectionSource}\n${userUsageCellSource}\n${serviceApiLogFiltersSource}\n${serviceApiLogRowSource}\n${serviceApiLogsPanelSource}\n${serviceRecordQueryPanelSource}\n${serviceRecordSummarySource}\n${serviceReconciliationHeaderSource}\n${serviceReconciliationSummaryMetricsSource}\n${serviceReconciliationSectionSource}`
const serviceReconciliationModuleSource = `${serviceReconciliationSectionSource}\n${serviceReconciliationHeaderSource}\n${serviceApiLogFiltersSource}\n${serviceApiLogRowSource}\n${serviceApiLogsPanelSource}\n${serviceRecordQueryPanelSource}\n${serviceRecordSummarySource}\n${serviceReconciliationSummaryMetricsSource}`
const usageAdminModuleSource = [
  usageAdminSource,
  existsSync(usageOverviewSectionUrl) ? readFileSync(usageOverviewSectionUrl, 'utf8') : '',
  existsSync(usageCredentialsSectionUrl) ? readFileSync(usageCredentialsSectionUrl, 'utf8') : '',
  existsSync(usageUsersSectionUrl) ? readFileSync(usageUsersSectionUrl, 'utf8') : ''
].join('\n')
const styleSource = readFileSync(styleUrl, 'utf8')

const readAdminFeatureSources = () => readdirSync(adminFeaturesDir, { withFileTypes: true })
  .filter((entry) => entry.isFile() && /\.(vue|js)$/.test(entry.name))
  .map((entry) => ({
    name: entry.name,
    source: readFileSync(new URL(entry.name, adminFeaturesDir), 'utf8')
  }))

test('admin page separates user service operations from billing reconciliation', () => {
  assert.match(adminUsersModuleSource, /用户服务/)
  assert.match(adminUsersModuleSource, /消耗对账/)
  assert.match(adminUsersModuleSource, /服务开通率/)
  assert.match(adminUsersModuleSource, /待处理服务/)

  const userServiceIndex = adminDashboardSectionsSource.indexOf('<AdminUserServiceSection')
  const billingIndex = adminDashboardSectionsSource.indexOf('<AdminServiceReconciliationSection')
  const auditIndex = adminDashboardSectionsSource.indexOf('<AdminAuditLogSection')

  assert.ok(userServiceIndex > -1)
  assert.ok(billingIndex > userServiceIndex)
  assert.ok(auditIndex > billingIndex)
})

test('admin user table keeps the service workflow focused', () => {
  assert.match(adminUsersModuleSource, /服务状态/)
  assert.match(adminUsersModuleSource, /官方消耗/)
  assert.match(adminUsersModuleSource, /待对账/)
  assert.doesNotMatch(adminUsersModuleSource, /用户与角色/)
})

test('admin user table treats 302 official billing as the only cost source', () => {
  assert.doesNotMatch(adminUsersModuleSource, /本地估算/)
  assert.doesNotMatch(adminUsersModuleSource, /estimatedUsage/)
  assert.doesNotMatch(adminUsersModuleSource, /差异/)
  assert.match(adminUsersModuleSource, /officialUsage\?\.totalCostAmount/)
})

test('admin dashboard refreshes users when refreshing 302 service data', () => {
  assert.match(source, /@refresh-overview="refreshDashboardOverview"/)
  assert.match(source, /@refresh-service-data="refreshServiceData"/)
  assert.match(source, /const refreshDashboardOverview = \(\) => Promise\.all\(\[refreshOverview\(\), loadUsers\(\)\]\)/)
  assert.match(source, /const refreshServiceData = \(\) => Promise\.all\(\[load302All\(\), loadUsers\(\)\]\)/)
})

test('admin dashboards use shared admin UI modules for repeated structure', () => {
  assert.match(source, /@\/components\/admin/)
  assert.match(usageAdminModuleSource, /@\/components\/admin/)
  assert.match(adminUsersModuleSource, /<AdminSectionHeader/)
  assert.match(usageAdminModuleSource, /<AdminSectionHeader/)
  assert.match(adminUsersModuleSource, /<AdminMetricCard/)
  assert.match(usageAdminModuleSource, /<UsageAdminMetricCard/)
  assert.match(adminUsersModuleSource, /<AdminEmptyState/)
  assert.match(usageAdminModuleSource, /<AdminEmptyState/)
  assert.ok(existsSync(adminSectionHeaderUrl))
  assert.match(adminSectionHeaderSource, /admin-section-actions/)
  assert.match(adminSectionHeaderSource, /<div v-if="\$slots\.actions" class="admin-section-actions">/)
  assert.match(adminSectionHeaderSource, /<slot name="actions" \/>/)
  assert.match(adminSectionHeaderSource, /@media \(max-width: 640px\)/)
})

test('shared admin UI modules use direct local imports instead of the admin barrel', () => {
  for (const sharedSource of [
    adminCompactMetricCardSource,
    adminGlassMetricCardSource,
    adminSidebarSource
  ]) {
    assert.doesNotMatch(sharedSource, /from ['"]@\/components\/admin['"]/)
  }

  assert.match(adminCompactMetricCardSource, /import AdminMetricCard from '\.\/AdminMetricCard\.vue'/)
  assert.match(adminGlassMetricCardSource, /import AdminMetricCard from '\.\/AdminMetricCard\.vue'/)
  assert.match(adminSidebarSource, /import AdminSidebarFrame from '\.\/AdminSidebarFrame\.vue'/)
})

test('admin feature modules import shared admin UI files explicitly', () => {
  const barrelUsers = readAdminFeatureSources()
    .filter(({ source }) => /from ['"]@\/components\/admin['"]/.test(source))
    .map(({ name }) => name)

  assert.deepEqual(barrelUsers, [])
})

test('admin data tables compose the shared table shell module', () => {
  assert.ok(existsSync(adminTableShellUrl))
  assert.match(adminTableShellSource, /<table/)
  assert.match(adminTableShellSource, /minWidthClass/)
  assert.match(adminTableShellSource, /headerRowClass/)
  assert.match(adminTableShellSource, /bodyRowClass/)

  for (const sectionSource of [
    adminAuditLogSectionSource,
    userServiceTableSource,
    serviceReconciliationModuleSource
  ]) {
    assert.match(sectionSource, /<AdminTableShell/)
  }

  assert.doesNotMatch(adminUsersModuleSource, /<div v-else class="overflow-x-auto">\s*<table class="w-full min-w/)
  assert.doesNotMatch(adminUsersModuleSource, /<tr v-for="[^"]+"[^>]+class="border-b border-white\/5 align-top hover:bg-white\/\[0\.03\]"/)
})

test('admin user operation editors use the shared editor card module', () => {
  assert.ok(existsSync(adminEditorCardUrl))
  assert.match(adminEditorCardSource, /admin-editor-card/)
  assert.match(adminEditorCardSource, /<slot \/>/)

  for (const actionSource of [userServiceActionsSource, userAccountActionsSource]) {
    assert.match(actionSource, /<AdminEditorCard(?:\s+class="admin-user-action-card [^"]+")?>/)
    assert.match(actionSource, /<\/AdminEditorCard>/)
    assert.doesNotMatch(actionSource, /action-editor-card/)
    assert.doesNotMatch(actionSource, /account-editor-card/)
    assert.doesNotMatch(actionSource, /\.action-editor-card/)
    assert.doesNotMatch(actionSource, /\.account-editor-card/)
  }
})

test('admin user operation editor controls use the shared editor style layer', () => {
  assert.ok(existsSync(adminControlFieldUrl))
  assert.ok(existsSync(adminEditorActionsUrl))
  assert.ok(existsSync(adminEditorBlockUrl))
  assert.ok(existsSync(adminEditorMainButtonUrl))
  assert.ok(existsSync(adminEditorSelectUrl))
  assert.ok(existsSync(adminMicroButtonUrl))

  assert.match(adminEditorActionsSource, /class="admin-editor-actions"/)
  assert.match(adminEditorActionsSource, /\.admin-editor-actions\s*\{/)
  assert.match(adminEditorBlockSource, /class="admin-editor-block"/)
  assert.match(adminEditorBlockSource, /\.admin-editor-block\s*\{/)
  assert.match(adminMicroButtonSource, /ui-micro-btn/)
  assert.match(adminMicroButtonSource, /\.ui-micro-btn\s*\{/)
  assert.match(adminMicroButtonSource, /\.ui-micro-btn:disabled\s*\{/)
  assert.match(adminMicroButtonSource, /\.ui-micro-btn-primary\s*\{/)
  assert.match(adminMicroButtonSource, /\.ui-micro-btn-danger\s*\{/)
  assert.match(adminEditorMainButtonSource, /import AdminMicroButton from '\.\/AdminMicroButton\.vue'/)
  assert.match(adminEditorMainButtonSource, /<AdminMicroButton/)
  assert.match(adminEditorMainButtonSource, /class="admin-editor-main"/)
  assert.doesNotMatch(adminEditorMainButtonSource, /class="ui-micro-btn/)
  assert.match(adminEditorMainButtonSource, /\.admin-editor-main\s*\{/)
  assert.match(adminControlFieldSource, /\.ui-text-input\s*\{/)
  assert.match(adminControlFieldSource, /\.ui-number-input\s*\{/)
  assert.match(adminEditorSelectSource, /import AdminControlField from '\.\/AdminControlField\.vue'/)
  assert.match(adminEditorSelectSource, /<AdminControlField/)
  assert.match(adminEditorSelectSource, /tag="select"/)
  assert.match(adminEditorSelectSource, /class="admin-editor-select"/)
  assert.doesNotMatch(adminEditorSelectSource, /class="ui-text-input/)
  assert.match(adminEditorSelectSource, /\.admin-editor-select\s*\{/)

  for (const actionSource of [userServiceActionsSource, userRoleActionsSource]) {
    assert.match(actionSource, /<AdminEditorBlock/)
    assert.doesNotMatch(actionSource, /class="admin-editor-block"/)
    assert.doesNotMatch(actionSource, /class="ui-micro-btn ui-micro-btn-primary admin-editor-main"/)
  }
  assert.match(userRoleActionsSource, /<AdminEditorMainButton/)
  assert.match(userServiceActivationActionSource, /<AdminEditorMainButton/)
  assert.doesNotMatch(userServiceActivationActionSource, /class="ui-micro-btn ui-micro-btn-primary admin-editor-main"/)

  assert.match(userStatusActionsSource, /<AdminEditorBlock/)
  assert.match(userStatusActionsSource, /<AdminEditorActions/)
  assert.match(userStatusActionsSource, /<AdminMicroButton/)
  assert.match(`${userServiceActionsSource}\n${userStatusActionsSource}`, /<AdminEditorActions/)
  assert.match(userRoleActionsSource, /<AdminEditorSelect/)
  assert.doesNotMatch(`${userServiceActionsSource}\n${userStatusActionsSource}`, /class="admin-editor-actions"/)
  assert.doesNotMatch(userRoleActionsSource, /class="ui-text-input admin-editor-select"/)

  for (const selector of ['admin-editor-block', 'admin-editor-select', 'admin-editor-main', 'admin-editor-actions']) {
    assert.doesNotMatch(styleSource, new RegExp(`\\.${selector}\\s*\\{`))
  }
  assert.doesNotMatch(styleSource, /\.ui-micro-btn/)
  assert.doesNotMatch(styleSource, /\.ui-text-input/)
  assert.doesNotMatch(styleSource, /\.ui-number-input/)

  assert.doesNotMatch(`${userServiceActionsSource}\n${userRoleActionsSource}\n${userStatusActionsSource}`, /action-editor-/)
  assert.doesNotMatch(`${userServiceActionsSource}\n${userRoleActionsSource}\n${userStatusActionsSource}`, /\.action-editor-/)
})

test('admin feature modules delegate form control styling to the shared module', () => {
  assert.ok(existsSync(adminControlFieldUrl))
  assert.ok(existsSync(adminFilterFieldUrl))
  assert.ok(existsSync(adminFilterToolbarUrl))

  assert.match(adminControlFieldSource, /<component/)
  assert.match(adminControlFieldSource, /controlClasses/)
  assert.match(adminControlFieldSource, /ui-text-input/)
  assert.match(adminControlFieldSource, /ui-number-input/)
  assert.match(adminFilterFieldSource, /admin-filter-field/)
  assert.match(adminFilterFieldSource, /admin-filter-label/)
  assert.match(adminFilterFieldSource, /<slot \/>/)
  assert.match(adminFilterToolbarSource, /admin-filter-toolbar/)
  assert.match(adminFilterToolbarSource, /<slot \/>/)

  for (const featureSource of [
    userServiceFiltersSource,
    serviceRecordQueryPanelSource,
    serviceApiLogFiltersSource,
    adminAuditLogFiltersSource,
    adminIssueInboxSectionSource
  ]) {
    assert.match(featureSource, /<AdminControlField/)
    assert.match(featureSource, /import AdminControlField from '@\/components\/admin\/AdminControlField\.vue'/)
  }

  for (const filterSource of [
    serviceRecordQueryPanelSource,
    serviceApiLogFiltersSource,
    adminAuditLogFiltersSource,
    adminIssueInboxSectionSource
  ]) {
    assert.match(filterSource, /<AdminFilterToolbar/)
    assert.match(filterSource, /import AdminFilterToolbar from '@\/components\/admin\/AdminFilterToolbar\.vue'/)
    assert.doesNotMatch(filterSource, /\.admin-filter-toolbar\s*\{/)
  }

  for (const filterSource of [
    serviceRecordQueryPanelSource,
    userServiceFiltersSource,
    serviceApiLogFiltersSource,
    adminAuditLogFiltersSource,
    adminIssueInboxSectionSource
  ]) {
    assert.match(filterSource, /<AdminFilterField/)
    assert.match(filterSource, /import AdminFilterField from '@\/components\/admin\/AdminFilterField\.vue'/)
  }

  assert.match(userServiceFiltersSource, /label="搜索用户"/)
  assert.match(userServiceFiltersSource, /label="状态筛选"/)
  assert.match(userServiceFiltersSource, /清除筛选/)
  assert.match(serviceRecordQueryPanelSource, /label="请求 ID"/)
  assert.match(serviceApiLogFiltersSource, /label="开始时间"/)
  assert.match(serviceApiLogFiltersSource, /label="结束时间"/)
  assert.match(adminAuditLogFiltersSource, /label="页码"/)
  assert.match(adminAuditLogFiltersSource, /label="每页"/)
  assert.match(adminIssueInboxSectionSource, /label="状态"/)
  assert.match(adminIssueInboxSectionSource, /label="级别"/)
  assert.match(adminIssueInboxSectionSource, /label="层级"/)
  assert.doesNotMatch(adminIssueInboxSectionSource, /admin-issue-select/)
  assert.doesNotMatch(adminIssueInboxSectionSource, /class="admin-issue-button"/)

  const directControlClassUsers = [
    ['AdminEditorSelect.vue', adminEditorSelectSource],
    ...readAdminFeatureSources().map(({ name, source }) => [`features/${name}`, source])
  ]
    .filter(([, source]) => /class="[^"]*(ui-text-input|ui-number-input)/.test(source))
    .map(([name]) => name)

  assert.deepEqual(directControlClassUsers, [])
})

test('admin issue inbox toolbar separates filters from batch actions', () => {
  assert.match(adminIssueInboxSectionSource, /class="[^"]*admin-issue-toolbar/)
  assert.match(adminIssueInboxSectionSource, /class="admin-issue-filter-group"/)
  assert.match(adminIssueInboxSectionSource, /class="admin-issue-action-group"/)
  assert.match(adminIssueInboxSectionSource, /class="admin-issue-batch-group"/)
  assert.match(adminIssueInboxSectionSource, /class="admin-issue-export-group"/)
  assert.match(adminIssueInboxSectionSource, /class="admin-issue-batch-summary"/)
  assert.match(adminIssueInboxSectionSource, /selectedExportGroupCount/)
  assert.match(adminIssueInboxSectionSource, /send-issue-digest-email/)
  assert.match(adminIssueInboxSectionSource, /发送当前筛选到邮箱/)
  assert.doesNotMatch(adminIssueInboxSectionSource, /导出后标记已解决/)
  assert.ok(adminIssueInboxSectionSource.indexOf('class="admin-issue-filter-group"') < adminIssueInboxSectionSource.indexOf('class="admin-issue-action-group"'))
  assert.doesNotMatch(adminIssueInboxSectionSource, /<AdminFilterToolbar align="end" compact>/)
  assert.match(adminIssueInboxSectionSource, /\.admin-issue-filter-group :deep\(\.admin-filter-field\)\s*\{[\s\S]*?flex:\s*1 1 180px/)
  assert.doesNotMatch(adminIssueInboxSectionSource, /\.admin-issue-filter-group :deep\(\.admin-filter-field\)\s*\{[\s\S]*?flex:\s*0 1 156px/)
  assert.match(adminIssueInboxSectionSource, /\.admin-issue-action-group\s*\{[\s\S]*?justify-content:\s*space-between/)
  assert.match(adminIssueInboxSectionSource, /\.admin-issue-export-group\s*\{[\s\S]*?justify-content:\s*flex-end/)
})

test('admin dashboard filter toolbars avoid oversized empty gutters', () => {
  assert.match(adminFilterToolbarSource, /fit:\s*\{\s*type: Boolean/)
  assert.match(adminFilterToolbarSource, /grid:\s*\{\s*type: Boolean/)
  assert.match(adminFilterToolbarSource, /admin-filter-toolbar-fit/)
  assert.match(adminFilterToolbarSource, /admin-filter-toolbar-grid/)
  assert.match(adminFilterToolbarSource, /grid-template-columns:\s*var\(--admin-filter-toolbar-columns/)
  assert.match(adminFilterToolbarSource, /width:\s*fit-content/)

  assert.match(serviceApiLogFiltersSource, /<AdminFilterToolbar class="admin-service-log-filters" compact grid>/)
  assert.match(serviceApiLogFiltersSource, /--admin-filter-toolbar-columns:\s*minmax\(240px, 1\.2fr\) minmax\(180px, 1fr\) minmax\(180px, 1fr\) 76px 76px auto/)
  assert.match(serviceApiLogFiltersSource, /@media \(max-width: 1180px\)/)

  assert.match(adminAuditLogFiltersSource, /<AdminFilterToolbar class="admin-audit-log-filters" compact fit grid>/)
  assert.match(adminAuditLogFiltersSource, /--admin-filter-toolbar-columns:\s*96px 96px auto/)
  assert.match(adminAuditLogFiltersSource, /@media \(max-width: 640px\)/)
})

test('admin shared buttons and sidebar navigation render icons consistently', () => {
  assert.match(adminMicroButtonSource, /icon:\s*\{/)
  assert.match(adminMicroButtonSource, /ui-micro-btn-icon/)
  assert.match(adminMicroButtonSource, /resolveButtonIcon/)
  assert.match(adminHeaderActionButtonSource, /:icon="HomeOutline"/)
  assert.match(adminSidebarSource, /resolveSidebarNavIcon/)
  assert.match(adminSidebarSource, /:icon="resolveSidebarNavIcon\(item\.key\)"/)
  assert.match(adminSidebarNavItemSource, /admin-sidebar-nav-icon/)
})

test('admin select controls reserve space for the right-side menu indicator', () => {
  assert.match(adminControlFieldSource, /ui-select-input/)
  assert.match(adminControlFieldSource, /appearance:\s*none/)
  assert.match(adminControlFieldSource, /padding-right:\s*36px/)
  assert.match(adminControlFieldSource, /background-position:\s*right 14px center/)
})

test('admin service page removes duplicated header shortcuts and inline audit list', () => {
  assert.match(source, /<AdminPageHeader/)
  assert.doesNotMatch(source, /:can-read-users="canReadUsers"/)
  assert.doesNotMatch(source, /:show-service-section="showServiceSection"/)
  assert.doesNotMatch(source, /@refresh="loadAll"/)
  assert.doesNotMatch(source, /@open-users="scrollToSection\('users'\)"/)
  assert.doesNotMatch(source, /@open-service="scrollToSection\('service'\)"/)
  assert.match(source, /@go-home="goHome"/)

  assert.equal((adminPageHeaderSource.match(/<AdminHeaderActionButton/g) || []).length, 1)
  assert.match(adminPageHeaderSource, /返回首页/)
  assert.doesNotMatch(adminPageHeaderSource, /刷新数据/)
  assert.doesNotMatch(adminPageHeaderSource, /用户服务/)
  assert.doesNotMatch(adminPageHeaderSource, /消耗对账/)
  assert.doesNotMatch(adminPageHeaderSource, /\$emit\('refresh'\)/)

  assert.match(adminDashboardSectionsSource, /:show="auditLogSection\.canReadAudit && activeRouteSection === 'audit'"/)
  assert.match(source, /:active-route-section="activeRouteSection"/)
  assert.match(source, /ADMIN_SECTION_BY_ROUTE_NAME/)
  assert.match(adminDisplaySource, /\{ key: 'audit', label: '审计日志', note: '追踪' \}/)
})

test('admin user service rows group billing and actions into compact hierarchy cards', () => {
  assert.match(userUsageCellSource, /class="admin-user-usage-card"/)
  assert.match(userUsageCellSource, /class="admin-user-usage-stat admin-user-usage-stat-primary"/)
  assert.match(userUsageCellSource, /调用次数/)
  assert.match(userUsageCellSource, /官方成本/)
  assert.match(userUsageCellSource, /高频模型/)
  assert.match(userUsageCellSource, /admin-user-usage-meta/)

  assert.match(userReconciliationCellSource, /class="admin-user-reconciliation-card"/)
  assert.match(userReconciliationCellSource, /对账状态/)
  assert.match(userReconciliationCellSource, /异常账单/)
  assert.match(userReconciliationCellSource, /最近活跃/)
  assert.match(userReconciliationCellSource, /admin-user-reconciliation-grid/)

  assert.match(userOperationsCellSource, /class="admin-user-operations-cell/)
  assert.match(userOperationsCellSource, /class="admin-user-operations-card"/)
  assert.match(userServiceActionsSource, /class="admin-user-action-card admin-user-action-card-service"/)
  assert.match(userAccountActionsSource, /class="admin-user-action-card admin-user-action-card-account"/)
  assert.match(userServiceActiveActionsSource, /class="admin-user-action-row"/)
  assert.match(userStatusActionsSource, /class="admin-user-action-row"/)
})

test('admin reconciliation controls keep request and log filters compact and prefilled', () => {
  assert.match(serviceRecordQueryPanelSource, /class="admin-record-query-toolbar"/)
  assert.match(serviceRecordQueryPanelSource, /--admin-filter-toolbar-columns:\s*minmax\(0, 1fr\) auto/)
  assert.doesNotMatch(serviceRecordQueryPanelSource, /<AdminFilterToolbar compact>/)

  assert.match(serviceApiLogFiltersSource, /--admin-filter-toolbar-columns:\s*minmax\(240px, 1\.2fr\) minmax\(180px, 1fr\) minmax\(180px, 1fr\) 76px 76px auto/)
  assert.match(serviceApiLogsPanelSource, /class="admin-service-log-results"/)
  assert.match(serviceApiLogsPanelSource, /\.admin-service-log-results\s*\{[\s\S]*?margin-top:\s*16px/)
  assert.match(adminServiceOpsSource, /createAdminServiceLogQuery/)
  assert.doesNotMatch(adminServiceOpsSource, /start: '', end: ''/)
})

test('admin issue inbox constrains long result and detail lists with shared pagination', () => {
  assert.ok(existsSync(adminPaginationBarUrl))
  assert.match(adminIssueInboxSectionSource, /import AdminPaginationBar from '@\/components\/admin\/AdminPaginationBar\.vue'/)
  assert.match(adminIssueInboxSectionSource, /min-width-class="min-w-\[980px\] table-fixed"/)
  assert.match(adminIssueInboxSectionSource, /class="admin-issue-title-column px-3 py-3"/)
  assert.match(adminIssueInboxSectionSource, /class="admin-issue-title-cell px-3 py-3"/)
  assert.match(adminIssueInboxSectionSource, /:title="issue\.title \|\| issue\.fingerprint"/)
  assert.match(adminIssueInboxSectionSource, /class="admin-issue-request-id/)
  assert.match(adminIssueInboxSectionSource, /\.admin-issue-title-column,\s*\.admin-issue-title-cell\s*\{[\s\S]*?width:\s*320px[\s\S]*?max-width:\s*320px/)
  assert.match(adminIssueInboxSectionSource, /\.admin-issue-title-button\s*\{[\s\S]*?overflow:\s*hidden[\s\S]*?text-overflow:\s*ellipsis[\s\S]*?white-space:\s*nowrap/)
  assert.match(adminIssueInboxSectionSource, /\.admin-issue-request-id\s*\{[\s\S]*?overflow:\s*hidden[\s\S]*?text-overflow:\s*ellipsis[\s\S]*?white-space:\s*nowrap/)
  assert.match(adminIssueInboxSectionSource, /const ISSUE_EVENT_PAGE_SIZE = 4/)
  assert.match(adminIssueInboxSectionSource, /const visibleIssueEvents = computed\(\(\) =>/)
  assert.match(adminIssueInboxSectionSource, /selectedIssueEvents\.value\.slice\(start, start \+ ISSUE_EVENT_PAGE_SIZE\)/)
  assert.match(adminIssueInboxSectionSource, /watch\(\(\) => props\.selectedIssue\?\.group\?\.id, \(\) => \{/)
  assert.match(adminIssueInboxSectionSource, /eventPage\.value = 1/)
  assert.match(adminIssueInboxSectionSource, /v-for="event in visibleIssueEvents"/)
  assert.match(adminIssueInboxSectionSource, /<AdminPaginationBar[\s\S]+:page="issueListPage"[\s\S]+:limit="issueListLimit"[\s\S]+:total="issueListTotal"[\s\S]+item-label="组"[\s\S]+@set-page="setIssueListPage"/)
  assert.match(adminIssueInboxSectionSource, /<AdminPaginationBar[\s\S]+:page="eventPage"[\s\S]+:limit="ISSUE_EVENT_PAGE_SIZE"[\s\S]+:total="selectedIssueEvents\.length"[\s\S]+item-label="条事件"[\s\S]+@set-page="setIssueEventPage"/)
  assert.match(adminIssueInboxSectionSource, /const setIssueListPage = \(page\) => \{/)
  assert.match(adminIssueInboxSectionSource, /emit\('update-issue-query', 'page', page\)/)
  assert.match(adminIssueInboxSectionSource, /emit\('load-issues'\)/)
  assert.doesNotMatch(adminIssueInboxSectionSource, /<span>第 \{\{ issuePagination\.page \|\| issueQuery\.page \}\} \/ \{\{ totalPages \}\} 页<\/span>/)
})

test('admin user service summary metrics use the shared compact metric card module', () => {
  assert.ok(existsSync(adminCompactMetricCardUrl))
  assert.ok(existsSync(userServiceSummaryMetricsUrl))
  assert.match(adminCompactMetricCardSource, /<AdminMetricCard/)
  assert.match(adminCompactMetricCardSource, /admin-compact-metric-card/)

  assert.match(userServiceSectionSource, /<AdminUserServiceSummaryMetrics/)
  assert.match(userServiceSectionSource, /:service-activation-rate="serviceActivationRate"/)
  assert.match(userServiceSectionSource, /:not-enabled-active-count="notEnabledActiveUsers\.length"/)
  assert.match(userServiceSectionSource, /:pending-billing-users="pendingBillingUsers"/)
  assert.match(userServiceSectionSource, /:filtered-user-count="filteredUsers\.length"/)
  assert.doesNotMatch(userServiceSectionSource, /<AdminCompactMetricCard/)

  assert.equal((userServiceSummaryMetricsSource.match(/<AdminCompactMetricCard/g) || []).length, 4)
  assert.match(userServiceSummaryMetricsSource, /服务开通率/)
  assert.match(userServiceSummaryMetricsSource, /待处理服务/)
  assert.match(userServiceSummaryMetricsSource, /待对账用户/)
  assert.match(userServiceSummaryMetricsSource, /当前显示/)
  assert.doesNotMatch(userServiceSummaryMetricsSource, /service-metric/)
  assert.doesNotMatch(userServiceSummaryMetricsSource, /card-class="service-metric"/)
  assert.doesNotMatch(userServiceSummaryMetricsSource, /label-class="text-\[11px\] uppercase tracking-\[0\.12em\] text-white\/40"/)
  assert.doesNotMatch(userServiceSummaryMetricsSource, /value-tag="strong"/)
  assert.doesNotMatch(userServiceSummaryMetricsSource, /value-class="mt-2 block text-2xl font-semibold text-white\/95"/)
})

test('admin user service header uses a focused feature module', () => {
  assert.ok(existsSync(userServiceHeaderUrl))
  assert.match(userServiceSectionSource, /import AdminUserServiceHeader from '\.\/AdminUserServiceHeader\.vue'/)
  assert.match(userServiceSectionSource, /<AdminUserServiceHeader\s+:loading-users="loadingUsers"\s+@refresh-users="emit\('refresh-users'\)"\s+\/>/)
  assert.doesNotMatch(userServiceSectionSource, /<AdminSectionHeader/)
  assert.doesNotMatch(userServiceSectionSource, /<AdminMicroButton/)

  assert.match(userServiceHeaderSource, /<AdminSectionHeader/)
  assert.match(userServiceHeaderSource, /title="用户服务"/)
  assert.match(userServiceHeaderSource, /caption="围绕用户服务状态、开通操作、官方消耗和待处理事项组织。"/)
  assert.match(userServiceHeaderSource, /<AdminMicroButton size="md" :disabled="loadingUsers" @click="emit\('refresh-users'\)">/)
  assert.match(userServiceHeaderSource, /loadingUsers \? '刷新中\.\.\.' : '刷新用户列表'/)
  assert.match(userServiceHeaderSource, /defineEmits\(\['refresh-users'\]\)/)
  assert.match(userServiceHeaderSource, /loadingUsers:\s*\{\s*type: Boolean,\s*default: false\s*\}/s)
})

test('admin user service filters use a focused feature module', () => {
  assert.ok(existsSync(userServiceFiltersUrl))
  assert.ok(existsSync(userServiceFilterSummaryUrl))
  assert.match(userServiceSectionSource, /<AdminUserServiceFilters/)
  assert.match(userServiceSectionSource, /:search-query="searchQuery"/)
  assert.match(userServiceSectionSource, /:status-filter="statusFilter"/)
  assert.match(userServiceSectionSource, /:filtered-user-count="filteredUsers\.length"/)
  assert.match(userServiceSectionSource, /@update:search-query="emit\('update:searchQuery', \$event\)"/)
  assert.match(userServiceSectionSource, /@update:status-filter="emit\('update:statusFilter', \$event\)"/)
  assert.doesNotMatch(userServiceSectionSource, /const updateSearchQuery =/)
  assert.doesNotMatch(userServiceSectionSource, /const updateStatusFilter =/)

  assert.match(userServiceFiltersSource, /搜索用户/)
  assert.match(userServiceFiltersSource, /状态筛选/)
  assert.match(userServiceFiltersSource, /按用户 ID、邮箱或昵称搜索/)
  assert.match(userServiceFiltersSource, /import AdminUserServiceFilterSummary from '\.\/AdminUserServiceFilterSummary\.vue'/)
  assert.match(userServiceFiltersSource, /<AdminUserServiceFilterSummary\s+:filtered-user-count="filteredUserCount"\s+:user-page-end="userPageEnd"\s+:user-page-start="userPageStart"\s*\/>/)
  assert.match(userServiceFiltersSource, /String\(event\.target\.value \|\| ''\)\.trim\(\)/)
  assert.match(userServiceFiltersSource, /emit\('update:searchQuery'/)
  assert.match(userServiceFiltersSource, /emit\('update:statusFilter'/)
  assert.doesNotMatch(userServiceFiltersSource, /显示第 \{\{ userPageStart \}\}-\{\{ userPageEnd \}\} 条，共 \{\{ filteredUserCount \}\} 位用户/)

  assert.match(userServiceFilterSummarySource, /<p class="text-xs text-white\/55">/)
  assert.match(userServiceFilterSummarySource, /显示第 \{\{ userPageStart \}\}-\{\{ userPageEnd \}\} 条，共 \{\{ filteredUserCount \}\} 位用户/)
  assert.match(userServiceFilterSummarySource, /filteredUserCount:\s*\{\s*type: Number,\s*default: 0\s*\}/s)
  assert.match(userServiceFilterSummarySource, /userPageEnd:\s*\{\s*type: Number,\s*default: 0\s*\}/s)
  assert.match(userServiceFilterSummarySource, /userPageStart:\s*\{\s*type: Number,\s*default: 0\s*\}/s)
})

test('admin user service table uses a focused feature module', () => {
  assert.ok(existsSync(userServiceTableUrl))
  assert.ok(existsSync(userServiceTableHeaderUrl))
  assert.match(userServiceResultsPanelSource, /<AdminUserServiceTable/)
  assert.match(userServiceResultsPanelSource, /:paged-users="pagedUsers"/)
  assert.match(userServiceResultsPanelSource, /:show-user-actions="showUserActions"/)
  assert.match(userServiceResultsPanelSource, /@activate-service="emit\('activate-service', \$event\)"/)
  assert.match(userServiceResultsPanelSource, /@update-role-selection="forwardRoleSelection"/)
  assert.doesNotMatch(userServiceSectionSource, /<AdminTableShell/)
  assert.doesNotMatch(userServiceSectionSource, /<AdminEditorCard>/)
  assert.doesNotMatch(userServiceSectionSource, /const updateRoleSelection =/)

  assert.match(userServiceTableSource, /<AdminTableShell/)
  assert.match(userServiceTableSource, /import AdminUserServiceTableHeader from '\.\/AdminUserServiceTableHeader\.vue'/)
  assert.match(userServiceTableSource, /<AdminUserServiceTableHeader\s+:can-manage-roles="canManageRoles"\s+:can-manage-user-status="canManageUserStatus"\s+:show-user-actions="showUserActions"\s+\/>/)
  assert.doesNotMatch(userServiceTableSource, /<th class="px-3 py-4">用户<\/th>/)
  assert.doesNotMatch(userServiceTableSource, /<th v-if="showUserActions" class="px-3 py-4">服务操作<\/th>/)

  assert.match(userServiceTableHeaderSource, /<th class="px-3 py-4">用户<\/th>/)
  assert.doesNotMatch(userServiceTableHeaderSource, /<th class="px-3 py-4">服务状态<\/th>/)
  assert.match(userServiceTableHeaderSource, /<th class="px-3 py-4">官方消耗<\/th>/)
  assert.match(userServiceTableHeaderSource, /<th class="px-3 py-4">对账<\/th>/)
  assert.match(userServiceTableHeaderSource, /<th v-if="showUserActions \|\| canManageRoles \|\| canManageUserStatus" class="px-3 py-4">操作与权限<\/th>/)
  assert.doesNotMatch(userServiceTableHeaderSource, /服务操作/)
  assert.doesNotMatch(userServiceTableHeaderSource, /账号与角色/)
  assert.match(userServiceTableHeaderSource, /showUserActions:\s*\{\s*type: Boolean,\s*default: false\s*\}/s)
})

test('admin user service table delegates rows to a focused row module', () => {
  assert.ok(existsSync(userServiceRowUrl))
  assert.match(userServiceTableSource, /<AdminUserServiceRow/)
  assert.match(userServiceTableSource, /v-for="item in pagedUsers"/)
  assert.match(userServiceTableSource, /:row-class="rowClass"/)
  assert.match(userServiceTableSource, /:user="item"/)
  assert.match(userServiceTableSource, /@activate-service="emit\('activate-service', \$event\)"/)
  assert.match(userServiceTableSource, /@update-role-selection="forwardRoleSelection"/)
  assert.doesNotMatch(userServiceTableSource, /<AdminUserIdentityCell/)
  assert.doesNotMatch(userServiceTableSource, /<AdminUserServiceActions/)
  assert.doesNotMatch(userServiceTableSource, /<AdminUserAccountActions/)

  assert.match(userServiceRowSource, /<tr/)
  assert.match(userServiceRowSource, /<AdminUserIdentityCell/)
  assert.match(userServiceRowSource, /<AdminUserOperationsCell/)
  assert.match(userServiceRowSource, /@update-role-selection="forwardRoleSelection"/)
})

test('admin user service results use a focused feature module', () => {
  assert.ok(existsSync(userServiceResultsPanelUrl))
  assert.ok(existsSync(userServiceEmptyStateUrl))
  assert.match(userServiceSectionSource, /<AdminUserServiceResultsPanel/)
  assert.match(userServiceSectionSource, /:filtered-users="filteredUsers"/)
  assert.match(userServiceSectionSource, /:users="users"/)
  assert.match(userServiceSectionSource, /:paged-users="pagedUsers"/)
  assert.match(userServiceSectionSource, /:total-user-pages="totalUserPages"/)
  assert.match(userServiceSectionSource, /@set-user-page="emit\('set-user-page', \$event\)"/)
  assert.match(userServiceSectionSource, /@update-role-selection="forwardRoleSelection"/)
  assert.doesNotMatch(userServiceSectionSource, /<AdminEmptyState/)
  assert.doesNotMatch(userServiceSectionSource, /<AdminUserServiceTable/)
  assert.doesNotMatch(userServiceSectionSource, /<AdminUserServicePagination/)

  assert.match(userServiceResultsPanelSource, /import AdminUserServiceEmptyState from '\.\/AdminUserServiceEmptyState\.vue'/)
  assert.match(userServiceResultsPanelSource, /<AdminUserServiceEmptyState\s+v-if="filteredUsers\.length === 0"\s+:users="users"\s+\/>/)
  assert.doesNotMatch(userServiceResultsPanelSource, /<AdminEmptyState/)
  assert.doesNotMatch(userServiceResultsPanelSource, /暂无用户数据/)
  assert.doesNotMatch(userServiceResultsPanelSource, /没有匹配的用户/)
  assert.match(userServiceResultsPanelSource, /<AdminUserServiceTable/)
  assert.match(userServiceResultsPanelSource, /<AdminUserServicePagination/)
  assert.match(userServiceResultsPanelSource, /forwardRoleSelection/)

  assert.match(userServiceEmptyStateSource, /<AdminEmptyState>/)
  assert.match(userServiceEmptyStateSource, /users\.length === 0 \? '暂无用户数据' : '没有匹配的用户'/)
  assert.match(userServiceEmptyStateSource, /users:\s*\{\s*type: Array,\s*default: \(\) => \[\]\s*\}/s)
})

test('admin user service row operations use focused feature modules', () => {
  assert.ok(existsSync(userServiceActionsUrl))
  assert.ok(existsSync(userServiceActivationActionUrl))
  assert.ok(existsSync(userServiceActiveActionsUrl))
  assert.ok(existsSync(userServiceActionsCellUrl))
  assert.ok(existsSync(userOperationsCellUrl))
  assert.ok(existsSync(userAccountActionsUrl))
  assert.ok(existsSync(userAccountActionsCellUrl))
  assert.ok(existsSync(userRoleActionsUrl))
  assert.ok(existsSync(userStatusActionsUrl))
  assert.match(userServiceRowSource, /<AdminUserOperationsCell/)
  assert.match(userServiceRowSource, /:user="user"/)
  assert.match(userServiceRowSource, /@activate-service="emit\('activate-service', \$event\)"/)
  assert.match(userServiceRowSource, /@update-service-limits="emit\('update-service-limits', \$event\)"/)
  assert.match(userServiceRowSource, /@update-role-selection="forwardRoleSelection"/)
  assert.doesNotMatch(userServiceRowSource, /<AdminEditorCard>/)
  assert.doesNotMatch(userServiceRowSource, /<td v-if="showUserActions" class="px-3 py-4">/)
  assert.doesNotMatch(userServiceRowSource, /<td v-if="canManageRoles \|\| canManageUserStatus" class="px-3 py-4">/)
  assert.doesNotMatch(userServiceRowSource, /<AdminUserServiceActions\s/)
  assert.doesNotMatch(userServiceRowSource, /<AdminUserAccountActions\s/)
  assert.doesNotMatch(userServiceTableSource, /const updateRoleSelection =/)

  assert.match(userServiceActionsCellSource, /<td v-if="showUserActions" class="admin-user-action-cell px-3 py-4">/)
  assert.match(userServiceActionsCellSource, /<AdminUserServiceActions/)
  assert.match(userServiceActionsCellSource, /@activate-service="emit\('activate-service', \$event\)"/)
  assert.match(userServiceActionsCellSource, /@update-service-limits="emit\('update-service-limits', \$event\)"/)

  assert.match(userAccountActionsCellSource, /<td v-if="canManageRoles \|\| canManageUserStatus" class="admin-user-action-cell px-3 py-4">/)
  assert.match(userAccountActionsCellSource, /<AdminUserAccountActions/)
  assert.match(userAccountActionsCellSource, /@update-role-selection="forwardRoleSelection"/)

  assert.match(userOperationsCellSource, /<AdminEditorCard class="admin-user-operations-card">/)
  assert.match(userOperationsCellSource, /<AdminUserServiceActivationAction/)
  assert.match(userOperationsCellSource, /<AdminUserServiceActiveActions/)
  assert.match(userOperationsCellSource, /<AdminUserRoleActions/)
  assert.match(userOperationsCellSource, /<AdminUserStatusActions/)
  assert.match(userOperationsCellSource, /@bind-manual-service="emit\('bind-manual-service', \$event\)"/)
  assert.match(userOperationsCellSource, /@update-service-limits="emit\('update-service-limits', \$event\)"/)
  assert.match(userOperationsCellSource, /@update-role-selection="forwardRoleSelection"/)

  assert.match(userServiceActionsSource, /<AdminEditorCard class="admin-user-action-card admin-user-action-card-service">/)
  assert.match(userServiceActionsSource, /import AdminUserServiceActivationAction from '\.\/AdminUserServiceActivationAction\.vue'/)
  assert.match(userServiceActionsSource, /import AdminUserServiceActiveActions from '\.\/AdminUserServiceActiveActions\.vue'/)
  assert.match(userServiceActionsSource, /<AdminUserServiceActivationAction\s+:can-activate-service="canActivateService"/)
  assert.match(userServiceActionsSource, /@activate-service="emit\('activate-service', \$event\)"/)
  assert.match(userServiceActionsSource, /<AdminUserServiceActiveActions\s+:can-disable-service="canDisableService"/)
  assert.match(userServiceActionsSource, /@update-service-limits="emit\('update-service-limits', \$event\)"/)
  assert.doesNotMatch(userServiceActionsSource, /<AdminEditorMainButton/)
  assert.doesNotMatch(userServiceActionsSource, /<AdminMicroButton/)
  assert.doesNotMatch(userServiceActionsSource, /开通服务/)
  assert.doesNotMatch(userServiceActionsSource, /停用服务/)
  assert.doesNotMatch(userServiceActionsSource, /重置凭证/)
  assert.doesNotMatch(userServiceActionsSource, /调整额度/)

  assert.match(userServiceActivationActionSource, /import AdminEditorMainButton from '@\/components\/admin\/AdminEditorMainButton\.vue'/)
  assert.match(userServiceActivationActionSource, /\['not_enabled', 'create_failed', 'deleted'\]\.includes\(user\.service\?\.serviceStatus \|\| 'not_enabled'\)/)
  assert.match(userServiceActivationActionSource, /:disabled="serviceLoading\[user\.id\] \|\| user\.status === 'deleted'"/)
  assert.match(userServiceActivationActionSource, /emit\('activate-service', user\)/)
  assert.match(userServiceActivationActionSource, /emit\('bind-manual-service', user\)/)
  assert.match(userServiceActivationActionSource, /开通中\.\.\./)
  assert.match(userServiceActivationActionSource, /开通服务/)
  assert.match(userServiceActivationActionSource, /手动绑定 Key/)
  assert.match(userServiceActivationActionSource, /manualBindLabel/)
  assert.match(userServiceActivationActionSource, /user\.service\?\.apiKeyLast4/)
  assert.match(userServiceActivationActionSource, /切换 Key/)

  assert.match(userServiceActiveActionsSource, /import AdminEditorActions from '@\/components\/admin\/AdminEditorActions\.vue'/)
  assert.match(userServiceActiveActionsSource, /import AdminMicroButton from '@\/components\/admin\/AdminMicroButton\.vue'/)
  assert.match(userServiceActiveActionsSource, /user\.service\?\.serviceStatus === 'active'/)
  assert.match(userServiceActiveActionsSource, /停用服务/)
  assert.match(userServiceActiveActionsSource, /重置凭证/)
  assert.match(userServiceActiveActionsSource, /调整额度/)
  assert.match(userServiceActiveActionsSource, /emit\('disable-service', user\)/)
  assert.match(userServiceActiveActionsSource, /emit\('update-service-limits', user\)/)

  assert.match(userAccountActionsSource, /<AdminEditorCard class="admin-user-action-card admin-user-action-card-account">/)
  assert.match(userAccountActionsSource, /<AdminUserRoleActions/)
  assert.match(userAccountActionsSource, /<AdminUserStatusActions/)
  assert.match(userAccountActionsSource, /@update-role-selection="forwardRoleSelection"/)
  assert.doesNotMatch(userAccountActionsSource, /<AdminEditorBlock/)
  assert.doesNotMatch(userAccountActionsSource, /@change="updateRoleSelection"/)

  assert.match(userRoleActionsSource, /保存角色/)
  assert.match(userRoleActionsSource, /@change="updateRoleSelection"/)
  assert.match(userRoleActionsSource, /emit\('update-role-selection', user\.id, event\.target\.value\)/)
  assert.match(userStatusActionsSource, /禁止操作自己/)
  assert.match(userStatusActionsSource, /emit\('delete-user', user\)/)
})

test('admin manual service binding event reaches page action composable', () => {
  assert.ok(existsSync(userManualServiceKeyModalUrl))
  assert.match(source, /<AdminManualServiceKeyModal/)
  assert.match(source, /v-model:show="manualServiceDialogVisible"/)
  assert.match(source, /:user="manualServiceUser"/)
  assert.match(source, /@submit="submitManualServiceBinding"/)
  assert.match(source, /@bind-manual-service="openManualServiceDialog"/)
  assert.match(source, /openManualServiceDialog/)
  assert.match(source, /submitManualServiceBinding/)
  assert.match(adminDashboardSectionsSource, /@bind-manual-service="emit\('bind-manual-service', \$event\)"/)
  assert.match(userServiceSectionSource, /@bind-manual-service="emit\('bind-manual-service', \$event\)"/)
  assert.match(userServiceResultsPanelSource, /@bind-manual-service="emit\('bind-manual-service', \$event\)"/)
  assert.match(userServiceTableSource, /@bind-manual-service="emit\('bind-manual-service', \$event\)"/)
  assert.match(userServiceRowSource, /@bind-manual-service="emit\('bind-manual-service', \$event\)"/)
  assert.match(userOperationsCellSource, /@bind-manual-service="emit\('bind-manual-service', \$event\)"/)
  assert.match(userServiceActionsSource, /@bind-manual-service="emit\('bind-manual-service', \$event\)"/)
  assert.match(userServiceActionsCellSource, /@bind-manual-service="emit\('bind-manual-service', \$event\)"/)
  assert.match(userServiceActivationActionSource, /defineEmits\(\['activate-service', 'bind-manual-service'\]\)/)
  assert.match(userManualServiceKeyModalSource, /完整服务商 API Key/)
  assert.match(userManualServiceKeyModalSource, /type="password"/)
  assert.match(userManualServiceKeyModalSource, /绑定服务 Key/)
  assert.match(userManualServiceKeyModalSource, /请输入完整服务商 API Key/)
  assert.match(userManualServiceKeyModalSource, /用户运行时模型调用 Key/)
  assert.match(userManualServiceKeyModalSource, /不要填写系统管理 Key/)
  assert.match(userManualServiceKeyModalSource, /不能使用系统管理 Key/)
  assert.doesNotMatch(userManualServiceKeyModalSource, /window\.prompt|prompt\(/)
  assert.doesNotMatch(userManualServiceKeyModalSource, /302\.ai|302 API Key|302 Key/)
})

test('admin user service row combines service and account operations into one compact cell', () => {
  assert.ok(existsSync(userOperationsCellUrl))

  assert.match(userServiceTableHeaderSource, /<th v-if="showUserActions \|\| canManageRoles \|\| canManageUserStatus" class="px-3 py-4">操作与权限<\/th>/)
  assert.doesNotMatch(userServiceTableHeaderSource, /服务状态/)
  assert.doesNotMatch(userServiceTableHeaderSource, /服务操作/)
  assert.doesNotMatch(userServiceTableHeaderSource, /账号与角色/)

  assert.match(userServiceRowSource, /<AdminUserOperationsCell/)
  assert.doesNotMatch(userServiceRowSource, /<AdminUserServiceStatusCell/)
  assert.doesNotMatch(userServiceRowSource, /<AdminUserServiceActionsCell/)
  assert.doesNotMatch(userServiceRowSource, /<AdminUserAccountActionsCell/)

  assert.match(userOperationsCellSource, /<td v-if="showUserActions \|\| canManageRoles \|\| canManageUserStatus" class="admin-user-operations-cell px-3 py-4">/)
  assert.match(userOperationsCellSource, /class="admin-user-operations-card"/)
  assert.match(userOperationsCellSource, /<AdminUserServiceActivationAction/)
  assert.match(userOperationsCellSource, /<AdminUserServiceActiveActions/)
  assert.match(userOperationsCellSource, /<AdminUserRoleActions/)
  assert.match(userOperationsCellSource, /<AdminUserStatusActions/)
  assert.match(userOperationsCellSource, /@update-role-selection="forwardRoleSelection"/)
  assert.match(userOperationsCellSource, /admin-user-operations-card\s*\{/)
  assert.match(userOperationsCellSource, /admin-user-operations-service/)
  assert.match(userOperationsCellSource, /admin-user-operations-account/)
  assert.match(userOperationsCellSource, /\.admin-user-operations-action-slot\s*\{[\s\S]+display:\s*grid[\s\S]+gap:\s*8px/)
})

test('admin user service rows keep api identity compact and role controls inline', () => {
  assert.match(userServiceRowSource, /<AdminUserIdentityCell/)
  assert.doesNotMatch(userServiceRowSource, /<AdminUserIdentityCell[\s\S]+:service-status-class="serviceStatusClass"[\s\S]+:service-status-label="serviceStatusLabel"/)
  assert.doesNotMatch(userServiceRowSource, /import AdminUserServiceStatusCell/)

  assert.doesNotMatch(userIdentityCellSource, /import AdminStatusPill from '@\/components\/admin\/AdminStatusPill\.vue'/)
  assert.doesNotMatch(userIdentityCellSource, /serviceStatusClass\(user\.service\?\.serviceStatus\)/)
  assert.match(userIdentityCellSource, /class="admin-user-api-line"/)
  assert.match(userIdentityCellSource, /<span class="admin-user-api-prefix">API:<\/span>/)
  assert.match(userIdentityCellSource, /user\.service\?\.serviceIdentifier \|\| '尚未开通'/)
  assert.match(userIdentityCellSource, /class="admin-user-service-state"/)
  assert.match(userIdentityCellSource, /serviceStatusLabel\(user\.service\?\.serviceStatus\)/)
  assert.match(userIdentityCellSource, /Key 尾号/)
  assert.match(userIdentityCellSource, /user\.service\?\.apiKeyLast4/)
  assert.doesNotMatch(userIdentityCellSource, /user\.service\?\.lastError/)
  assert.doesNotMatch(userIdentityCellSource, /admin-user-service-error/)
  assert.doesNotMatch(userServiceStatusCellSource, /user\.service\?\.lastError/)
  assert.doesNotMatch(userServiceStatusCellSource, /lastError/)

  assert.match(userRoleActionsSource, /class="admin-user-role-row"/)
  assert.match(userRoleActionsSource, /<AdminEditorSelect[\s\S]+<AdminEditorMainButton/s)
  assert.match(userRoleActionsSource, /grid-template-columns:\s*minmax\(0, 1fr\) auto/)
  assert.match(userRoleActionsSource, /\.admin-user-role-row :deep\(\.admin-editor-select\)/)
})

test('admin user service display cards align heights and place api below id', () => {
  assert.match(userIdentityCellSource, /class="admin-user-name"/)
  assert.match(userIdentityCellSource, /class="admin-user-email"/)
  assert.match(userIdentityCellSource, /class="admin-user-id-line"/)
  assert.match(userIdentityCellSource, /class="admin-user-id-value">ID: \{\{ user\.id \}\}<\/span>/)
  assert.match(userIdentityCellSource, /class="admin-user-api-line"/)
  assert.match(userIdentityCellSource, /class="admin-user-api-prefix">API:<\/span>/)
  assert.match(userIdentityCellSource, /class="admin-user-service-id"/)
  assert.match(userIdentityCellSource, /class="admin-user-service-state"/)
  assert.match(userIdentityCellSource, /class="admin-user-key-last4"/)
  assert.match(userIdentityCellSource, /admin-user-meta-group\s*\{[\s\S]+margin-top:\s*auto/)
  assert.match(userIdentityCellSource, /min-height:\s*138px/)
  assert.doesNotMatch(userIdentityCellSource, /<p class="mt-1 text-\[11px\] text-white\/35">ID:/)
  assert.doesNotMatch(userIdentityCellSource, /<AdminStatusPill/)

  assert.match(userUsageCellSource, /class="admin-user-usage-cell px-3 py-4/)
  assert.match(userUsageCellSource, /min-height:\s*138px/)
  assert.match(userUsageCellSource, /height:\s*100%/)
  assert.match(userReconciliationCellSource, /class="admin-user-reconciliation-cell px-3 py-4/)
  assert.match(userReconciliationCellSource, /min-height:\s*138px/)
  assert.match(userReconciliationCellSource, /height:\s*100%/)
})

test('admin user operation service and account buttons evenly fill available width', () => {
  assert.match(userOperationsCellSource, /admin-user-operations-action-slot :deep\(\.admin-user-action-row\)\s*\{[\s\S]+grid-template-columns:\s*repeat\(auto-fit, minmax\(0, 1fr\)\)/)
  assert.match(userOperationsCellSource, /admin-user-operations-card :deep\(\.admin-user-action-row \.ui-micro-btn\)\s*\{[\s\S]+width:\s*100%/)
  assert.match(userOperationsCellSource, /admin-user-operations-card :deep\(\.admin-user-action-row \.ui-micro-btn\)\s*\{[\s\S]+justify-content:\s*center/)
  assert.match(userOperationsCellSource, /admin-user-operations-action-slot :deep\(\.admin-editor-main\)\s*\{[\s\S]+width:\s*100%/)
  assert.match(userStatusActionsSource, /admin-user-status-row :deep\(\.admin-user-action-row\)\s*\{[\s\S]+display:\s*grid/)
  assert.match(userStatusActionsSource, /admin-user-status-row :deep\(\.admin-user-action-row\)\s*\{[\s\S]+grid-template-columns:\s*repeat\(auto-fit, minmax\(0, 1fr\)\)/)
  assert.match(userStatusActionsSource, /admin-user-status-row :deep\(\.ui-micro-btn\)\s*\{[\s\S]+width:\s*100%/)
  assert.match(userStatusActionsSource, /admin-user-status-row :deep\(\.ui-micro-btn\)\s*\{[\s\S]+justify-content:\s*center/)
})

test('admin user service display cells use focused feature modules', () => {
  for (const url of [
    adminStatusPillUrl,
    adminTagPillUrl,
    userIdentityCellUrl,
    userIdentityMetaUrl,
    userUsageCellUrl,
    userReconciliationCellUrl
  ]) {
    assert.ok(existsSync(url))
  }

  assert.match(userServiceRowSource, /<AdminUserIdentityCell/)
  assert.doesNotMatch(userServiceRowSource, /<AdminUserServiceStatusCell/)
  assert.match(userServiceRowSource, /<AdminUserUsageCell/)
  assert.match(userServiceRowSource, /<AdminUserReconciliationCell/)
  assert.match(userServiceRowSource, /:user="user"/)
  assert.match(userServiceRowSource, /:role-label="roleLabel"/)
  assert.match(userServiceRowSource, /:service-status-label="serviceStatusLabel"/)
  assert.doesNotMatch(userServiceRowSource, /:service-status-class="serviceStatusClass"/)
  assert.match(userServiceRowSource, /:format-usd="formatUsd"/)
  assert.match(userServiceRowSource, /:format-date-time="formatDateTime"/)
  assert.doesNotMatch(userServiceTableSource, /item\.displayName/)
  assert.doesNotMatch(userServiceTableSource, /item\.service\?\.serviceIdentifier/)
  assert.doesNotMatch(userServiceTableSource, /item\.officialUsage\?\.totalCalls/)
  assert.doesNotMatch(userServiceTableSource, /item\.reconciliation\?\.pendingCount/)
  assert.doesNotMatch(userServiceTableSource, /最近活跃/)

  assert.match(adminStatusPillSource, /class="ui-status-pill"/)
  assert.match(adminStatusPillSource, /\.ui-status-pill\s*\{/)
  assert.match(adminStatusPillSource, /\.ui-status-pill-active\s*\{/)
  assert.match(adminStatusPillSource, /\.ui-status-pill-suspended\s*\{/)
  assert.match(adminStatusPillSource, /\.ui-status-pill-deleted\s*\{/)
  assert.match(adminTagPillSource, /class="ui-tag-pill"/)
  assert.match(adminTagPillSource, /\.ui-tag-pill\s*\{/)
  assert.doesNotMatch(styleSource, /\.ui-tag-pill\s*\{/)
  assert.doesNotMatch(styleSource, /\.ui-status-pill\s*\{/)
  assert.doesNotMatch(styleSource, /\.ui-status-pill-active\s*\{/)
  assert.doesNotMatch(styleSource, /\.ui-status-pill-suspended\s*\{/)
  assert.doesNotMatch(styleSource, /\.ui-status-pill-deleted\s*\{/)

  assert.match(userIdentityCellSource, /user\.displayName/)
  assert.doesNotMatch(userIdentityCellSource, /import AdminStatusPill from '@\/components\/admin\/AdminStatusPill\.vue'/)
  assert.match(userIdentityCellSource, /import AdminUserIdentityMeta from '\.\/AdminUserIdentityMeta\.vue'/)
  assert.doesNotMatch(userIdentityCellSource, /serviceStatusClass\(user\.service\?\.serviceStatus\)/)
  assert.match(userIdentityCellSource, /<AdminUserIdentityMeta\s+:role-label="roleLabel"\s+:status-class="statusClass"\s+:status-label="statusLabel"\s+:user="user"\s+\/>/)
  assert.doesNotMatch(userIdentityCellSource, /<AdminTagPill/)
  assert.doesNotMatch(userIdentityCellSource, /suspendedReason/)
  assert.doesNotMatch(userIdentityCellSource, /class="ui-status-pill"/)
  assert.doesNotMatch(userIdentityCellSource, /class="ui-tag-pill"/)
  assert.match(userIdentityMetaSource, /<AdminStatusPill :class-name="statusClass\(user\.status\)">/)
  assert.match(userIdentityMetaSource, /<AdminTagPill v-for="role in user\.roles \|\| \[\]" :key="`\$\{user\.id\}-\$\{role\}`">/)
  assert.match(userIdentityMetaSource, /roleLabel\(role\)/)
  assert.match(userIdentityMetaSource, /suspendedReason/)
  assert.doesNotMatch(userIdentityMetaSource, /class="ui-status-pill"/)
  assert.doesNotMatch(userIdentityMetaSource, /class="ui-tag-pill"/)
  assert.match(userServiceStatusCellSource, /<AdminStatusPill/)
  assert.doesNotMatch(userServiceStatusCellSource, /class="ui-status-pill"/)
  assert.match(userServiceStatusCellSource, /serviceStatusClass\(user\.service\?\.serviceStatus\)/)
  assert.match(userServiceStatusCellSource, /尚未开通/)
  assert.match(userUsageCellSource, /user\.officialUsage\?\.totalCalls/)
  assert.match(userUsageCellSource, /topModelLabel\(user\)/)
  assert.match(userReconciliationCellSource, /user\.reconciliation\?\.pendingCount/)
  assert.match(userReconciliationCellSource, /最近活跃/)
})

test('admin user service pagination uses a focused feature module', () => {
  assert.ok(existsSync(userServicePaginationUrl))
  assert.ok(existsSync(adminPaginationBarUrl))
  assert.match(userServiceResultsPanelSource, /<AdminUserServicePagination/)
  assert.match(userServiceResultsPanelSource, /:total-user-pages="totalUserPages"/)
  assert.match(userServiceResultsPanelSource, /:user-page="userPage"/)
  assert.match(userServiceResultsPanelSource, /:visible-user-pages="visibleUserPages"/)
  assert.match(userServiceResultsPanelSource, /@set-user-page="emit\('set-user-page', \$event\)"/)
  assert.doesNotMatch(userServiceSectionSource, /上一页/)
  assert.doesNotMatch(userServiceSectionSource, /下一页/)
  assert.doesNotMatch(userServiceSectionSource, /v-for="page in visibleUserPages"/)

  assert.match(userServicePaginationSource, /v-if="totalUserPages > 1"/)
  assert.match(userServicePaginationSource, /import AdminPaginationBar from '@\/components\/admin\/AdminPaginationBar\.vue'/)
  assert.match(userServicePaginationSource, /<AdminPaginationBar/)
  assert.match(userServicePaginationSource, /:page="userPage"/)
  assert.match(userServicePaginationSource, /:total-pages="totalUserPages"/)
  assert.match(userServicePaginationSource, /:visible-pages="visibleUserPages"/)
  assert.match(userServicePaginationSource, /@set-page="emit\('set-user-page', \$event\)"/)
  assert.doesNotMatch(userServicePaginationSource, /<AdminMicroButton/)
  assert.match(adminPaginationBarSource, /class="admin-pagination-bar"/)
  assert.match(adminPaginationBarSource, /import AdminMicroButton from '\.\/AdminMicroButton\.vue'/)
  assert.match(adminPaginationBarSource, /emit\('set-page', normalizedPage - 1\)/)
  assert.match(adminPaginationBarSource, /emit\('set-page', page\)/)
  assert.match(adminPaginationBarSource, /emit\('set-page', normalizedPage \+ 1\)/)
})

test('admin service reconciliation notices use the shared notice module', () => {
  assert.ok(existsSync(adminNoticeUrl))
  assert.match(adminNoticeSource, /admin-notice/)
  assert.match(adminNoticeSource, /variant/)

  assert.match(serviceReconciliationSectionSource, /<AdminNotice/)
  assert.match(serviceReconciliationSectionSource, /variant="warning"/)
  assert.match(serviceReconciliationSectionSource, /{{ serviceLoadNotice }}/)
  assert.doesNotMatch(serviceReconciliationSectionSource, /service-alert/)
  assert.doesNotMatch(serviceReconciliationSectionSource, /\.service-alert/)
})

test('admin service reconciliation header uses a focused feature module', () => {
  assert.ok(existsSync(serviceReconciliationHeaderUrl))
  assert.match(serviceReconciliationSectionSource, /import AdminServiceReconciliationHeader from '\.\/AdminServiceReconciliationHeader\.vue'/)
  assert.match(serviceReconciliationSectionSource, /<AdminServiceReconciliationHeader\s+:can-reconcile-billing="canReconcileBilling"\s+:loading302="loading302"\s+:reconciling-billing="reconcilingBilling"\s+@reconcile-billing="emit\('reconcile-billing'\)"\s+@refresh-service-data="emit\('refresh-service-data'\)"\s+\/>/)
  assert.doesNotMatch(serviceReconciliationSectionSource, /<AdminSectionHeader/)
  assert.doesNotMatch(serviceReconciliationSectionSource, /<AdminMicroButton/)

  assert.match(serviceReconciliationHeaderSource, /<AdminSectionHeader/)
  assert.match(serviceReconciliationHeaderSource, /title="消耗对账"/)
  assert.match(serviceReconciliationHeaderSource, /caption="官方消耗同步、请求查询和服务调用日志集中在这里处理。"/)
  assert.match(serviceReconciliationHeaderSource, /<AdminMicroButton size="md" :disabled="loading302" @click="emit\('refresh-service-data'\)">/)
  assert.match(serviceReconciliationHeaderSource, /loading302 \? '刷新中\.\.\.' : '刷新服务数据'/)
  assert.match(serviceReconciliationHeaderSource, /v-if="canReconcileBilling"/)
  assert.match(serviceReconciliationHeaderSource, /size="md"/)
  assert.match(serviceReconciliationHeaderSource, /@click="emit\('reconcile-billing'\)"/)
  assert.match(serviceReconciliationHeaderSource, /reconcilingBilling \? '同步中\.\.\.' : '同步官方消耗'/)
  assert.match(serviceReconciliationHeaderSource, /defineEmits\(\[\s*'reconcile-billing',\s*'refresh-service-data'\s*\]\)/s)
})

test('admin service reconciliation query panels compose the shared panel card module', () => {
  assert.ok(existsSync(adminPanelCardUrl))
  assert.ok(existsSync(serviceApiLogFiltersUrl))
  assert.ok(existsSync(serviceApiLogsPanelUrl))
  assert.ok(existsSync(serviceRecordQueryPanelUrl))
  assert.ok(existsSync(serviceRecordSummaryUrl))
  assert.match(adminPanelCardSource, /import AdminGlassSurface from '\.\/AdminGlassSurface\.vue'/)
  assert.match(adminPanelCardSource, /<AdminGlassSurface/)
  assert.doesNotMatch(adminPanelCardSource, /ui-glass-card/)
  assert.equal((serviceReconciliationSectionSource.match(/<AdminPanelCard/g) || []).length, 0)
  assert.match(serviceReconciliationSectionSource, /<AdminServiceApiLogsPanel/)
  assert.match(serviceReconciliationSectionSource, /<AdminServiceRecordQueryPanel/)
  assert.match(serviceReconciliationSectionSource, /:api-logs="apiLogs"/)
  assert.match(serviceReconciliationSectionSource, /:api-log-pagination="apiLogPagination"/)
  assert.match(serviceReconciliationSectionSource, /:loading-record="loadingRecord"/)
  assert.match(serviceReconciliationSectionSource, /:loading-api-logs="loadingApiLogs"/)
  assert.match(serviceReconciliationSectionSource, /:log302-query="log302Query"/)
  assert.match(serviceReconciliationSectionSource, /:record-data="recordData"/)
  assert.match(serviceReconciliationSectionSource, /:record-request-id="recordRequestId"/)
  assert.match(serviceReconciliationSectionSource, /@load-api-logs="emit\('load-api-logs'\)"/)
  assert.match(serviceReconciliationSectionSource, /@query-record="emit\('query-record'\)"/)
  assert.match(serviceReconciliationSectionSource, /@update-log-query="forwardLogQueryUpdate"/)
  assert.match(serviceReconciliationSectionSource, /@update:record-request-id="emit\('update:recordRequestId', \$event\)"/)
  assert.doesNotMatch(serviceReconciliationSectionSource, /title="消耗详情（请求 ID）"/)
  assert.doesNotMatch(serviceReconciliationSectionSource, /title="服务调用日志查询"/)
  assert.doesNotMatch(serviceReconciliationSectionSource, /<div class="ui-glass-card rounded-2xl p-4">/)

  assert.match(serviceApiLogsPanelSource, /<AdminPanelCard/)
  assert.doesNotMatch(serviceApiLogsPanelSource, /ui-glass-card/)
  assert.match(serviceApiLogsPanelSource, /title="服务调用日志查询"/)
  assert.match(serviceApiLogsPanelSource, /caption="按 API 名称、时间范围和分页条件查询对应服务调用日志。"/)
  assert.match(serviceApiLogsPanelSource, /apiLogPagination:\s*\{\s*type: Object,\s*default: \(\) => \(\{ page: 1, limit: 10, total: 0 \}\)\s*\}/s)
  assert.match(serviceApiLogsPanelSource, /import AdminPaginationBar from '@\/components\/admin\/AdminPaginationBar\.vue'/)
  assert.match(serviceApiLogsPanelSource, /import AdminServiceApiLogFilters from '\.\/AdminServiceApiLogFilters\.vue'/)
  assert.match(serviceApiLogsPanelSource, /import AdminServiceApiLogRow from '\.\/AdminServiceApiLogRow\.vue'/)
  assert.match(serviceApiLogsPanelSource, /<AdminServiceApiLogFilters\s+:loading-api-logs="loadingApiLogs"\s+:log302-query="log302Query"\s+@load-api-logs="emit\('load-api-logs'\)"\s+@update-log-query="forwardLogQueryUpdate"\s+\/>/)
  assert.doesNotMatch(serviceApiLogsPanelSource, /<template #actions>/)
  assert.doesNotMatch(serviceApiLogsPanelSource, /header-class="mb-3 flex flex-wrap items-center justify-between gap-2"/)
  assert.match(serviceApiLogsPanelSource, /<AdminServiceApiLogRow\s+v-for="\(item, idx\) in apiLogs"\s+:key="item\.request_id \|\| item\.id \|\| idx"\s+:index="idx"\s+:item="item"\s+:row-class="rowClass"\s+\/>/)
  assert.match(serviceApiLogsPanelSource, /<AdminEmptyState/)
  assert.match(serviceApiLogsPanelSource, /<AdminTableShell/)
  assert.match(serviceApiLogsPanelSource, /<AdminPaginationBar[\s\S]+:page="apiLogPage"[\s\S]+:limit="apiLogLimit"[\s\S]+:total="apiLogTotal"[\s\S]+@set-page="setApiLogPage"/)
  assert.match(serviceApiLogsPanelSource, /const forwardLogQueryUpdate = \(key, value\) =>/)
  assert.match(serviceApiLogsPanelSource, /emit\('update-log-query', key, value\)/)
  assert.match(serviceApiLogsPanelSource, /const setApiLogPage = \(page\) => \{/)
  assert.match(serviceApiLogsPanelSource, /emit\('update-log-query', 'page', page\)/)
  assert.match(serviceApiLogsPanelSource, /emit\('load-api-logs'\)/)
  assert.doesNotMatch(serviceApiLogsPanelSource, /<tr v-for="\(item, idx\) in apiLogs"/)
  assert.doesNotMatch(serviceApiLogsPanelSource, /<AdminControlField/)
  assert.doesNotMatch(serviceApiLogsPanelSource, /<AdminMicroButton/)
  assert.doesNotMatch(serviceApiLogsPanelSource, /updateNumericLogQuery/)
  assert.doesNotMatch(serviceApiLogsPanelSource, /item\.request_id \|\| item\.requestId \|\| item\.id/)
  assert.match(serviceApiLogFiltersSource, /<AdminFilterToolbar class="admin-service-log-filters" compact grid>/)
  assert.match(serviceApiLogFiltersSource, /import AdminFilterToolbar from '@\/components\/admin\/AdminFilterToolbar\.vue'/)
  assert.match(serviceApiLogFiltersSource, /<AdminFilterField label="API 名称"/)
  assert.match(serviceApiLogFiltersSource, /<AdminFilterField label="开始时间"/)
  assert.match(serviceApiLogFiltersSource, /<AdminFilterField label="结束时间"/)
  assert.match(serviceApiLogFiltersSource, /<AdminFilterField label="页码"/)
  assert.match(serviceApiLogFiltersSource, /<AdminFilterField label="每页"/)
  assert.match(serviceApiLogFiltersSource, /<AdminControlField[\s\S]+:value="log302Query\.apiName"[\s\S]+placeholder="eager_user_\.\.\."[\s\S]+@input="updateLogQuery\('apiName', \$event\)"/)
  assert.match(serviceApiLogFiltersSource, /<AdminControlField[\s\S]+:value="log302Query\.start"[\s\S]+type="datetime-local"[\s\S]+@input="updateLogQuery\('start', \$event\)"/)
  assert.match(serviceApiLogFiltersSource, /<AdminControlField[\s\S]+:value="log302Query\.limit"[\s\S]+type="number"[\s\S]+max="20"[\s\S]+variant="number"[\s\S]+@input="updateNumericLogQuery\('limit', \$event\)"/)
  assert.match(serviceApiLogFiltersSource, /<AdminMicroButton size="md" :disabled="loadingApiLogs" @click="emit\('load-api-logs'\)">查询<\/AdminMicroButton>/)
  assert.match(serviceApiLogFiltersSource, /emit\('update-log-query', key, value\)/)
  assert.match(serviceApiLogFiltersSource, /clampPaginationValue\(key, event\.target\.value\)/)
  assert.doesNotMatch(serviceApiLogFiltersSource, /!\w-\[190px\]/)
  assert.ok(existsSync(serviceApiLogRowUrl))
  assert.match(serviceApiLogRowSource, /<tr :class="rowClass">/)
  assert.match(serviceApiLogRowSource, /item\.request_id \|\| item\.requestId \|\| item\.id \|\| '-'/)
  assert.match(serviceApiLogRowSource, /item\.model \|\| item\.model_name \|\| '-'/)
  assert.match(serviceApiLogRowSource, /item\.cost \?\? item\.cost_usd \?\? '-'/)
  assert.match(serviceApiLogRowSource, /item\.status \|\| item\.code \|\| '-'/)
  assert.match(serviceApiLogRowSource, /item\.created_at \|\| item\.createdAt \|\| item\.time \|\| '-'/)
  assert.match(serviceApiLogRowSource, /index:\s*\{\s*type: Number,\s*default: 0\s*\}/s)
  assert.match(serviceRecordQueryPanelSource, /<AdminPanelCard/)
  assert.doesNotMatch(serviceRecordQueryPanelSource, /ui-glass-card/)
  assert.match(serviceRecordQueryPanelSource, /title="消耗详情（请求 ID）"/)
  assert.match(serviceRecordQueryPanelSource, /caption="按 request_id 查看单次调用的成本和用量明细。"/)
  assert.match(serviceRecordQueryPanelSource, /<AdminFilterToolbar class="admin-record-query-toolbar" compact grid>/)
  assert.match(serviceRecordQueryPanelSource, /<AdminFilterField label="请求 ID">/)
  assert.match(serviceRecordQueryPanelSource, /<AdminEmptyState v-else class="mt-3">/)
  assert.match(serviceRecordQueryPanelSource, /placeholder="粘贴请求 ID"/)
  assert.match(serviceRecordQueryPanelSource, /<AdminMicroButton size="md" :disabled="loadingRecord" @click="emit\('query-record'\)">/)
  assert.match(serviceRecordQueryPanelSource, /emit\('query-record'\)/)
  assert.match(serviceRecordQueryPanelSource, /emit\('update:recordRequestId'/)
  assert.match(serviceRecordQueryPanelSource, /import AdminServiceRecordSummary from '\.\/AdminServiceRecordSummary\.vue'/)
  assert.match(serviceRecordQueryPanelSource, /<AdminServiceRecordSummary v-if="recordData" :record-data="recordData" \/>/)
  assert.doesNotMatch(serviceRecordQueryPanelSource, /recordData\.process_time/)
  assert.doesNotMatch(serviceRecordQueryPanelSource, /<div v-if="recordData" class="mt-4 grid grid-cols-2 gap-2 text-xs text-white\/75 md:grid-cols-5">/)
  assert.match(serviceRecordSummarySource, /<div class="mt-4 grid grid-cols-2 gap-2 text-xs text-white\/75 md:grid-cols-5">/)
  assert.match(serviceRecordSummarySource, /recordData\.model \|\| '-'/)
  assert.match(serviceRecordSummarySource, /recordData\.cost \?\? '-'/)
  assert.match(serviceRecordSummarySource, /recordData\.input_token \?\? '-'/)
  assert.match(serviceRecordSummarySource, /recordData\.output_token \?\? '-'/)
  assert.match(serviceRecordSummarySource, /recordData\.process_time \?\? '-'/)
})

test('admin service reconciliation summary metrics use the shared glass metric card module', () => {
  assert.ok(existsSync(adminGlassMetricCardUrl))
  assert.ok(existsSync(adminGlassSurfaceUrl))
  assert.ok(existsSync(serviceReconciliationSummaryMetricsUrl))
  assert.match(adminGlassMetricCardSource, /<AdminMetricCard/)
  assert.match(adminGlassMetricCardSource, /<AdminGlassSurface/)
  assert.match(adminGlassMetricCardSource, /surface-class="rounded-xl p-4"/)
  assert.doesNotMatch(adminGlassMetricCardSource, /ui-glass-card/)

  assert.match(serviceReconciliationSectionSource, /<AdminServiceReconciliationSummaryMetrics/)
  assert.match(serviceReconciliationSectionSource, /:active-service-users="activeServiceUsers"/)
  assert.match(serviceReconciliationSectionSource, /:api-log-count="apiLogs\.length"/)
  assert.match(serviceReconciliationSectionSource, /:balance-display="balanceDisplay"/)
  assert.match(serviceReconciliationSectionSource, /:can-read-usage="canReadUsage"/)
  assert.match(serviceReconciliationSectionSource, /:can-read-users="canReadUsers"/)
  assert.doesNotMatch(serviceReconciliationSectionSource, /<AdminGlassMetricCard/)

  assert.equal((serviceReconciliationSummaryMetricsSource.match(/<AdminGlassMetricCard/g) || []).length, 3)
  assert.match(serviceReconciliationSummaryMetricsSource, /label="账户余额"/)
  assert.match(serviceReconciliationSummaryMetricsSource, /label="已开通服务"/)
  assert.match(serviceReconciliationSummaryMetricsSource, /label="日志结果数"/)
  assert.match(serviceReconciliationSummaryMetricsSource, /需要权限：admin\.usage\.read_all/)
  assert.doesNotMatch(serviceReconciliationSummaryMetricsSource, /card-class="ui-glass-card rounded-xl p-4"/)
  assert.doesNotMatch(serviceReconciliationSummaryMetricsSource, /label-class="text-xs uppercase tracking-\[0\.12em\] text-white\/40"/)
  assert.doesNotMatch(serviceReconciliationSummaryMetricsSource, /value-class="mt-2 text-2xl font-semibold text-white"/)
  assert.doesNotMatch(serviceReconciliationSummaryMetricsSource, /note-class="mt-2 text-xs text-white\/45"/)
})

test('admin glass surfaces use the shared surface module', () => {
  assert.ok(existsSync(adminGlassSurfaceUrl))
  assert.match(adminGlassSurfaceSource, /ui-glass-card/)
  assert.match(adminGlassSurfaceSource, /\.ui-glass-card\s*\{/)
  assert.match(adminGlassSurfaceSource, /getSurfaceEl/)
  assert.doesNotMatch(styleSource, /\.ui-glass-card\s*\{/)

  for (const sharedSource of [
    adminDashboardSectionFrameSource,
    adminPanelCardSource,
    adminGlassMetricCardSource,
    adminOverviewMetricGridSource,
    serviceApiLogsPanelSource,
    serviceRecordQueryPanelSource
  ]) {
    assert.match(sharedSource, /<AdminGlassSurface|<AdminPanelCard|<AdminGlassMetricCard/)
    assert.doesNotMatch(sharedSource, /ui-glass-card/)
  }
  assert.doesNotMatch(adminOverviewSectionSource, /ui-glass-card/)
})

test('admin page delegates the page chrome to the shared shell module', () => {
  assert.match(source, /<AdminShell/)
  assert.match(source, /<template #sidebar>/)
  assert.doesNotMatch(source, /adminShellRef/)
  assert.ok(existsSync(adminShellUrl))
  assert.match(adminShellSource, /admin-shell/)
  assert.match(adminShellSource, /admin-frame/)
  assert.match(adminShellSource, /admin-main/)
  assert.match(adminShellSource, /<slot name="sidebar"/)
  assert.match(adminShellSource, /<slot \/>/)
})

test('admin page delegates desktop navigation to the shared sidebar module', () => {
  assert.match(source, /<AdminSidebar/)
  assert.match(source, /:nav-items="navItems"/)
  assert.match(source, /:active-section="activeSection"/)
  assert.match(source, /:access-scope="accessScope"/)
  assert.match(source, /:account-label="adminAccountLabel"/)
  assert.match(source, /:roles="auth\.roles\.value"/)
  assert.match(source, /@select-section="scrollToSection"/)
  assert.doesNotMatch(source, /class="menu-item"/)
  assert.doesNotMatch(source, /\.menu-item/)

  assert.ok(existsSync(adminSidebarUrl))
  assert.match(adminSidebarSource, /<AdminSidebarFrame/)
  assert.match(adminSidebarSource, /EagerCanvas/)
  assert.doesNotMatch(adminSidebarSource, /访问范围/)
  assert.match(adminSidebarSource, /当前操作会话/)
  assert.match(adminSidebarSource, /\$emit\('select-section', item\.key\)/)
})

test('admin desktop sidebars compose the shared sidebar frame module', () => {
  assert.ok(existsSync(adminSidebarFrameUrl))
  assert.ok(existsSync(adminSidebarNavItemUrl))
  assert.ok(existsSync(adminSidebarUrl))
  assert.ok(existsSync(usageAdminSidebarUrl))

  assert.match(adminSidebarFrameSource, /class="admin-sidebar/)
  assert.match(adminSidebarFrameSource, /<slot name="nav"/)
  assert.match(adminSidebarFrameSource, /<slot name="meta"/)
  assert.match(adminSidebarFrameSource, /sessionTitle/)
  assert.match(adminSidebarFrameSource, /sessionPrimary/)
  assert.match(adminSidebarFrameSource, /sessionSecondary/)

  assert.match(adminSidebarNavItemSource, /class="admin-sidebar-nav-item"/)
  assert.match(adminSidebarNavItemSource, /class="admin-sidebar-nav-note"/)
  assert.match(adminSidebarNavItemSource, /<button/)
  assert.match(adminSidebarNavItemSource, /<a/)
  assert.match(adminSidebarNavItemSource, /\.admin-sidebar-nav-item\s*\{/)
  assert.match(adminSidebarNavItemSource, /\.admin-sidebar-nav-note\s*\{/)
  assert.doesNotMatch(styleSource, /\.admin-sidebar-nav-item\s*\{/)
  assert.doesNotMatch(styleSource, /\.admin-sidebar-nav-note\s*\{/)

  assert.match(adminSidebarSource, /<AdminSidebarFrame/)
  assert.match(adminSidebarSource, /brand-title="管理控制台"/)
  assert.match(adminSidebarSource, /<template #nav>/)
  assert.doesNotMatch(adminSidebarSource, /<template #meta>/)
  assert.match(adminSidebarSource, /import AdminSidebarNavItem from '\.\/AdminSidebarNavItem\.vue'/)
  assert.match(adminSidebarSource, /<AdminSidebarNavItem/)
  assert.doesNotMatch(adminSidebarSource, /class="admin-sidebar-nav-item"/)
  assert.doesNotMatch(adminSidebarSource, /class="admin-sidebar-nav-note"/)
  assert.doesNotMatch(adminSidebarSource, /import AdminPermissionChip from '\.\/AdminPermissionChip\.vue'/)
  assert.doesNotMatch(adminSidebarSource, /<AdminPermissionChip/)
  assert.doesNotMatch(adminSidebarSource, /class="admin-permission-chip"/)
  assert.doesNotMatch(adminSidebarSource, /\.admin-sidebar\s*\{/)
  assert.doesNotMatch(adminSidebarSource, /\.menu-item/)
  assert.doesNotMatch(adminSidebarSource, /\.permission-chip/)

  assert.match(usageAdminSidebarSource, /<AdminSidebarFrame/)
  assert.match(usageAdminSidebarSource, /brand-title="Usage Admin"/)
  assert.match(usageAdminSidebarSource, /<template #nav>/)
  assert.match(usageAdminSidebarSource, /import AdminSidebarNavItem from '@\/components\/admin\/AdminSidebarNavItem\.vue'/)
  assert.match(usageAdminSidebarSource, /<AdminSidebarNavItem/)
  assert.doesNotMatch(usageAdminSidebarSource, /class="admin-sidebar-nav-item"/)
  assert.doesNotMatch(usageAdminSidebarSource, /class="admin-sidebar-nav-note"/)
  assert.doesNotMatch(usageAdminSidebarSource, /\.usage-admin-sidebar/)
  assert.doesNotMatch(usageAdminSidebarSource, /\.usage-nav-item/)
})

test('admin page delegates the top header actions to a shared module', () => {
  assert.ok(existsSync(adminHeaderActionButtonUrl))
  assert.match(source, /<AdminPageHeader/)
  assert.match(source, /:display-name="displayName"/)
  assert.match(source, /:access-scope="accessScope"/)
  assert.doesNotMatch(source, /:is-refreshing="isRefreshing"/)
  assert.doesNotMatch(source, /:can-read-users="canReadUsers"/)
  assert.doesNotMatch(source, /:show-service-section="showServiceSection"/)
  assert.doesNotMatch(source, /@refresh="loadAll"/)
  assert.doesNotMatch(source, /@open-users="scrollToSection\('users'\)"/)
  assert.doesNotMatch(source, /@open-service="scrollToSection\('service'\)"/)
  assert.match(source, /@go-home="goHome"/)
  assert.doesNotMatch(source, /<header class="mb-8 border-b border-white\/10 pb-6">/)

  assert.ok(existsSync(adminPageHeaderUrl))
  assert.match(adminPageHeaderSource, /管理后台/)
  assert.match(adminPageHeaderSource, /欢迎回来/)
  assert.doesNotMatch(adminPageHeaderSource, /刷新数据/)
  assert.match(adminPageHeaderSource, /返回首页/)
  assert.doesNotMatch(adminPageHeaderSource, /\$emit\('refresh'\)/)
  assert.match(adminPageHeaderSource, /import AdminHeaderActionButton from '\.\/AdminHeaderActionButton\.vue'/)
  assert.equal((adminPageHeaderSource.match(/<AdminHeaderActionButton/g) || []).length, 1)
  assert.doesNotMatch(adminPageHeaderSource, /class="ui-action-btn/)
  assert.match(adminHeaderActionButtonSource, /import AdminMicroButton from '\.\/AdminMicroButton\.vue'/)
  assert.match(adminHeaderActionButtonSource, /import \{ HomeOutline \} from '@\/icons\/coolicons'/)
  assert.match(adminHeaderActionButtonSource, /<AdminMicroButton/)
  assert.match(adminHeaderActionButtonSource, /:icon="HomeOutline"/)
  assert.match(adminHeaderActionButtonSource, /size="md"/)
  assert.doesNotMatch(adminHeaderActionButtonSource, /\.ui-action-btn\s*\{/)
  assert.match(adminMicroButtonSource, /ui-micro-btn-md/)
  assert.doesNotMatch(styleSource, /\.ui-action-btn\s*\{/)
  assert.doesNotMatch(styleSource, /\.ui-action-btn:disabled\s*\{/)
})

test('admin permission chips use the shared component style module', () => {
  assert.ok(existsSync(adminPermissionChipUrl))
  assert.ok(existsSync(adminPageHeaderUrl))

  assert.match(adminPermissionChipSource, /class="admin-permission-chip"/)
  assert.match(adminPermissionChipSource, /\.admin-permission-chip\s*\{/)
  assert.match(adminPageHeaderSource, /import AdminPermissionChip from '\.\/AdminPermissionChip\.vue'/)
  assert.match(adminPageHeaderSource, /<AdminPermissionChip/)
  assert.doesNotMatch(adminPageHeaderSource, /class="admin-permission-chip"/)
  assert.doesNotMatch(adminPageHeaderSource, /class="permission-chip"/)
  assert.doesNotMatch(adminPageHeaderSource, /\.permission-chip\s*\{/)
  assert.doesNotMatch(styleSource, /\.admin-permission-chip\s*\{/)
})

test('admin page delegates mobile section navigation to a shared module', () => {
  assert.match(source, /<AdminMobileNav/)
  assert.match(source, /:nav-items="navItems"/)
  assert.match(source, /:active-section="activeSection"/)
  assert.match(source, /@select-section="scrollToSection"/)
  assert.doesNotMatch(source, /`mobile-\$\{item\.key\}`/)

  assert.ok(existsSync(adminMobileNavUrl))
  assert.match(adminMobileNavSource, /lg:hidden/)
  assert.match(adminMobileNavSource, /import AdminMicroButton from '\.\/AdminMicroButton\.vue'/)
  assert.match(adminMobileNavSource, /<AdminMicroButton/)
  assert.doesNotMatch(adminMobileNavSource, /class="ui-micro-btn/)
  assert.doesNotMatch(adminMobileNavSource, /ui-micro-btn-primary/)
  assert.match(adminMobileNavSource, /\$emit\('select-section', item\.key\)/)
})

test('admin feature modules delegate micro button styling to the shared module', () => {
  const directMicroButtonUsers = [
    ['AdminMobileNav.vue', adminMobileNavSource],
    ['AdminEditorMainButton.vue', adminEditorMainButtonSource],
    ...readAdminFeatureSources().map(({ name, source }) => [`features/${name}`, source])
  ]
    .filter(([, source]) => /class="[^"]*ui-micro-btn/.test(source) || /'ui-micro-btn/.test(source))
    .map(([name]) => name)

  assert.deepEqual(directMicroButtonUsers, [])
})

test('admin page delegates dashboard section composition to a page-level feature module', () => {
  assert.ok(existsSync(adminDashboardSectionsUrl))
  assert.ok(existsSync(adminDashboardSectionPropsUrl))
  assert.ok(existsSync(adminUsersDashboardSectionsUrl))
  assert.ok(source.split('\n').length < 300, 'AdminUsers.vue should stay below 300 lines as a route container')
  assert.match(source, /<AdminDashboardSections/)
  assert.match(source, /ref="dashboardSectionsRef"/)
  assert.match(source, /:active-route-section="activeRouteSection"/)
  assert.match(source, /:overview-section="overviewSectionProps"/)
  assert.match(source, /:user-service-section="userServiceSectionProps"/)
  assert.match(source, /:service-reconciliation-section="serviceReconciliationSectionProps"/)
  assert.match(source, /:audit-log-section="auditLogSectionProps"/)
  assert.match(source, /@update:search-query="userSearchQuery = \$event"/)
  assert.match(source, /@update:status-filter="userStatusFilter = \$event"/)
  assert.match(source, /@update:record-request-id="recordRequestId = \$event"/)
  assert.match(source, /@refresh-overview="refreshDashboardOverview"/)
  assert.match(source, /@refresh-users="loadUsers"/)
  assert.match(source, /@refresh-service-data="refreshServiceData"/)
  assert.match(source, /@load-logs="loadLogs"/)
  assert.match(source, /useAdminUsersDashboardSections/)
  assert.doesNotMatch(source, /useAdminDashboardSectionProps/)
  assert.doesNotMatch(source, /const overviewSectionProps = computed/)
  assert.doesNotMatch(source, /const userServiceSectionProps = computed/)
  assert.doesNotMatch(source, /const serviceReconciliationSectionProps = computed/)
  assert.doesNotMatch(source, /const auditLogSectionProps = computed/)
  assert.doesNotMatch(source, /:active-service-users="activeServiceUsers"/)
  assert.doesNotMatch(source, /:audit-logs="auditLogs"/)
  assert.doesNotMatch(source, /<AdminOverviewSection/)
  assert.doesNotMatch(source, /<AdminUserServiceSection/)
  assert.doesNotMatch(source, /<AdminServiceReconciliationSection/)
  assert.doesNotMatch(source, /<AdminAuditLogSection/)

  assert.match(adminDashboardSectionsSource, /<AdminOverviewSection/)
  assert.match(adminDashboardSectionsSource, /v-bind="overviewSection"/)
  assert.match(adminDashboardSectionsSource, /<AdminUserServiceSection/)
  assert.match(adminDashboardSectionsSource, /v-bind="userServiceContentProps"/)
  assert.match(adminDashboardSectionsSource, /<AdminServiceReconciliationSection/)
  assert.match(adminDashboardSectionsSource, /v-bind="serviceReconciliationContentProps"/)
  assert.match(adminDashboardSectionsSource, /<AdminAuditLogSection/)
  assert.match(adminDashboardSectionsSource, /v-bind="auditLogContentProps"/)
  assert.match(adminDashboardSectionsSource, /activeRouteSection: \{ type: String, default: 'overview' \}/)
  assert.match(adminDashboardSectionsSource, /overviewSection: \{ type: Object/)
  assert.match(adminDashboardSectionsSource, /userServiceSection: \{ type: Object/)
  assert.match(adminDashboardSectionsSource, /serviceReconciliationSection: \{ type: Object/)
  assert.match(adminDashboardSectionsSource, /auditLogSection: \{ type: Object/)
  assert.doesNotMatch(adminDashboardSectionsSource, /activeServiceUsers: \{ type:/)
  assert.doesNotMatch(adminDashboardSectionsSource, /auditLogs: \{ type:/)
  assert.match(adminUsersDashboardSectionsSource, /apiLogPagination: serviceOps\.apiLogPagination/)
  assert.match(adminDashboardSectionPropsSource, /apiLogPagination: unref\(apiLogPagination\)/)
  assert.match(adminDashboardSectionsSource, /defineExpose/)
  assert.match(adminDashboardSectionsSource, /getSectionEl/)

  assert.match(adminDashboardSectionPropsSource, /export const useAdminDashboardSectionProps/)
  assert.match(adminDashboardSectionPropsSource, /overviewSectionProps/)
  assert.match(adminDashboardSectionPropsSource, /userServiceSectionProps/)
  assert.match(adminDashboardSectionPropsSource, /serviceReconciliationSectionProps/)
  assert.match(adminDashboardSectionPropsSource, /auditLogSectionProps/)
  assert.match(adminUsersDashboardSectionsSource, /import \{ useAdminDashboardSectionProps \} from '\.\/useAdminDashboardSectionProps'/)
  assert.match(adminUsersDashboardSectionsSource, /export const useAdminUsersDashboardSections = \(/)
  assert.match(adminUsersDashboardSectionsSource, /useAdminDashboardSectionProps\(\{/)
  assert.doesNotMatch(adminUsersDashboardSectionsSource, /\.\.\.accessState/)
  assert.doesNotMatch(adminUsersDashboardSectionsSource, /\.\.\.usersState/)
  assert.doesNotMatch(adminUsersDashboardSectionsSource, /\.\.\.dashboardData/)
  assert.doesNotMatch(adminUsersDashboardSectionsSource, /\.\.\.displayState/)
  assert.doesNotMatch(adminUsersDashboardSectionsSource, /\.\.\.serviceOps/)
  assert.doesNotMatch(adminUsersDashboardSectionsSource, /\.\.\.userActions/)
  assert.match(adminUsersDashboardSectionsSource, /userSearchQuery: usersState\.userSearchQuery/)
  assert.match(adminUsersDashboardSectionsSource, /userStatusFilter: usersState\.userStatusFilter/)
  assert.match(adminUsersDashboardSectionsSource, /selectedRoles: usersState\.selectedRoles/)
  assert.match(adminUsersDashboardSectionsSource, /recordRequestId: serviceOps\.recordRequestId/)
  assert.match(adminUsersDashboardSectionsSource, /log302Query: serviceOps\.log302Query/)
  assert.match(adminUsersDashboardSectionsSource, /logQuery: dashboardData\.logQuery/)
})

test('admin dashboard sections compose the shared section frame module', () => {
  assert.ok(existsSync(adminDashboardSectionFrameUrl))
  assert.match(adminDashboardSectionFrameSource, /admin-dashboard-section-frame/)
  assert.match(adminDashboardSectionFrameSource, /import AdminGlassSurface from '\.\/AdminGlassSurface\.vue'/)
  assert.match(adminDashboardSectionFrameSource, /<AdminGlassSurface/)
  assert.doesNotMatch(adminDashboardSectionFrameSource, /ui-glass-card/)
  assert.match(adminDashboardSectionFrameSource, /frameClass/)
  assert.match(adminDashboardSectionFrameSource, /<slot \/>/)
  assert.match(adminDashboardSectionFrameSource, /defineExpose/)
  assert.match(adminDashboardSectionFrameSource, /getSectionEl/)

  assert.match(adminDashboardSectionsSource, /<AdminDashboardSectionFrame/)
  assert.match(adminDashboardSectionsSource, /ref="usersRef"/)
  assert.match(adminDashboardSectionsSource, /ref="serviceRef"/)
  assert.match(adminDashboardSectionsSource, /ref="auditRef"/)
  assert.match(adminDashboardSectionsSource, /:show="userServiceSection\.canReadUsers"/)
  assert.match(adminDashboardSectionsSource, /:show="serviceReconciliationSection\.showServiceSection"/)
  assert.match(adminDashboardSectionsSource, /:show="auditLogSection\.canReadAudit && activeRouteSection === 'audit'"/)
  assert.match(adminDashboardSectionsSource, /v-bind="userServiceContentProps"/)
  assert.match(adminDashboardSectionsSource, /v-bind="serviceReconciliationContentProps"/)
  assert.match(adminDashboardSectionsSource, /v-bind="auditLogContentProps"/)
  assert.match(adminDashboardSectionsSource, /const omitSectionOnlyProps = \(section, omittedKeys\) =>/)
  assert.match(adminDashboardSectionsSource, /computed\(\(\) => omitSectionOnlyProps\(props\.userServiceSection, \['canReadUsers'\]\)\)/)
  assert.match(adminDashboardSectionsSource, /computed\(\(\) => omitSectionOnlyProps\(props\.serviceReconciliationSection, \['showServiceSection'\]\)\)/)
  assert.match(adminDashboardSectionsSource, /computed\(\(\) => omitSectionOnlyProps\(props\.auditLogSection, \['canReadAudit'\]\)\)/)
  assert.doesNotMatch(adminDashboardSectionsSource, /<AdminUserServiceSection\s+v-bind="userServiceSection"/)
  assert.doesNotMatch(adminDashboardSectionsSource, /<AdminServiceReconciliationSection\s+v-bind="serviceReconciliationSection"/)
  assert.doesNotMatch(adminDashboardSectionsSource, /<AdminAuditLogSection\s+v-bind="auditLogSection"/)
  assert.match(adminDashboardSectionsSource, /frame-class="mb-8 space-y-6"/)
  assert.match(adminDashboardSectionsSource, /getFramedSectionEl/)
  assert.doesNotMatch(adminDashboardSectionsSource, /<section v-if="userServiceSection\.canReadUsers"/)
  assert.doesNotMatch(adminDashboardSectionsSource, /<section v-if="serviceReconciliationSection\.showServiceSection"/)
  assert.doesNotMatch(adminDashboardSectionsSource, /<section v-if="auditLogSection\.canReadAudit"/)
  assert.doesNotMatch(adminDashboardSectionsSource, /class="ui-glass-card mb-8 scroll-mt-6 rounded-2xl p-5 md:p-6"/)
  assert.doesNotMatch(adminDashboardSectionsSource, /class="ui-glass-card scroll-mt-6 rounded-2xl p-5 md:p-6"/)
})

test('admin page delegates route section navigation to a composable', () => {
  assert.ok(existsSync(adminSectionNavigationUrl))
  assert.match(source, /useAdminSectionNavigation/)
  assert.match(source, /dashboardSectionsRef/)
  assert.match(source, /scrollToSection/)
  assert.match(source, /activeSection/)
  assert.match(source, /navItems/)
  assert.match(source, /ADMIN_SECTION_BY_ROUTE_NAME/)
  assert.match(source, /activeRouteSection/)
  assert.doesNotMatch(source, /ADMIN_ROUTE_NAME_BY_SECTION/)
  assert.doesNotMatch(source, /const getSectionEl =/)
  assert.doesNotMatch(source, /const onMainScroll =/)
  assert.doesNotMatch(source, /window\.addEventListener\('scroll'/)
  assert.doesNotMatch(source, /window\.removeEventListener\('scroll'/)

  assert.match(adminSectionNavigationSource, /useAdminSectionNavigation/)
  assert.match(adminSectionNavigationSource, /ADMIN_ROUTE_NAME_BY_SECTION/)
  assert.match(adminSectionNavigationSource, /ADMIN_SECTION_BY_ROUTE_NAME/)
  assert.match(adminSectionNavigationSource, /onMounted/)
  assert.match(adminSectionNavigationSource, /onBeforeUnmount/)
})

test('admin page delegates permissions and session identity to a composable', () => {
  assert.ok(existsSync(adminAccessStateUrl))
  assert.match(source, /useAdminAccessState/)
  for (const name of [
    'accessScope',
    'adminAccountLabel',
    'canActivateService',
    'canDisableService',
    'canManageRoles',
    'canManageUserStatus',
    'canReadAudit',
    'canReadUsage',
    'canReadUsers',
    'canReconcileBilling',
    'canResetService',
    'canUpdateServiceLimits',
    'displayName',
    'isSelf',
    'showServiceSection',
    'showUserActions'
  ]) {
    assert.match(source, new RegExp(name))
  }
  assert.doesNotMatch(source, /getAdminAccessScope/)
  assert.doesNotMatch(source, /const canReadUsers = computed/)
  assert.doesNotMatch(source, /const canManageRoles = computed/)
  assert.doesNotMatch(source, /const showServiceSection = computed/)
  assert.doesNotMatch(source, /const displayName = computed/)
  assert.doesNotMatch(source, /const adminAccountLabel = computed/)
  assert.doesNotMatch(source, /const accessScope = computed/)
  assert.doesNotMatch(source, /const isSelf = \(/)

  assert.match(adminAccessStateSource, /export const useAdminAccessState/)
  assert.match(adminAccessStateSource, /getAdminAccessScope/)
  assert.match(adminAccessStateSource, /getAdminDisplayName/)
  assert.match(adminAccessStateSource, /getAdminAccountLabel/)
  assert.match(adminAccessStateSource, /getAdminSelfCheck/)
})

test('admin page delegates user list state and pagination to a composable', () => {
  assert.ok(existsSync(adminUsersStateUrl))
  assert.match(source, /useAdminUsersState/)
  assert.match(source, /users/)
  assert.match(source, /userSearchQuery/)
  assert.match(source, /userStatusFilter/)
  assert.match(source, /selectedRoles/)
  assert.match(source, /activeServiceUsers/)
  assert.match(source, /filteredUsers/)
  assert.match(source, /pagedUsers/)
  assert.match(source, /setUserPage/)
  assert.match(source, /updateRoleSelection/)
  assert.match(source, /loadUsers/)
  assert.doesNotMatch(source, /getAdminUsers/)
  assert.doesNotMatch(source, /getAdminFilteredUsers/)
  assert.doesNotMatch(source, /getAdminPagedUsers/)
  assert.doesNotMatch(source, /getClampedAdminUserPage/)
  assert.doesNotMatch(source, /const users = ref\(\[\]\)/)
  assert.doesNotMatch(source, /const userSearchQuery = ref\(''\)/)
  assert.doesNotMatch(source, /watch\(\[userSearchQuery, userStatusFilter\]/)
  assert.doesNotMatch(source, /const loadUsers = async/)

  assert.match(adminUsersStateSource, /export const useAdminUsersState/)
  assert.match(adminUsersStateSource, /getAdminUsers/)
  assert.match(adminUsersStateSource, /getAdminFilteredUsers/)
  assert.match(adminUsersStateSource, /getAdminPagedUsers/)
  assert.match(adminUsersStateSource, /getClampedAdminUserPage/)
  assert.match(adminUsersStateSource, /watch\(\[userSearchQuery, userStatusFilter\]/)
})

test('admin page delegates user and service mutation actions to a composable', () => {
  assert.ok(existsSync(adminUserActionsUrl))
  assert.match(source, /useAdminUserActions/)
  for (const name of [
    'activateService',
    'activateUser',
    'deleteUser',
    'disableService',
    'reconcileBilling',
    'resetService',
    'saveRoles',
    'suspendUser',
    'updateServiceLimits'
  ]) {
    assert.match(source, new RegExp(name))
  }
  assert.match(source, /saving/)
  assert.match(source, /statusLoading/)
  assert.match(source, /deleting/)
  assert.match(source, /serviceLoading/)
  assert.match(source, /reconcilingBilling/)
  assert.doesNotMatch(source, /updateAdminUserRoles/)
  assert.doesNotMatch(source, /updateAdminUserStatus/)
  assert.doesNotMatch(source, /deleteAdminUser/)
  assert.doesNotMatch(source, /activateAdminUserService/)
  assert.doesNotMatch(source, /disableAdminUserService/)
  assert.doesNotMatch(source, /resetAdminUserService/)
  assert.doesNotMatch(source, /updateAdminUserServiceLimits/)
  assert.doesNotMatch(source, /reconcileAdminBilling/)
  assert.doesNotMatch(source, /const saveRoles = async/)
  assert.doesNotMatch(source, /const activateService = async/)
  assert.doesNotMatch(source, /const reconcileBilling = async/)
  assert.doesNotMatch(source, /const saving = ref\(\{\}\)/)
  assert.doesNotMatch(source, /const serviceLoading = ref\(\{\}\)/)

  assert.match(adminUserActionsSource, /export const useAdminUserActions/)
  assert.match(adminUserActionsSource, /updateAdminUserRoles/)
  assert.match(adminUserActionsSource, /activateAdminUserService/)
  assert.match(adminUserActionsSource, /reconcileAdminBilling/)
  assert.match(adminUserActionsSource, /getAdminServiceLimitPayload/)
})

test('admin page delegates dashboard usage and audit data loading to a composable', () => {
  assert.ok(existsSync(adminDashboardDataUrl))
  assert.match(source, /useAdminDashboardData/)
  for (const name of [
    'auditLogs',
    'barWidth',
    'loadLogs',
    'loadUsage',
    'loadingLogs',
    'loadingOverview',
    'loadingUsage',
    'logQuery',
    'pagination',
    'refreshOverview',
    'updateAuditLogQuery',
    'usageSeries',
    'usageSummary'
  ]) {
    assert.match(source, new RegExp(name))
  }
  assert.doesNotMatch(source, /getAdminAuditLogs/)
  assert.doesNotMatch(source, /getAdminUsageSummary/)
  assert.doesNotMatch(source, /getAdminUsageTimeseries/)
  assert.doesNotMatch(source, /getAdminUsageBarWidth/)
  assert.doesNotMatch(source, /getErrorMessage/)
  assert.doesNotMatch(source, /const usageSummary = ref/)
  assert.doesNotMatch(source, /const usageSeries = ref/)
  assert.doesNotMatch(source, /const auditLogs = ref/)
  assert.doesNotMatch(source, /const loadUsage = async/)
  assert.doesNotMatch(source, /const loadLogs = async/)
  assert.doesNotMatch(source, /const updateAuditLogQuery =/)

  assert.match(adminDashboardDataSource, /export const useAdminDashboardData/)
  assert.match(adminDashboardDataSource, /getAdminAuditLogs/)
  assert.match(adminDashboardDataSource, /getAdminUsageSummary/)
  assert.match(adminDashboardDataSource, /getAdminUsageTimeseries/)
  assert.match(adminDashboardDataSource, /const DEFAULT_AUDIT_LOG_PAGE_SIZE = 10/)
  assert.match(adminDashboardDataSource, /const pagination = ref\(\{ page: 1, limit: DEFAULT_AUDIT_LOG_PAGE_SIZE, total: 0 \}\)/)
  assert.match(adminDashboardDataSource, /const logQuery = ref\(\{ page: 1, limit: DEFAULT_AUDIT_LOG_PAGE_SIZE \}\)/)
  assert.match(adminDashboardDataSource, /getAdminAuditPagination/)
  assert.match(adminDashboardDataSource, /getAdminUsageBarWidth/)
})

test('admin page delegates service log query updates to the service ops composable', () => {
  assert.ok(existsSync(adminServiceOpsUrl))
  assert.match(source, /useAdminServiceOps/)
  assert.match(source, /updateLog302Query/)
  assert.doesNotMatch(source, /const updateLog302Query =/)

  assert.match(adminServiceOpsSource, /updateLog302Query/)
  assert.match(adminServiceOpsSource, /updateAdminLog302Query/)
  assert.match(adminServiceOpsSource, /createAdminServiceLogQuery/)
  assert.match(adminServiceOpsSource, /log302Query/)
  assert.match(adminServiceOpsSource, /const DEFAULT_API_LOG_PAGE_SIZE = 10/)
  assert.match(adminServiceOpsSource, /const log302Query = reactive\(createAdminServiceLogQuery\(\{ pageSize: DEFAULT_API_LOG_PAGE_SIZE \}\)\)/)
  assert.match(adminServiceOpsSource, /const apiLogPagination = ref\(\{ page: 1, limit: DEFAULT_API_LOG_PAGE_SIZE, total: 0 \}\)/)
  assert.match(adminServiceOpsSource, /apiLogPagination\.value = rsp\?\.data\?\.pagination \|\| \{/)
  assert.match(adminServiceOpsSource, /apiLogPagination,/)
})

test('admin page delegates refresh orchestration to a composable', () => {
  assert.ok(existsSync(adminDashboardRefreshUrl))
  assert.match(source, /useAdminDashboardRefresh/)
  assert.doesNotMatch(source, /isRefreshing/)
  assert.match(source, /loadAll/)
  assert.doesNotMatch(source, /const isRefreshing = computed/)
  assert.doesNotMatch(source, /const loadAll = async/)
  assert.doesNotMatch(source, /auth\.loadAdminSession/)

  assert.match(adminDashboardRefreshSource, /export const useAdminDashboardRefresh/)
  assert.match(adminDashboardRefreshSource, /auth\.loadAdminSession/)
  assert.match(adminDashboardRefreshSource, /router\.replace/)
  assert.match(adminDashboardRefreshSource, /showServiceSection/)
})

test('admin page delegates display labels and overview cards to a composable', () => {
  assert.ok(existsSync(adminDisplayStateUrl))
  assert.match(source, /useAdminDisplayState/)
  for (const name of [
    'roleOptions',
    'nowLabel',
    'roleLabel',
    'formatRoleList',
    'cards',
    'formatUsd',
    'statusClass',
    'statusLabel',
    'serviceStatusClass',
    'serviceStatusLabel',
    'topModelLabel',
    'formatDateTime',
    'toPrettyJson'
  ]) {
    assert.match(source, new RegExp(name))
  }
  assert.doesNotMatch(source, /ADMIN_ROLE_OPTIONS/)
  assert.doesNotMatch(source, /getAdminOverviewCards/)
  assert.doesNotMatch(source, /getAdminRoleLabel/)
  assert.doesNotMatch(source, /formatAdminUsd/)
  assert.doesNotMatch(source, /const cards = computed/)
  assert.doesNotMatch(source, /const nowLabel = computed/)

  assert.match(adminDisplayStateSource, /export const useAdminDisplayState/)
  assert.match(adminDisplayStateSource, /ADMIN_ROLE_OPTIONS/)
  assert.match(adminDisplayStateSource, /getAdminOverviewCards/)
  assert.match(adminDisplayStateSource, /getAdminUserStatusClass/)
})

test('admin page delegates the overview dashboard to a feature module', () => {
  assert.match(adminDashboardSectionsSource, /<AdminOverviewSection/)
  assert.match(adminDashboardSectionsSource, /ref="overviewRef"/)
  assert.match(adminDashboardSectionsSource, /v-bind="overviewSection"/)
  assert.match(source, /overviewSectionProps/)
  assert.match(adminDashboardSectionPropsSource, /topSpenders: unref\(topSpenders\)/)
  assert.match(source, /@refresh-overview="refreshDashboardOverview"/)
  assert.doesNotMatch(source, /管理员会话/)
  assert.doesNotMatch(source, /Top 消耗用户/)

  assert.ok(existsSync(adminOverviewSectionUrl))
  assert.ok(existsSync(adminOverviewMetricGridUrl))
  assert.match(adminOverviewSectionSource, /import AdminOverviewMetricGrid from '\.\/AdminOverviewMetricGrid\.vue'/)
  assert.match(adminOverviewSectionSource, /<AdminOverviewMetricGrid :cards="cards" \/>/)
  assert.match(adminOverviewSectionSource, /<AdminOverviewUsageTrendPanel/)
  assert.match(adminOverviewSectionSource, /<AdminOverviewSessionPanel/)
  assert.match(adminOverviewSectionSource, /<AdminOverviewInsightPanel/)
  assert.doesNotMatch(adminOverviewSectionSource, /v-for="card in cards"/)
  assert.doesNotMatch(adminOverviewSectionSource, /<AdminMetricCard/)
  assert.doesNotMatch(adminOverviewSectionSource, /<AdminGlassSurface/)
  assert.match(adminOverviewMetricGridSource, /<AdminGlassSurface\s+v-for="card in cards"/)
  assert.match(adminOverviewMetricGridSource, /<AdminMetricCard/)
  assert.match(adminOverviewMetricGridSource, /surface-class="rounded-2xl p-4"/)
  assert.match(adminOverviewMetricGridSource, /cards:\s*\{\s*type: Array,\s*default: \(\) => \[\]\s*\}/s)
  assert.match(adminUsersModuleSource, /管理员会话/)
  assert.match(adminUsersModuleSource, /重点观察/)
  assert.match(adminOverviewSectionSource, /\$emit\('refresh-overview'\)/)
})

test('admin overview info panels compose the shared panel card module', () => {
  assert.ok(existsSync(adminPanelCardUrl))
  assert.ok(existsSync(adminOverviewInsightPanelUrl))
  assert.ok(existsSync(adminOverviewSessionPanelUrl))
  assert.ok(existsSync(adminOverviewTopSpendersListUrl))
  assert.ok(existsSync(adminOverviewUsageTrendPanelUrl))
  assert.match(adminPanelCardSource, /admin-panel-card/)
  assert.match(adminPanelCardSource, /title/)
  assert.match(adminPanelCardSource, /caption/)
  assert.match(adminPanelCardSource, /meta/)
  assert.match(adminPanelCardSource, /<AdminGlassSurface/)

  assert.equal((adminOverviewSectionSource.match(/<AdminPanelCard/g) || []).length, 0)
  assert.match(adminOverviewMetricGridSource, /<AdminGlassSurface/)
  assert.doesNotMatch(adminOverviewSectionSource, /card-class="ui-glass-card/)
  assert.match(adminOverviewSectionSource, /:usage-series="usageSeries"/)
  assert.match(adminOverviewSectionSource, /:admin-account-label="adminAccountLabel"/)
  assert.match(adminOverviewSectionSource, /:top-spenders="topSpenders"/)
  assert.doesNotMatch(adminOverviewSectionSource, /title="用量趋势"/)
  assert.doesNotMatch(adminOverviewSectionSource, /title="管理员会话"/)
  assert.doesNotMatch(adminOverviewSectionSource, /title="重点观察"/)

  assert.match(adminOverviewUsageTrendPanelSource, /<AdminPanelCard/)
  assert.match(adminOverviewUsageTrendPanelSource, /title="用量趋势"/)
  assert.match(adminOverviewUsageTrendPanelSource, /caption="最近日级请求量视图"/)
  assert.match(adminOverviewUsageTrendPanelSource, /panel-class="admin-panel-card admin-overview-usage-panel rounded-2xl p-4 md:p-5"/)
  assert.match(adminOverviewUsageTrendPanelSource, /<AdminEmptyState/)
  assert.match(adminOverviewUsageTrendPanelSource, /import AdminPaginationBar from '@\/components\/admin\/AdminPaginationBar\.vue'/)
  assert.match(adminOverviewUsageTrendPanelSource, /const USAGE_TREND_PAGE_SIZE = 10/)
  assert.match(adminOverviewUsageTrendPanelSource, /const visibleUsageSeries = computed\(\(\) =>/)
  assert.match(adminOverviewUsageTrendPanelSource, /props\.usageSeries\.slice\(start, start \+ USAGE_TREND_PAGE_SIZE\)/)
  assert.match(adminOverviewUsageTrendPanelSource, /v-for="row in visibleUsageSeries"/)
  assert.match(adminOverviewUsageTrendPanelSource, /<AdminPaginationBar[\s\S]+:page="usageTrendPage"[\s\S]+:limit="USAGE_TREND_PAGE_SIZE"[\s\S]+:total="usageSeries\.length"[\s\S]+item-label="天"[\s\S]+@set-page="setUsageTrendPage"/)
  assert.match(adminOverviewUsageTrendPanelSource, /barWidth\(row\.total_calls\)/)
  assert.match(adminOverviewSessionPanelSource, /<AdminPanelCard/)
  assert.match(adminOverviewSessionPanelSource, /title="管理员会话"/)
  assert.match(adminOverviewSessionPanelSource, /formatRoleList\(roles\)/)
  assert.match(adminOverviewInsightPanelSource, /<AdminPanelCard/)
  assert.match(adminOverviewInsightPanelSource, /title="重点观察"/)
  assert.match(adminOverviewInsightPanelSource, /import AdminOverviewTopSpendersList from '\.\/AdminOverviewTopSpendersList\.vue'/)
  assert.match(adminOverviewInsightPanelSource, /<AdminOverviewTopSpendersList\s+:format-usd="formatUsd"\s+:top-spenders="topSpenders"\s*\/>/)
  assert.doesNotMatch(adminOverviewInsightPanelSource, /v-for="item in topSpenders"/)
  assert.doesNotMatch(adminOverviewInsightPanelSource, /formatUsd\(item\.officialUsage\?\.totalCostAmount, 2\)/)
  assert.doesNotMatch(adminOverviewInsightPanelSource, /\.insight-row/)

  assert.match(adminOverviewTopSpendersListSource, /Top 消耗用户/)
  assert.match(adminOverviewTopSpendersListSource, /暂无归因成本数据/)
  assert.match(adminOverviewTopSpendersListSource, /v-for="item in topSpenders"/)
  assert.doesNotMatch(adminOverviewTopSpendersListSource, /formatUsd\(item\.officialUsage\?\.totalCostAmount, 2\)/)
  assert.match(adminOverviewTopSpendersListSource, /formatUsageAmount\(item, 2\)/)
  assert.match(adminOverviewTopSpendersListSource, /item\?\.officialUsage\?\.currency \|\| 'PTC'/)
  assert.match(adminOverviewTopSpendersListSource, /\.insight-row/)
  assert.match(adminOverviewTopSpendersListSource, /formatUsd:\s*\{\s*type: Function,\s*default: \(\) => '0\.00'\s*\}/s)
  assert.match(adminOverviewTopSpendersListSource, /topSpenders:\s*\{\s*type: Array,\s*default: \(\) => \[\]\s*\}/s)
  assert.doesNotMatch(adminOverviewSectionSource, /<div class="ui-glass-card rounded-2xl p-4 md:p-5">/)
})

test('admin overview detail panels compose the shared info line module', () => {
  assert.ok(existsSync(adminInfoLineUrl))
  assert.match(adminInfoLineSource, /class="ui-info-line"/)
  assert.match(adminInfoLineSource, /valueClass/)
  assert.match(adminInfoLineSource, /<slot>/)
  assert.match(adminInfoLineSource, /\.ui-info-line\s*\{/)
  assert.match(adminInfoLineSource, /\.ui-info-line strong\s*\{/)
  assert.doesNotMatch(styleSource, /\.ui-info-line\s*\{/)
  assert.doesNotMatch(styleSource, /\.ui-info-line strong\s*\{/)

  assert.match(adminOverviewSessionPanelSource, /<AdminInfoLine/)
  assert.match(adminOverviewSessionPanelSource, /label="账号"/)
  assert.match(adminOverviewSessionPanelSource, /label="角色"/)
  assert.match(adminOverviewSessionPanelSource, /label="权限数"/)
  assert.match(adminOverviewSessionPanelSource, /label="状态"/)
  assert.doesNotMatch(adminOverviewSessionPanelSource, /class="ui-info-line"/)

  assert.match(adminOverviewInsightPanelSource, /<AdminInfoLine/)
  assert.match(adminOverviewInsightPanelSource, /label="未开通服务用户"/)
  assert.match(adminOverviewInsightPanelSource, /label="待对账用户"/)
  assert.match(adminOverviewInsightPanelSource, /label="已开通服务"/)
  assert.match(adminOverviewInsightPanelSource, /value-class="text-amber-100"/)
  assert.doesNotMatch(adminOverviewInsightPanelSource, /class="ui-info-line"/)
})

test('admin page delegates audit logs to a feature module', () => {
  assert.match(adminDashboardSectionsSource, /<AdminAuditLogSection/)
  assert.match(adminDashboardSectionsSource, /ref="auditRef"/)
  assert.match(adminDashboardSectionsSource, /:show="auditLogSection\.canReadAudit && activeRouteSection === 'audit'"/)
  assert.match(adminDashboardSectionsSource, /v-bind="auditLogContentProps"/)
  assert.match(source, /auditLogSectionProps/)
  assert.match(adminDashboardSectionPropsSource, /auditLogs: unref\(auditLogs\)/)
  assert.match(adminDashboardSectionsSource, /@load-logs="emit\('load-logs'\)"/)
  assert.match(adminDashboardSectionsSource, /@update-log-query="\(/)
  assert.doesNotMatch(source, /后台审计日志/)
  assert.doesNotMatch(source, /v-model\.number="logQuery\.page"/)

  assert.ok(existsSync(adminAuditLogSectionUrl))
  assert.ok(existsSync(adminAuditLogFiltersUrl))
  assert.ok(existsSync(adminAuditLogPaginationSummaryUrl))
  assert.ok(existsSync(adminAuditLogRowUrl))
  assert.ok(existsSync(adminPaginationBarUrl))
  assert.match(adminAuditLogSectionSource, /后台审计日志/)
  assert.match(adminAuditLogSectionSource, /后台关键操作审计轨迹/)
  assert.match(adminAuditLogSectionSource, /暂无审计日志/)
  assert.match(adminAuditLogSectionSource, /import AdminAuditLogFilters from '\.\/AdminAuditLogFilters\.vue'/)
  assert.match(adminAuditLogSectionSource, /import AdminAuditLogPaginationSummary from '\.\/AdminAuditLogPaginationSummary\.vue'/)
  assert.match(adminAuditLogSectionSource, /import AdminAuditLogRow from '\.\/AdminAuditLogRow\.vue'/)
  assert.match(adminAuditLogSectionSource, /<AdminSectionHeader[\s\S]+\/>/)
  assert.doesNotMatch(adminAuditLogSectionSource, /<template #actions>/)
  assert.match(adminAuditLogSectionSource, /<AdminAuditLogFilters\s+class="mb-4"\s+:loading-logs="loadingLogs"\s+:log-query="logQuery"\s+@load-logs="emit\('load-logs'\)"\s+@update-log-query="forwardLogQueryUpdate"\s+\/>/)
  assert.match(adminAuditLogSectionSource, /<AdminAuditLogRow\s+v-for="log in auditLogs"\s+:key="log\.id"\s+:format-date-time="formatDateTime"\s+:log="log"\s+:row-class="rowClass"\s+:to-pretty-json="toPrettyJson"\s+\/>/)
  assert.match(adminAuditLogSectionSource, /<AdminAuditLogPaginationSummary :loading="loadingLogs" :pagination="pagination" @set-page="setAuditLogPage" \/>/)
  assert.doesNotMatch(adminAuditLogSectionSource, /<tr v-for="log in auditLogs"/)
  assert.doesNotMatch(adminAuditLogSectionSource, /<AdminControlField/)
  assert.doesNotMatch(adminAuditLogSectionSource, /<AdminMicroButton/)
  assert.doesNotMatch(adminAuditLogSectionSource, /toNumberInput/)
  assert.doesNotMatch(adminAuditLogSectionSource, /toPrettyJson\(log\.metadata\)/)
  assert.doesNotMatch(adminAuditLogSectionSource, /第 \{\{ pagination\.page \}\} 页/)
  assert.match(adminAuditLogSectionSource, /const emit = defineEmits\(\['load-logs', 'update-log-query'\]\)/)
  assert.match(adminAuditLogSectionSource, /const forwardLogQueryUpdate = \(key, value\) =>/)
  assert.match(adminAuditLogSectionSource, /emit\('update-log-query', key, value\)/)
  assert.match(adminAuditLogSectionSource, /const setAuditLogPage = \(page\) => \{/)
  assert.match(adminAuditLogSectionSource, /emit\('update-log-query', 'page', page\)/)
  assert.match(adminAuditLogSectionSource, /emit\('load-logs'\)/)

  assert.match(adminAuditLogFiltersSource, /<AdminFilterToolbar class="admin-audit-log-filters" compact fit grid>/)
  assert.match(adminAuditLogFiltersSource, /import AdminFilterField from '@\/components\/admin\/AdminFilterField\.vue'/)
  assert.match(adminAuditLogFiltersSource, /import AdminFilterToolbar from '@\/components\/admin\/AdminFilterToolbar\.vue'/)
  assert.match(adminAuditLogFiltersSource, /import AdminControlField from '@\/components\/admin\/AdminControlField\.vue'/)
  assert.match(adminAuditLogFiltersSource, /import AdminMicroButton from '@\/components\/admin\/AdminMicroButton\.vue'/)
  assert.match(adminAuditLogFiltersSource, /<AdminFilterField label="页码"/)
  assert.match(adminAuditLogFiltersSource, /<AdminFilterField label="每页"/)
  assert.match(adminAuditLogFiltersSource, /<AdminControlField[\s\S]+:value="logQuery\.page"[\s\S]+type="number"[\s\S]+min="1"[\s\S]+variant="number"[\s\S]+@input="updateLogQuery\('page', \$event\)"/)
  assert.match(adminAuditLogFiltersSource, /<AdminControlField[\s\S]+:value="logQuery\.limit"[\s\S]+type="number"[\s\S]+max="20"[\s\S]+variant="number"[\s\S]+@input="updateLogQuery\('limit', \$event\)"/)
  assert.match(adminAuditLogFiltersSource, /<AdminMicroButton size="md" :disabled="loadingLogs" @click="emit\('load-logs'\)">查询<\/AdminMicroButton>/)
  assert.match(adminAuditLogFiltersSource, /emit\('update-log-query', key, clampPaginationValue\(key, event\.target\.value\)\)/)
  assert.match(adminAuditLogFiltersSource, /Math\.min\(20, parsed\)/)

  assert.match(adminAuditLogPaginationSummarySource, /import AdminPaginationBar from '@\/components\/admin\/AdminPaginationBar\.vue'/)
  assert.match(adminAuditLogPaginationSummarySource, /<AdminPaginationBar/)
  assert.match(adminAuditLogPaginationSummarySource, /:page="auditLogPage"/)
  assert.match(adminAuditLogPaginationSummarySource, /:limit="auditLogLimit"/)
  assert.match(adminAuditLogPaginationSummarySource, /:total="auditLogTotal"/)
  assert.match(adminAuditLogPaginationSummarySource, /@set-page="emit\('set-page', \$event\)"/)
  assert.match(adminAuditLogPaginationSummarySource, /default: \(\) => \(\{ page: 1, limit: 10, total: 0 \}\)/)

  assert.match(adminAuditLogRowSource, /<tr :class="rowClass">/)
  assert.match(adminAuditLogRowSource, /formatDateTime\(log\.createdAt\)/)
  assert.match(adminAuditLogRowSource, /\{\{ log\.action \}\}/)
  assert.match(adminAuditLogRowSource, /log\.operator\?\.email \|\| '-'/)
  assert.match(adminAuditLogRowSource, /log\.target\?\.email \|\| '-'/)
  assert.match(adminAuditLogRowSource, /toPrettyJson\(log\.metadata\)/)
})

test('admin empty states use the shared empty-state module styling', () => {
  assert.doesNotMatch(source, /\.empty-notice/)
  assert.doesNotMatch(adminUsersModuleSource, /\.empty-notice/)
  assert.doesNotMatch(adminUsersModuleSource, /empty-class="empty-notice"/)

  assert.ok(existsSync(adminEmptyStateUrl))
  assert.match(adminEmptyStateSource, /default: 'admin-empty-state'/)
  assert.match(adminEmptyStateSource, /\.admin-empty-state/)
  assert.match(adminOverviewTopSpendersListSource, /\.insight-row/)
})

test('admin issue detail renders event diagnostics metadata for provider failures', () => {
  assert.match(adminIssueInboxSectionSource, /getEventDiagnostics\(event\)/)
  assert.match(adminIssueInboxSectionSource, /toPrettyJson\(getEventDiagnostics\(event\)\)/)
  assert.match(adminIssueInboxSectionSource, /\.admin-issue-event-diagnostics/)
})

test('admin page delegates user service and reconciliation sections to feature modules', () => {
  assert.match(source, /@\/components\/admin\/features/)
  assert.match(adminDashboardSectionsSource, /<AdminUserServiceSection/)
  assert.match(adminDashboardSectionsSource, /<AdminServiceReconciliationSection/)
  assert.ok(existsSync(userServiceSectionUrl))
  assert.ok(existsSync(serviceReconciliationSectionUrl))

  assert.match(adminUsersModuleSource, /用户服务/)
  assert.match(adminUsersModuleSource, /服务开通率/)
  assert.match(adminUsersModuleSource, /状态筛选/)
  assert.match(adminUsersModuleSource, /消耗对账/)
  assert.match(adminUsersModuleSource, /账户余额/)
  assert.match(adminUsersModuleSource, /服务调用日志查询/)
})
