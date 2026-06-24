import { createClient } from "@supabase/supabase-js"

// Service-role Supabase client — bypasses RLS. SERVER-ONLY.
// Used exclusively by the public /api/advance/* routes, which authorize the
// caller by validating the recipient token BEFORE touching the database. Never
// import this into a client component; the key must never reach the browser.
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set")
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
