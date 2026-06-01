import request, { getBaseUrl, setBaseUrl } from '@/utils/request.js'
import { fetchWithAuth } from '@/utils/authFetch.js'

export const apiRequest = request
export const getApiBaseUrl = getBaseUrl
export const setApiBaseUrl = setBaseUrl
export const fetchWithApiAuth = fetchWithAuth
