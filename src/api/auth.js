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
