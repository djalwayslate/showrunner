"use client"

import { useState, useEffect } from "react"
import { Users, Shield } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { Profile } from "@/lib/types"

const ROLES: Profile["role"][] = ["admin", "core", "sponsor", "artist"]
const ROLE_DESC: Record<Profile["role"], string> = {
  admin: "Full access — everything incl. budget, team & settings",
  core: "Edit lineup, hosp, planner, marketing · read budget",
  sponsor: "Scoped read-only (their deliverables) — portal coming",
  artist: "Scoped read-only (their booking) — portal coming",
}

type Row = Profile & { email?: string | null }

export default function TeamTab({ currentUserId, isAdmin }: { currentUserId: string; isAdmin: boolean }) {
  const [people, setPeople] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const db = createClient()

  async function load() {
    setLoading(true)
    const { data } = await db.from("profiles").select("*")
    if (data) {
      const order = { admin: 0, core: 1, sponsor: 2, artist: 3 } as Record<string, number>
      setPeople([...data].sort((a, b) => (order[a.role] ?? 9) - (order[b.role] ?? 9)))
    }
    setLoading(false)
  }
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function setRole(id: string, role: Profile["role"]) {
    setPeople((p) => p.map((x) => (x.id === id ? { ...x, role } : x)))
    await db.from("profiles").update({ role }).eq("id", id)
  }

  if (loading) return <div style={s.skeleton} />

  return (
    <div>
      <div style={s.intro}>
        <div style={s.introIcon}><Users size={16} strokeWidth={2} /></div>
        <div>
          <div style={s.introTitle}>Team</div>
          <div style={s.introSub}>
            {isAdmin
              ? "Everyone with access, and what they can do. New people sign up at your app link and appear here as “core” — set their role below."
              : "The Latino Kings team. Only admins can change roles."}
          </div>
        </div>
      </div>

      <div style={s.list}>
        {people.map((p) => {
          const me = p.id === currentUserId
          return (
            <div key={p.id} style={s.row}>
              <div style={s.avatar}>{(p.email || p.display_name || "?").charAt(0).toUpperCase()}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={s.name}>{p.display_name || p.email?.split("@")[0] || "Member"}{me && <span style={s.you}>you</span>}</div>
                <div style={s.email}>{p.email}</div>
              </div>
              {isAdmin && !(me && p.role === "admin") ? (
                <select style={{ ...s.roleSelect, ...roleStyle(p.role) }} value={p.role} onChange={(e) => setRole(p.id, e.target.value as Profile["role"])}>
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              ) : (
                <span style={{ ...s.roleBadge, ...roleStyle(p.role) }}>{p.role}</span>
              )}
            </div>
          )
        })}
      </div>

      <div style={s.legend}>
        <div style={s.legendHead}><Shield size={13} strokeWidth={2} style={{ color: "var(--accent)" }} /> What each role can do</div>
        {ROLES.map((r) => (
          <div key={r} style={s.legendRow}>
            <span style={{ ...s.legendTag, ...roleStyle(r) }}>{r}</span>
            <span style={s.legendText}>{ROLE_DESC[r]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function roleStyle(role: string): React.CSSProperties {
  if (role === "admin") return { color: "var(--accent)", background: "var(--accent-tint)" }
  if (role === "core") return { color: "var(--green)", background: "var(--green-tint)" }
  return { color: "var(--text-2)", background: "var(--bg-2)" }
}

const s: Record<string, React.CSSProperties> = {
  skeleton: { height: 320, background: "var(--inset)", borderRadius: "var(--radius)" },
  intro: { display: "flex", gap: 12, background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "14px 16px", marginBottom: 18, boxShadow: "var(--shadow-sm)" },
  introIcon: { width: 34, height: 34, borderRadius: 9, flexShrink: 0, background: "var(--accent-tint)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" },
  introTitle: { fontFamily: "var(--font-fraunces), serif", fontSize: 15, fontWeight: 600, color: "var(--text)", marginBottom: 3 },
  introSub: { fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.5 },
  list: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 },
  row: { display: "flex", alignItems: "center", gap: 12, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "11px 14px", boxShadow: "var(--shadow-sm)" },
  avatar: { width: 36, height: 36, borderRadius: "50%", background: "var(--text)", color: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 600, flexShrink: 0 },
  name: { fontSize: 14, fontWeight: 600, color: "var(--text)", display: "flex", alignItems: "center", gap: 7 },
  you: { fontSize: 10, fontWeight: 600, color: "var(--muted)", background: "var(--bg-2)", borderRadius: 5, padding: "1px 6px", textTransform: "uppercase", letterSpacing: "0.04em" },
  email: { fontSize: 12, color: "var(--muted)" },
  roleSelect: { border: "1px solid transparent", borderRadius: 8, fontSize: 12.5, fontWeight: 600, padding: "7px 10px", cursor: "pointer", outline: "none", textTransform: "capitalize" },
  roleBadge: { fontSize: 12, fontWeight: 600, borderRadius: 7, padding: "6px 11px", textTransform: "capitalize" },
  legend: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "14px 16px", boxShadow: "var(--shadow-sm)" },
  legendHead: { display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 12 },
  legendRow: { display: "flex", alignItems: "center", gap: 11, padding: "6px 0" },
  legendTag: { fontSize: 11, fontWeight: 700, borderRadius: 6, padding: "2px 9px", textTransform: "capitalize", minWidth: 58, textAlign: "center" },
  legendText: { fontSize: 12.5, color: "var(--text-2)" },
}
