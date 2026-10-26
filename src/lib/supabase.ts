import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** .env 에 Supabase 값이 없으면 친구 기능만 꺼지고 나머지는 그대로 동작한다. */
export const configured = !!url && !!key

export const supabase = configured
  ? createClient(url!, key!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } })
  : null
