import { createAdminClient } from "@/lib/supabase/admin"
import type { AdvanceRecipient } from "./schema"
import type { SupabaseClient } from "@supabase/supabase-js"

// Validate an external recipient token and hand back a service-role client scoped
// by that recipient. Returns null when the token is missing/too short/unknown —
// callers turn that into a 401/404. This is the single authz gate for /api/advance/*.
export async function authRecipient(
  token: string | null | undefined
): Promise<{ admin: SupabaseClient; recipient: AdvanceRecipient } | null> {
  if (!token || token.length < 16) return null
  const admin = createAdminClient()
  const { data } = await admin.from("advance_recipients").select("*").eq("token", token).single()
  if (!data) return null
  return { admin, recipient: data as AdvanceRecipient }
}
