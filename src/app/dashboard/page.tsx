import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import Dashboard from "@/components/Dashboard"

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/auth")

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  if (!profile) redirect("/auth")
  if (profile.role === "artist" || profile.role === "sponsor") redirect("/portal")

  const { data: events } = await supabase
    .from("events")
    .select("*")
    .order("start_date", { ascending: true })

  const { data: org } = await supabase.from("org_settings").select("brand_name").eq("id", 1).single()

  return (
    <Dashboard
      profile={profile}
      events={events ?? []}
      userEmail={user.email ?? ""}
      brandName={org?.brand_name ?? "Latino Kings"}
    />
  )
}
