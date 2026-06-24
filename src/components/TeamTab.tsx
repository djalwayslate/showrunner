"use client"

import { useState, useEffect } from "react"
import { Shield, Plus, X, Mail, Phone, AtSign, Pencil, Trash2, Sparkles, LayoutGrid, GitBranch } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { Profile } from "@/lib/types"

type TeamMember = {
  id: string
  name: string
  positions: string[]
  department: string | null
  context: string | null
  email: string | null
  phone: string | null
  instagram: string | null
  avatar_color: string
  sort_order: number
}

const AVATAR_COLORS = ["#C5613D", "#2D7DD2", "#3CAA6F", "#8B5CF6", "#E85D75", "#F59E0B", "#0F7270", "#6B7280"]
const DEPARTMENTS = ["Leadership", "Operations", "Creative", "Marketing", "Technical", "Finance", "General"]
const ROLES: Profile["role"][] = ["admin", "core", "sponsor", "artist"]
const ROLE_DESC: Record<Profile["role"], string> = {
  admin: "Full access — everything incl. budget, team & settings",
  core: "Edit lineup, hosp, planner, marketing · read budget",
  sponsor: "Scoped read-only (their deliverables) — portal coming",
  artist: "Scoped read-only (their booking) — portal coming",
}

type ProfileRow = Profile & { email?: string | null }

export default function TeamTab({ currentUserId, isAdmin }: { currentUserId: string; isAdmin: boolean }) {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [people, setPeople] = useState<ProfileRow[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<TeamMember | null>(null)
  const [view, setView] = useState<"grid" | "org">("grid")
  const db = createClient()

  async function load() {
    setLoading(true)
    const [{ data: m }, { data: p }] = await Promise.all([
      db.from("team_members").select("*").order("sort_order"),
      db.from("profiles").select("*"),
    ])
    if (m) setMembers(m as TeamMember[])
    if (p) {
      const order = { admin: 0, core: 1, sponsor: 2, artist: 3 } as Record<string, number>
      setPeople([...p].sort((a, b) => (order[a.role] ?? 9) - (order[b.role] ?? 9)))
    }
    setLoading(false)
  }
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function saveMember(m: TeamMember) {
    if (m.id === "__new__") {
      const { id: _id, ...rest } = m
      const { data } = await db.from("team_members").insert(rest).select().single()
      if (data) setMembers((prev) => [...prev, data as TeamMember])
    } else {
      await db.from("team_members").update(m).eq("id", m.id)
      setMembers((prev) => prev.map((x) => (x.id === m.id ? m : x)))
    }
    setModal(null)
  }

  async function deleteMember(id: string) {
    await db.from("team_members").delete().eq("id", id)
    setMembers((prev) => prev.filter((x) => x.id !== id))
    setModal(null)
  }

  async function setRole(id: string, role: Profile["role"]) {
    setPeople((p) => p.map((x) => (x.id === id ? { ...x, role } : x)))
    await db.from("profiles").update({ role }).eq("id", id)
  }

  if (loading) return <div style={s.skeleton} />

  const newBlank: TeamMember = {
    id: "__new__", name: "", positions: [], department: null, context: null,
    email: "", phone: "", instagram: "", avatar_color: AVATAR_COLORS[0], sort_order: members.length,
  }

  // Group by department for org chart
  const byDept: Record<string, TeamMember[]> = {}
  DEPARTMENTS.forEach((d) => { byDept[d] = [] })
  members.forEach((m) => {
    const dept = m.department || "General"
    if (!byDept[dept]) byDept[dept] = []
    byDept[dept].push(m)
  })
  const activeDepts = DEPARTMENTS.filter((d) => byDept[d]?.length > 0)

  return (
    <div>
      <div style={s.sectionHead}>
        <div>
          <div style={s.sectionTitle}>Team Roster</div>
          <div style={s.sectionSub}>Add anyone on the team — no login required.</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={s.viewToggle}>
            <button style={{ ...s.viewBtn, ...(view === "grid" ? s.viewBtnActive : {}) }} onClick={() => setView("grid")} type="button" title="Grid view">
              <LayoutGrid size={13} strokeWidth={2} />
            </button>
            <button style={{ ...s.viewBtn, ...(view === "org" ? s.viewBtnActive : {}) }} onClick={() => setView("org")} type="button" title="Org chart">
              <GitBranch size={13} strokeWidth={2} />
            </button>
          </div>
          {isAdmin && (
            <button style={s.addBtn} onClick={() => setModal(newBlank)} type="button">
              <Plus size={14} strokeWidth={2.4} /> Add member
            </button>
          )}
        </div>
      </div>

      {members.length === 0 ? (
        <div style={s.empty}>No team members yet.{isAdmin ? " Add your first one above." : ""}</div>
      ) : view === "grid" ? (
        <div style={s.grid}>
          {members.map((m) => (
            <MemberCard key={m.id} m={m} isAdmin={isAdmin} onEdit={() => setModal(m)} />
          ))}
        </div>
      ) : (
        <div style={s.orgWrap}>
          {activeDepts.length === 0 ? (
            <div style={s.empty}>Assign departments to members to see the org chart.</div>
          ) : (
            activeDepts.map((dept) => (
              <div key={dept} style={s.deptSection}>
                <div style={s.deptHeader}>
                  <span style={s.deptLabel}>{dept}</span>
                  <span style={s.deptCount}>{byDept[dept].length}</span>
                </div>
                <div style={s.deptCards}>
                  {byDept[dept].map((m) => (
                    <MemberCard key={m.id} m={m} isAdmin={isAdmin} onEdit={() => setModal(m)} compact />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* App Access */}
      <div style={{ ...s.sectionHead, marginTop: 28 }}>
        <div>
          <div style={s.sectionTitle}>App Access</div>
          <div style={s.sectionSub}>People with accounts. Assign roles to control what they can see.</div>
        </div>
      </div>

      <div style={s.list}>
        {people.map((p) => {
          const me = p.id === currentUserId
          return (
            <div key={p.id} style={s.row}>
              <div style={s.rowAvatar}>{(p.display_name || p.email || "?").charAt(0).toUpperCase()}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={s.rowName}>
                  {p.display_name || p.email?.split("@")[0] || "Member"}
                  {me && <span style={s.you}>you</span>}
                </div>
                <div style={s.rowEmail}>{p.email}</div>
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
        <div style={s.legendHead}><Shield size={13} strokeWidth={2} style={{ color: "var(--accent)" }} /> Role permissions</div>
        {ROLES.map((r) => (
          <div key={r} style={s.legendRow}>
            <span style={{ ...s.legendTag, ...roleStyle(r) }}>{r}</span>
            <span style={s.legendText}>{ROLE_DESC[r]}</span>
          </div>
        ))}
      </div>

      {modal && (
        <MemberModal
          member={modal}
          isNew={modal.id === "__new__"}
          allMembers={members}
          onSave={saveMember}
          onDelete={modal.id !== "__new__" ? () => deleteMember(modal.id) : undefined}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

function MemberCard({ m, isAdmin, onEdit, compact }: {
  m: TeamMember; isAdmin: boolean; onEdit: () => void; compact?: boolean
}) {
  const positions = m.positions || []
  return (
    <div style={compact ? s.compactCard : s.card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: compact ? 8 : 12 }}>
        <div style={{
          ...s.bigAvatar,
          background: m.avatar_color,
          width: compact ? 36 : 44, height: compact ? 36 : 44,
          fontSize: compact ? 15 : 18, borderRadius: compact ? 10 : 13,
        }}>
          {m.name.charAt(0).toUpperCase() || "?"}
        </div>
        {isAdmin && (
          <button style={s.editBtn} onClick={onEdit} type="button">
            <Pencil size={13} strokeWidth={2} />
          </button>
        )}
      </div>
      <div style={{ ...s.cardName, fontSize: compact ? 13 : 14 }}>{m.name}</div>
      {positions.length > 0 && (
        <div style={s.posChips}>
          {positions.map((p) => <span key={p} style={s.posChip}>{p}</span>)}
        </div>
      )}
      {!compact && (
        <div style={s.contactList}>
          {m.email && (
            <a href={`mailto:${m.email}`} style={s.contactRow}>
              <Mail size={11} strokeWidth={2} style={{ flexShrink: 0 }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.email}</span>
            </a>
          )}
          {m.phone && (
            <a href={`tel:${m.phone}`} style={s.contactRow}>
              <Phone size={11} strokeWidth={2} style={{ flexShrink: 0 }} />
              {m.phone}
            </a>
          )}
          {m.instagram && (
            <a href={`https://instagram.com/${m.instagram.replace("@", "")}`} target="_blank" rel="noreferrer" style={s.contactRow}>
              <AtSign size={11} strokeWidth={2} style={{ flexShrink: 0 }} />
              {m.instagram.startsWith("@") ? m.instagram : `@${m.instagram}`}
            </a>
          )}
        </div>
      )}
    </div>
  )
}

function MemberModal({ member, isNew, allMembers, onSave, onDelete, onClose }: {
  member: TeamMember
  isNew: boolean
  allMembers: TeamMember[]
  onSave: (m: TeamMember) => void
  onDelete?: () => void
  onClose: () => void
}) {
  const [form, setForm] = useState<TeamMember>({ ...member, positions: member.positions || [] })
  const [posInput, setPosInput] = useState("")
  const [suggesting, setSuggesting] = useState(false)
  const [suggestionNote, setSuggestionNote] = useState<string | null>(null)

  const setF = <K extends keyof TeamMember>(k: K, v: TeamMember[K]) => setForm((f) => ({ ...f, [k]: v }))

  function addPosition(raw: string) {
    const trimmed = raw.trim()
    if (!trimmed || form.positions.includes(trimmed)) { setPosInput(""); return }
    setF("positions", [...form.positions, trimmed])
    setPosInput("")
  }

  function removePosition(p: string) {
    setF("positions", form.positions.filter((x) => x !== p))
  }

  async function suggest() {
    if (!form.context?.trim() && !form.name?.trim()) return
    setSuggesting(true)
    setSuggestionNote(null)
    try {
      const res = await fetch("/api/team-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          context: form.context,
          existingMembers: allMembers.map((m) => ({ name: m.name, positions: m.positions || [], department: m.department })),
        }),
      })
      const data = await res.json()
      if (data.positions?.length) {
        setF("positions", [...new Set([...form.positions, ...data.positions])])
      }
      if (data.department && !form.department) setF("department", data.department)
      if (data.reason) setSuggestionNote(data.reason)
    } finally {
      setSuggesting(false)
    }
  }

  return (
    <div style={s.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div style={s.modalBox}>
        <div style={s.modalHead}>
          <span style={s.modalTitle}>{isNew ? "Add team member" : "Edit member"}</span>
          <button style={s.modalClose} onClick={onClose} type="button"><X size={16} strokeWidth={2.2} /></button>
        </div>

        <div style={s.colorRow}>
          {AVATAR_COLORS.map((c) => (
            <button key={c} style={{ ...s.colorSwatch, background: c, outline: form.avatar_color === c ? `2px solid ${c}` : "2px solid transparent", outlineOffset: 2 }}
              onClick={() => setF("avatar_color", c)} type="button" />
          ))}
          <div style={{ ...s.bigAvatar, background: form.avatar_color, marginLeft: "auto", fontSize: 20 }}>
            {form.name.charAt(0).toUpperCase() || "?"}
          </div>
        </div>

        <div style={s.fieldGrid}>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={s.label}>Name *</label>
            <input style={s.input} value={form.name} onChange={(e) => setF("name", e.target.value)} placeholder="Full name" />
          </div>

          <div style={{ gridColumn: "1/-1" }}>
            <label style={s.label}>Positions / Roles</label>
            <div style={s.chipsWrap}>
              {form.positions.map((p) => (
                <span key={p} style={s.posChipEdit}>
                  {p}
                  <button style={s.chipX} onClick={() => removePosition(p)} type="button"><X size={10} strokeWidth={3} /></button>
                </span>
              ))}
              <input
                style={s.chipInput}
                value={posInput}
                onChange={(e) => setPosInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addPosition(posInput) }
                  if (e.key === "Backspace" && !posInput && form.positions.length) {
                    removePosition(form.positions[form.positions.length - 1])
                  }
                }}
                placeholder={form.positions.length === 0 ? "Type a role, press Enter…" : "Add another…"}
              />
            </div>
          </div>

          <div style={{ gridColumn: "1/-1" }}>
            <label style={s.label}>Department</label>
            <div style={s.deptChips}>
              {DEPARTMENTS.map((d) => (
                <button key={d}
                  style={{ ...s.deptChipBtn, ...(form.department === d ? s.deptChipActive : {}) }}
                  onClick={() => setF("department", form.department === d ? null : d)}
                  type="button">
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={s.label}>Email</label>
            <input style={s.input} value={form.email ?? ""} onChange={(e) => setF("email", e.target.value)} placeholder="email@…" type="email" />
          </div>
          <div>
            <label style={s.label}>Phone</label>
            <input style={s.input} value={form.phone ?? ""} onChange={(e) => setF("phone", e.target.value)} placeholder="+370…" type="tel" />
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={s.label}>Instagram</label>
            <input style={s.input} value={form.instagram ?? ""} onChange={(e) => setF("instagram", e.target.value)} placeholder="@handle" />
          </div>

          <div style={{ gridColumn: "1/-1" }}>
            <label style={s.label}>
              Describe this person
              <span style={{ fontWeight: 400, color: "var(--muted)", marginLeft: 5 }}>— AI suggests roles & department</span>
            </label>
            <div style={{ position: "relative" }}>
              <textarea
                style={{ ...s.input, height: 62, resize: "none", paddingRight: 100, fontFamily: "inherit" } as React.CSSProperties}
                value={form.context ?? ""}
                onChange={(e) => setF("context", e.target.value)}
                placeholder="e.g. loves social media, helps at events, new to the team…"
              />
              <button
                style={{ ...s.aiBtn, opacity: suggesting || (!form.context?.trim() && !form.name?.trim()) ? 0.5 : 1 }}
                onClick={suggest}
                disabled={suggesting || (!form.context?.trim() && !form.name?.trim())}
                type="button"
              >
                <Sparkles size={11} strokeWidth={2.2} />
                {suggesting ? "…" : "AI Suggest"}
              </button>
            </div>
            {suggestionNote && <div style={s.suggestionNote}>{suggestionNote}</div>}
          </div>
        </div>

        <div style={s.modalFoot}>
          {onDelete && (
            <button style={s.deleteBtn} onClick={onDelete} type="button">
              <Trash2 size={14} strokeWidth={2} /> Remove
            </button>
          )}
          <button style={s.cancelBtn} onClick={onClose} type="button">Cancel</button>
          <button style={s.saveBtn} disabled={!form.name.trim()} onClick={() => onSave(form)} type="button">
            {isNew ? "Add" : "Save"}
          </button>
        </div>
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
  sectionHead: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { fontFamily: "var(--font-fraunces), serif", fontSize: 15, fontWeight: 600, color: "var(--text)", marginBottom: 2 },
  sectionSub: { fontSize: 12, color: "var(--text-2)" },
  addBtn: { display: "flex", alignItems: "center", gap: 6, background: "var(--accent)", color: "#fff", border: "none", borderRadius: 9, padding: "8px 13px", fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0 },
  viewToggle: { display: "flex", border: "1px solid var(--border)", borderRadius: 9, overflow: "hidden" },
  viewBtn: { display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer" },
  viewBtnActive: { background: "var(--inset)", color: "var(--text)" },
  empty: { background: "var(--card)", border: "1px dashed var(--border-strong)", borderRadius: "var(--radius)", padding: "28px 18px", textAlign: "center", fontSize: 13, color: "var(--text-2)", marginBottom: 4 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(185px, 1fr))", gap: 10, marginBottom: 4 },
  card: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: "14px 14px 12px", boxShadow: "var(--shadow-sm)" },
  compactCard: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "11px 12px 10px", boxShadow: "var(--shadow-sm)", minWidth: 130 },
  bigAvatar: { width: 44, height: 44, borderRadius: 13, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: "#fff", fontFamily: "var(--font-fraunces), serif", flexShrink: 0 },
  editBtn: { width: 28, height: 28, borderRadius: 7, background: "var(--inset)", border: "1px solid var(--border)", color: "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  cardName: { fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 4 },
  posChips: { display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 },
  posChip: { fontSize: 10.5, fontWeight: 600, color: "var(--accent)", background: "var(--accent-tint)", borderRadius: 5, padding: "2px 7px" },
  contactList: { display: "flex", flexDirection: "column", gap: 4, marginTop: 4 },
  contactRow: { display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--text-2)", textDecoration: "none", overflow: "hidden" },
  orgWrap: { display: "flex", flexDirection: "column", gap: 12, marginBottom: 4 },
  deptSection: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" },
  deptHeader: { display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", borderBottom: "1px solid var(--border)", background: "var(--inset)" },
  deptLabel: { fontFamily: "var(--font-fraunces), serif", fontSize: 13, fontWeight: 700, color: "var(--text)", flex: 1 },
  deptCount: { fontSize: 11, fontWeight: 700, color: "var(--muted)", background: "var(--bg-2)", borderRadius: 20, padding: "1px 7px", border: "1px solid var(--border)" },
  deptCards: { display: "flex", flexWrap: "wrap", gap: 10, padding: 12 },
  list: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 },
  row: { display: "flex", alignItems: "center", gap: 12, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "11px 14px", boxShadow: "var(--shadow-sm)" },
  rowAvatar: { width: 36, height: 36, borderRadius: "50%", background: "var(--text)", color: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 600, flexShrink: 0 },
  rowName: { fontSize: 14, fontWeight: 600, color: "var(--text)", display: "flex", alignItems: "center", gap: 7 },
  you: { fontSize: 10, fontWeight: 600, color: "var(--muted)", background: "var(--bg-2)", borderRadius: 5, padding: "1px 6px", textTransform: "uppercase", letterSpacing: "0.04em" },
  rowEmail: { fontSize: 12, color: "var(--muted)" },
  roleSelect: { border: "1px solid transparent", borderRadius: 8, fontSize: 12.5, fontWeight: 600, padding: "7px 10px", cursor: "pointer", outline: "none", textTransform: "capitalize" },
  roleBadge: { fontSize: 12, fontWeight: 600, borderRadius: 7, padding: "6px 11px", textTransform: "capitalize" },
  legend: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "14px 16px", boxShadow: "var(--shadow-sm)" },
  legendHead: { display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 12 },
  legendRow: { display: "flex", alignItems: "center", gap: 11, padding: "6px 0" },
  legendTag: { fontSize: 11, fontWeight: 700, borderRadius: 6, padding: "2px 9px", textTransform: "capitalize", minWidth: 58, textAlign: "center" },
  legendText: { fontSize: 12.5, color: "var(--text-2)" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 },
  modalBox: { background: "var(--card)", borderRadius: 18, padding: "22px 22px 18px", width: "100%", maxWidth: 440, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column", gap: 16 },
  modalHead: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  modalTitle: { fontFamily: "var(--font-fraunces), serif", fontSize: 17, fontWeight: 600, color: "var(--text)" },
  modalClose: { width: 30, height: 30, borderRadius: 8, background: "var(--inset)", border: "none", color: "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  colorRow: { display: "flex", alignItems: "center", gap: 7 },
  colorSwatch: { width: 26, height: 26, borderRadius: 7, border: "none", cursor: "pointer", flexShrink: 0 },
  fieldGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 12px" },
  label: { display: "block", fontSize: 11.5, fontWeight: 600, color: "var(--text-2)", marginBottom: 5 },
  input: { width: "100%", background: "var(--inset)", border: "1px solid var(--border)", borderRadius: 9, padding: "9px 11px", fontSize: 13.5, color: "var(--text)", outline: "none", boxSizing: "border-box" },
  chipsWrap: { display: "flex", flexWrap: "wrap", gap: 6, background: "var(--inset)", border: "1px solid var(--border)", borderRadius: 9, padding: "7px 10px", minHeight: 42, alignItems: "center" },
  posChipEdit: { display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: "var(--accent)", background: "var(--accent-tint)", borderRadius: 6, padding: "3px 8px" },
  chipX: { display: "flex", alignItems: "center", background: "transparent", border: "none", cursor: "pointer", color: "var(--accent)", padding: 0, lineHeight: 1 },
  chipInput: { border: "none", background: "transparent", outline: "none", fontSize: 13, color: "var(--text)", flex: 1, minWidth: 80 },
  deptChips: { display: "flex", flexWrap: "wrap", gap: 6 },
  deptChipBtn: { fontSize: 12, fontWeight: 600, color: "var(--text-2)", background: "var(--inset)", border: "1px solid var(--border)", borderRadius: 7, padding: "5px 10px", cursor: "pointer" },
  deptChipActive: { color: "#fff", background: "var(--text)", border: "1px solid var(--text)" },
  aiBtn: { position: "absolute", right: 8, bottom: 8, display: "flex", alignItems: "center", gap: 5, background: "var(--text)", color: "var(--bg)", border: "none", borderRadius: 7, padding: "5px 10px", fontSize: 11.5, fontWeight: 600, cursor: "pointer" },
  suggestionNote: { fontSize: 11.5, color: "var(--accent)", marginTop: 6, fontStyle: "italic" },
  modalFoot: { display: "flex", alignItems: "center", gap: 8, paddingTop: 4 },
  deleteBtn: { display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "1px solid var(--border)", color: "var(--muted)", fontSize: 12.5, fontWeight: 600, borderRadius: 9, padding: "8px 12px", cursor: "pointer", marginRight: "auto" },
  cancelBtn: { background: "var(--inset)", border: "1px solid var(--border)", color: "var(--text-2)", fontSize: 13, fontWeight: 600, borderRadius: 9, padding: "9px 16px", cursor: "pointer" },
  saveBtn: { background: "var(--accent)", border: "none", color: "#fff", fontSize: 13, fontWeight: 600, borderRadius: 9, padding: "9px 18px", cursor: "pointer" },
}
