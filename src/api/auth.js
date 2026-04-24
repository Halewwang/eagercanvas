import { request } from '@/utils'

export const sendLoginCode = (email) =>
  request({
    url: '/auth/send-code',
    method: 'post',
    data: { email }
  })

export const verifyLoginCode = (email, code) =>
  request({
    url: '/auth/verify-code',
    method: 'post',
    data: { email, code },
    withCredentials: true
  })

export const sendRegisterCode = (email) =>
  request({
    url: '/auth/register/send-code',
    method: 'post',
    data: { email }
  })

export const verifyRegisterCode = (email, code, displayName) =>
  request({
    url: '/auth/register/verify-code',
    method: 'post',
    data: { email, code, displayName },
    withCredentials: true
  })

export const refreshSession = () =>
  request({
    url: '/auth/refresh',
    method: 'post',
    withCredentials: true
  })

export const logoutSession = () =>
  request({
    url: '/auth/logout',
    method: 'post',
    withCredentials: true
  })

export const getMe = () =>
  request({
    url: '/auth/me',
    method: 'get'
  })

export const patchProfile = (payload) =>
  request({
    url: '/auth/profile',
    method: 'patch',
    data: payload
  })
