import { createClient } from '@supabase/supabase-js'
import { env } from './env.js'
import { createTimeoutFetch } from '../utils/timeout-fetch.js'

export const supabase = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
  global: {
    fetch: createTimeoutFetch(undefined, env.supabaseTimeoutMs, 'Supabase')
  },
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
})
