export const createAdminServiceCredentialForm = () => ({
  api_name: '',
  allow_save_logs: false,
  allow_custom_model: false,
  allow_manage_key: false,
  limit_cost: 0,
  limit_daily_cost: 0,
  expired_on: 0
})

export const buildAdminServiceCredentialDraft = (item = {}) => ({
  api_name: item.api_name,
  allow_save_logs: !!item.allow_save_logs,
  allow_custom_model: !!item.allow_custom_model,
  allow_manage_key: !!item.allow_manage_key,
  limit_cost: Number(item.limit_cost || 0),
  limit_daily_cost: Number(item.limit_daily_cost || 0),
  expired_on: Number(item.expired_on || 0)
})

export const resetAdminServiceCredentialForm = (form) => {
  Object.assign(form, createAdminServiceCredentialForm())
}
