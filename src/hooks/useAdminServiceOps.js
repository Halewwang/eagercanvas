import { computed, reactive, ref } from 'vue'
import {
  createAdmin302ApiKey,
  deleteAdmin302ApiKey,
  getAdmin302ApiKeys,
  getAdmin302ApiRecord,
  getAdmin302Balance,
  getAdmin302Record,
  updateAdmin302ApiKey
} from '@/api/admin'
import { getErrorMessage } from '@/utils'
import { notifier } from '@/utils/notifier'
import {
  buildAdminServiceKeyDraft,
  createAdminServiceLogQuery,
  createAdminServiceKeyForm,
  getAdminServiceNoticeMessage,
  prefixAdminServiceNotice,
  resetAdminServiceKeyForm,
  toAdminServiceUnixSeconds,
  updateAdminLog302Query
} from './useAdminServiceOpsCore.js'

const DEFAULT_API_LOG_PAGE_SIZE = 10

export const useAdminServiceOps = ({
  canReadUsage,
  canManageApiKeys,
  canAssignApiKeys,
  fetchApiKeys = getAdmin302ApiKeys,
  fetchApiRecord = getAdmin302ApiRecord,
  fetchBalance = getAdmin302Balance,
  fetchRecord = getAdmin302Record,
  createApiKeyRequest = createAdmin302ApiKey,
  deleteApiKeyRequest = deleteAdmin302ApiKey,
  updateApiKeyRequest = updateAdmin302ApiKey,
  loadUsers,
  loadLogs
}) => {
  const balance = ref('')
  const loadingBalance = ref(false)
  const recordRequestId = ref('')
  const recordData = ref(null)
  const loadingRecord = ref(false)
  const log302Query = reactive(createAdminServiceLogQuery({ pageSize: DEFAULT_API_LOG_PAGE_SIZE }))
  const apiLogs = ref([])
  const apiLogPagination = ref({ page: 1, limit: DEFAULT_API_LOG_PAGE_SIZE, total: 0 })
  const loadingApiLogs = ref(false)
  const serviceLoadNotice = ref('')
  const apiKeys = ref([])
  const keyDrafts = ref({})
  const loadingKeys = ref(false)
  const creatingApiKey = ref(false)
  const updatingKeys = ref({})
  const deletingKeys = ref({})
  const createKeyForm = reactive(createAdminServiceKeyForm())

  const loading302 = computed(
    () => loadingBalance.value || loadingRecord.value || loadingApiLogs.value || loadingKeys.value
  )
  const balanceDisplay = computed(() => (balance.value ? `$${balance.value}` : '--'))
  const apiKeyOptions = computed(() => apiKeys.value.map((item) => item.api_name).filter(Boolean))

  const maskApiKey = (value) => {
    const key = String(value || '')
    if (key.length <= 10) return key || '-'
    return `${key.slice(0, 6)}...${key.slice(-4)}`
  }

  const load302Balance = async ({ silent = false } = {}) => {
    if (!canReadUsage.value) return
    loadingBalance.value = true
    try {
      const rsp = await fetchBalance()
      balance.value = String(rsp?.data?.balance ?? '')
      return { ok: true }
    } catch (error) {
      balance.value = ''
      const message = getAdminServiceNoticeMessage('加载 Eager 服务余额失败', error, getErrorMessage)
      if (!silent && !error?.__handled) notifier.error(message)
      return { ok: false, message: prefixAdminServiceNotice('账户余额', message), error }
    } finally {
      loadingBalance.value = false
    }
  }

  const queryRecord = async () => {
    if (!canReadUsage.value) return
    const id = String(recordRequestId.value || '').trim()
    if (!id) return notifier.warning('请输入请求 ID')
    loadingRecord.value = true
    try {
      const rsp = await fetchRecord(id)
      recordData.value = rsp?.data || null
    } catch (error) {
      if (!error?.__handled) notifier.error(getErrorMessage(error, '查询消耗记录失败'))
    } finally {
      loadingRecord.value = false
    }
  }

  const loadApiLogs = async ({ silent = false } = {}) => {
    if (!canReadUsage.value) return
    const apiName = String(log302Query.apiName || '').trim()
    if (!apiName) {
      apiLogs.value = []
      apiLogPagination.value = { page: log302Query.page, limit: log302Query.limit, total: 0 }
      if (!silent) notifier.warning('请先输入 API 名称')
      return { ok: true, skipped: true }
    }
    loadingApiLogs.value = true
    try {
      const rsp = await fetchApiRecord({
        api_name: apiName,
        page: log302Query.page,
        limit: log302Query.limit,
        start_time: toAdminServiceUnixSeconds(log302Query.start),
        end_time: toAdminServiceUnixSeconds(log302Query.end)
      })
      apiLogs.value = Array.isArray(rsp?.data?.items) ? rsp.data.items : []
      apiLogPagination.value = rsp?.data?.pagination || {
        page: log302Query.page,
        limit: log302Query.limit,
        total: apiLogs.value.length
      }
      return { ok: true }
    } catch (error) {
      apiLogs.value = []
      apiLogPagination.value = { page: log302Query.page, limit: log302Query.limit, total: 0 }
      const message = getAdminServiceNoticeMessage('加载服务调用日志失败', error, getErrorMessage)
      if (!silent && !error?.__handled) notifier.error(message)
      return { ok: false, message: prefixAdminServiceNotice('服务调用日志', message), error }
    } finally {
      loadingApiLogs.value = false
    }
  }

  const updateLog302Query = (key, value) => updateAdminLog302Query(log302Query, key, value)

  const loadApiKeys = async ({ silent = false } = {}) => {
    if (!canManageApiKeys.value && !canAssignApiKeys.value) return
    loadingKeys.value = true
    try {
      const rsp = await fetchApiKeys()
      const list = Array.isArray(rsp?.data) ? rsp.data : []
      apiKeys.value = list
      if (!String(log302Query.apiName || '').trim()) {
        log302Query.apiName = String(list.find((item) => item?.api_name)?.api_name || '')
      }
      const drafts = {}
      for (const item of list) drafts[item.api_name] = buildAdminServiceKeyDraft(item)
      keyDrafts.value = drafts
      return { ok: true }
    } catch (error) {
      apiKeys.value = []
      keyDrafts.value = {}
      const message = getAdminServiceNoticeMessage('加载服务凭证失败', error, getErrorMessage)
      if (!silent && !error?.__handled) notifier.error(message)
      return { ok: false, message: prefixAdminServiceNotice('服务凭证', message), error }
    } finally {
      loadingKeys.value = false
    }
  }

  const createApiKey = async () => {
    if (!canManageApiKeys.value) return
    if (!String(createKeyForm.api_name || '').trim()) {
      return notifier.warning('必须填写 api_name')
    }
    creatingApiKey.value = true
    try {
      await createApiKeyRequest({ ...createKeyForm, api_name: createKeyForm.api_name.trim() })
      notifier.success('服务凭证创建成功')
      resetAdminServiceKeyForm(createKeyForm)
      await loadApiKeys()
    } catch (error) {
      if (!error?.__handled) notifier.error(getErrorMessage(error, '创建服务凭证失败'))
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
      await updateApiKeyRequest(name, { ...draft, api_name: name })
      notifier.success('服务凭证更新成功')
      await loadApiKeys()
    } catch (error) {
      if (!error?.__handled) notifier.error(getErrorMessage(error, '更新服务凭证失败'))
    } finally {
      updatingKeys.value = { ...updatingKeys.value, [name]: false }
    }
  }

  const removeApiKey = async (item) => {
    if (!canManageApiKeys.value) return
    const name = item.api_name
    const ok = window.confirm(`确认删除服务凭证 ${name} 吗？`)
    if (!ok) return
    deletingKeys.value = { ...deletingKeys.value, [name]: true }
    try {
      await deleteApiKeyRequest(name)
      notifier.success('服务凭证删除成功')
      await Promise.all([loadApiKeys(), loadUsers(), loadLogs()])
    } catch (error) {
      if (!error?.__handled) notifier.error(getErrorMessage(error, '删除服务凭证失败'))
    } finally {
      deletingKeys.value = { ...deletingKeys.value, [name]: false }
    }
  }

  const load302All = async () => {
    serviceLoadNotice.value = ''
    const tasks = []
    if (canReadUsage.value) {
      tasks.push(load302Balance({ silent: true }))
    }
    if (canManageApiKeys.value || canAssignApiKeys.value) {
      tasks.push(loadApiKeys({ silent: true }))
    }
    const results = await Promise.all(tasks)
    if (canReadUsage.value && String(log302Query.apiName || '').trim()) {
      results.push(await loadApiLogs({ silent: true }))
    }
    const failures = results.filter((item) => item && item.ok === false)
    if (failures.length > 0) {
      serviceLoadNotice.value = failures[0].message || '服务数据加载失败'
    }
  }

  return {
    apiKeyOptions,
    apiKeys,
    apiLogPagination,
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
    maskApiKey,
    queryRecord,
    recordData,
    recordRequestId,
    removeApiKey,
    serviceLoadNotice,
    updateLog302Query,
    updateApiKey,
    updatingKeys,
    log302Query
  }
}

export default useAdminServiceOps
