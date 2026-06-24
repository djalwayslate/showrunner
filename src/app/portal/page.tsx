import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export default async function PortalPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth")

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()
  const role = profile?.role

  if (role !== "artist" && role !== "sponsor") redirect("/dashboard")

  const { data: events } = await supabase.from("events").select("id, name, start_date, end_date, venue, poster_url").order("start_date", { ascending: false })
  const latestEvent = events?.[0]

  let lineupEntry = null
  let proposals: { id: string; title: string; body: string }[] = []

  if (latestEvent) {
    if (role === "artist") {
      const searchName = profile?.display_name ?? user.email
      if (searchName) {
        const { data } = await supabase
          .from("lineup_entries")
          .select("name, role, start_time, end_time, stage, day_date, fee, status")
          .eq("event_id", latestEvent.id)
          .ilike("name", `%${searchName}%`)
          .single()
        lineupEntry = data
      }
    }
    if (role === "sponsor") {
      const { data } = await supabase
        .from("proposals")
        .select("id, title, body")
        .eq("event_id", latestEvent.id)
        .order("created_at", { ascending: false })
      proposals = data ?? []
    }
  }

  async function signOutAction() {
    "use server"
    const sb = await createClient()
    await sb.auth.signOut()
    redirect("/auth")
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "var(--font-inter), sans-serif" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 22px 64px" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
          <div>
            <div style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 22, fontWeight: 600, color: "var(--text)" }}>Latino Kings</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.05em" }}>{role} portal</div>
          </div>
          <form action={signOutAction}>
            <button type="submit" style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text-2)", fontSize: 12.5, fontWeight: 600, borderRadius: 9, padding: "7px 13px", cursor: "pointer" }}>
              Sign out
            </button>
          </form>
        </header>

        {latestEvent && (
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px", marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Upcoming event</div>
            <div style={{ fontSize: 18, fontWeight: 600, fontFamily: "var(--font-fraunces), serif", color: "var(--text)" }}>{latestEvent.name}</div>
            {latestEvent.venue && <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 3 }}>{latestEvent.venue}</div>}
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 4 }}>
              {latestEvent.start_date}{latestEvent.end_date !== latestEvent.start_date ? ` – ${latestEvent.end_date}` : ""}
            </div>
          </div>
        )}

        {role === "artist" && (
          <section>
            <h2 style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 18, fontWeight: 600, color: "var(--text)", margin: "0 0 14px" }}>Your slot</h2>
            {lineupEntry ? (
              <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px" }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", marginBottom: 10 }}>{lineupEntry.name}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px", fontSize: 13 }}>
                  {lineupEntry.stage && <div><span style={{ color: "var(--muted)" }}>Stage: </span><span style={{ color: "var(--text)", fontWeight: 500 }}>{lineupEntry.stage}</span></div>}
                  {lineupEntry.day_date && <div><span style={{ color: "var(--muted)" }}>Date: </span><span style={{ color: "var(--text)", fontWeight: 500 }}>{lineupEntry.day_date}</span></div>}
                  {lineupEntry.start_time && <div><span style={{ color: "var(--muted)" }}>Start: </span><span style={{ color: "var(--text)", fontWeight: 500 }}>{lineupEntry.start_time}</span></div>}
                  {lineupEntry.end_time && <div><span style={{ color: "var(--muted)" }}>End: </span><span style={{ color: "var(--text)", fontWeight: 500 }}>{lineupEntry.end_time}</span></div>}
                  <div><span style={{ color: "var(--muted)" }}>Status: </span><span style={{ color: "var(--accent)", fontWeight: 600 }}>{lineupEntry.status}</span></div>
                </div>
              </div>
            ) : (
              <div style={{ background: "var(--card)", border: "1px dashed var(--border-strong)", borderRadius: 14, padding: "32px 18px", textAlign: "center", color: "var(--text-2)", fontSize: 13 }}>
                No slot confirmed yet — the team will update this shortly.
              </div>
            )}
          </section>
        )}

        {role === "sponsor" && (
          <section>
            <h2 style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 18, fontWeight: 600, color: "var(--text)", margin: "0 0 14px" }}>Your proposals</h2>
            {proposals.length === 0 ? (
              <div style={{ background: "var(--card)", border: "1px dashed var(--border-strong)", borderRadius: 14, padding: "32px 18px", textAlign: "center", color: "var(--text-2)", fontSize: 13 }}>
                No proposals yet — the team will share one soon.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {proposals.map((p) => (
                  <div key={p.id} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px" }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", marginBottom: 10 }}>{p.title}</div>
                    <div style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{p.body}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
