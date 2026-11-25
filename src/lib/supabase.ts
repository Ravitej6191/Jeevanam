import { createClient } from '@supabase/supabase-js'
import { env } from '@/config/env'
import type { Database } from '@/types/database.types'

if (!env.supabaseUrl || !env.supabaseAnonKey) {
  throw new Error('Missing Supabase settings — copy .env.example to .env and set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
}

export const supabase = createClient<Database>(
  env.supabaseUrl,
  env.supabaseAnonKey,
)
