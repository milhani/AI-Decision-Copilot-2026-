import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let admin: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'Задайте SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY в server/.env (Settings → API → service_role)',
    )
  }

  if (!admin) {
    admin = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      db: { schema: 'public' },
      global: {
        headers: { 'x-client-info': 'smm-copilot-server' },
      },
    })
  }

  return admin
}
