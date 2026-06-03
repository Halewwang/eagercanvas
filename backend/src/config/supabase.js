import { createClient } from '@supabase/supabase-js'
import { env } from './env.js'
import { createTimeoutFetch } from '../utils/timeout-fetch.js'

const createServiceRoleClient = (timeoutMs, label) => createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
  global: {
    fetch: createTimeoutFetch(undefined, timeoutMs, label)
  },
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
})

export const supabase = createServiceRoleClient(env.supabaseTimeoutMs, 'Supabase')
export const supabaseStorage = createServiceRoleClient(env.supabaseStorageTimeoutMs, 'Supabase Storage')
