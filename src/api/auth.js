import { apiRequest } from './_httpClient.js'

export const sendLoginCode = (email) =>
  apiRequest({
    url: '/auth/send-code',
    method: 'post',
    data: { email }
  })

export const verifyLoginCode = (email, code) =>
  apiRequest({
    url: '/auth/verify-code',
    method: 'post',
    data: { email, code },
    withCredentials: true
  })

export const sendRegisterCode = (email) =>
  apiRequest({
    url: '/auth/register/send-code',
    method: 'post',
    data: { email }
  })

export const verifyRegisterCode = (email, code, displayName) =>
  apiRequest({
    url: '/auth/register/verify-code',
    method: 'post',
    data: { email, code, displayName },
    withCredentials: true
  })

export const refreshSession = () =>
  apiRequest({
    url: '/auth/refresh',
    method: 'post',
    withCredentials: true
  })

export const logoutSession = () =>
  apiRequest({
    url: '/auth/logout',
    method: 'post',
    withCredentials: true
  })

export const getMe = () =>
  apiRequest({
    url: '/auth/me',
    method: 'get'
  })

export const patchProfile = (payload) =>
  apiRequest({
    url: '/auth/profile',
    method: 'patch',
    data: payload
  })
