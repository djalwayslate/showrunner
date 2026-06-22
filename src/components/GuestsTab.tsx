"use client"

import { useState, useEffect } from "react"
import { Plus, Trash2, Search, Check, Users, DoorOpen } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { Guest } from "@/lib/types"

const STATUSES = ["Pending", "Accepted", "Declined"] as const
const STATUS_STYLE: Record<string, React.CSSProperties> = {
  Pending: { color: "var(--gold)", background: "color-mix(in srgb, var(--gold) 14%, transparent)" },
  Accepted: { color: "var(--green)", background: "var(--green-tint)" },
  Declined: { color: "var(--red)", background: "var(--red-tint)" },
}

export default function GuestsTab({ eventId, refreshKey }: { eventId: string; refreshKey: number }) {
  const [guests, setGuests] = useState<Guest[]>([])
  const [ticketTypes, setTicketTypes] = useState<string[]>(["Free", "Paper", "Box", "Paid", "VIP"])
  const [q, setQ] = useState("")
  const [doorMode, setDoorMode] = useState(false)
  const [loading, setLoading] = useState(true)
  const db = createClient()

  async function load() {
    setLoading(true)
    const [{ data }, { data: org }] = await Promise.all([
      db.from("guests").select("*").eq("event_id", eventId).order("sort_order"),
      db.from("org_settings").select("ticket_types").eq("id", 1).single(),
    ])
    if (data) setGuests(data)
    if (Array.isArray(org?.ticket_types) && org!.ticket_types.length) setTicketTypes(org!.ticket_types)
    setLoading(false)
  }
  useEffect(() => { if (eventId) load() }, [eventId, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  async function add() {
    const { data } = await db.from("guests")
      .insert({ event_id: eventId, name: "New guest", added_by: "", status: "Accepted", ticket_type: "Paper", plus_ones: 0, attended: false, sort_order: guests.length })
      .select().single()
    if (data) setGuests((p) => [...p, data])
  }
  async function update(id: string, patch: Partial<Guest>) {
    setGuests((p) => p.map((g) => (g.id === id ? { ...g, ...patch } : g)))
    await db.from("guests").update(patch).eq("id", id)
  }
  async function remove(id: string) {
    setGuests((p) => p.filter((g) => g.id !== id))
    await db.from("guests").delete().eq("id", id)
  }

  const heads = (g: Guest) => 1 + (Number(g.plus_ones) || 0)
  const accepted = guests.filter((g) => g.status === "Accepted")
  const totalHeads = accepted.reduce((a, g) => a + heads(g), 0)
  const inHeads = guests.filter((g) => g.attended).reduce((a, g) => a + heads(g), 0)
  const pctIn = totalHeads > 0 ? Math.round((inHeads / totalHeads) * 100) : 0

  const filtered = q.trim()
    ? guests.filter((g) => `${g.name} ${g.added_by} ${g.notes}`.toLowerCase().includes(q.toLowerCase()))
    : guests

  if (loading) return <div style={s.skeleton} />

  return (
    <div>
      <div style={s.cards}>
        <Card label="On the list" value={String(guests.length)} sub={`${guests.reduce((a, g) => a + heads(g), 0)} heads`} />
        <Card label="Accepted heads" value={String(totalHeads)} />
        <Card label="Checked in" value={String(inHeads)} sub={`${pctIn}%`} />
        <Card label="Pending" value={String(guests.filter((g) => g.status === "Pending").length)} />
      </div>

      <div style={s.toolbar}>
        <div style={s.search}>
          <Search size={15} strokeWidth={2} style={{ color: "var(--muted)" }} />
          <input style={s.searchInput} placeholder="Search names…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button style={{ ...s.doorBtn, ...(doorMode ? s.doorOn : {}) }} onClick={() => setDoorMode((d) => !d)} type="button">
          <DoorOpen size={15} strokeWidth={2} /> Door mode
        </button>
      </div>

      {filtered.length === 0 ? (
        <div style={s.empty}>
          <Users size={20} strokeWidth={1.6} style={{ color: "var(--muted)" }} />
          <span>{q ? "No matches." : "No guests yet. Add the first, or drop a screenshot of your list into the Home chat."}</span>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: doorMode ? 6 : 8 }}>
          {filtered.map((g) => (
            <div key={g.id} style={{ ...s.row, ...(g.attended ? s.rowIn : {}) }}>
              <button
                style={{ ...s.check, ...(g.attended ? s.checkOn : {}) }}
                onClick={() => update(g.id, { attended: !g.attended })}
                title={g.attended ? "Checked in" : "Mark arrived"}
                type="button"
              >
                {g.attended && <Check size={15} strokeWidth={3} />}
              </button>

              <div style={{ flex: 1, minWidth: 0 }}>
                <input
                  style={s.name}
                  value={g.name}
                  onChange={(e) => setGuests((p) => p.map((x) => (x.id === g.id ? { ...x, name: e.target.value } : x)))}
                  onBlur={() => db.from("guests").update({ name: g.name }).eq("id", g.id)}
                />
                {!doorMode && (
                  <input
                    style={s.addedBy}
                    placeholder="added by…"
                    value={g.added_by}
                    onChange={(e) => setGuests((p) => p.map((x) => (x.id === g.id ? { ...x, added_by: e.target.value } : x)))}
                    onBlur={() => db.from("guests").update({ added_by: g.added_by }).eq("id", g.id)}
                  />
                )}
              </div>

              <div style={s.plus}>
                <button style={s.plusBtn} onClick={() => update(g.id, { plus_ones: Math.max(0, (g.plus_ones || 0) - 1) })} type="button">−</button>
                <span style={s.plusVal} className="tnum">+{g.plus_ones || 0}</span>
                <button style={s.plusBtn} onClick={() => update(g.id, { plus_ones: (g.plus_ones || 0) + 1 })} type="button">+</button>
              </div>

              {!doorMode && (
                <>
                  <select style={s.ticket} value={g.ticket_type} onChange={(e) => update(g.id, { ticket_type: e.target.value })}>
                    {[...new Set([...ticketTypes, g.ticket_type])].filter(Boolean).map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <select style={{ ...s.status, ...STATUS_STYLE[g.status] }} value={g.status} onChange={(e) => update(g.id, { status: e.target.value as Guest["status"] })}>
                    {STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
                  </select>
                  <button style={s.trash} onClick={() => remove(g.id)} type="button"><Trash2 size={14} strokeWidth={2} /></button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <button style={s.addBtn} onClick={add} type="button"><Plus size={16} strokeWidth={2.2} /> Add guest</button>
    </div>
  )
}

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={s.card}>
      <div style={s.cardLabel}>{label}</div>
      <div style={s.cardValue} className="tnum">{value}</div>
      {sub && <div style={s.cardSub}>{sub}</div>}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  skeleton: { height: 360, background: "var(--inset)", borderRadius: "var(--radius)" },
  cards: { display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 },
  card: { flex: 1, minWidth: 120, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px", boxShadow: "var(--shadow-sm)" },
  cardLabel: { fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 },
  cardValue: { fontSize: 20, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em", lineHeight: 1 },
  cardSub: { fontSize: 11, color: "var(--muted)", marginTop: 4 },
  toolbar: { display: "flex", gap: 10, marginBottom: 14 },
  search: { flex: 1, display: "flex", alignItems: "center", gap: 8, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "0 12px", boxShadow: "var(--shadow-sm)" },
  searchInput: { flex: 1, background: "transparent", border: "none", color: "var(--text)", fontSize: 13.5, padding: "10px 0", outline: "none" },
  doorBtn: { display: "flex", alignItems: "center", gap: 6, background: "var(--card)", border: "1px solid var(--border)", color: "var(--text-2)", fontSize: 13, fontWeight: 600, borderRadius: 10, padding: "9px 14px", cursor: "pointer", boxShadow: "var(--shadow-sm)" },
  doorOn: { background: "var(--accent)", color: "#fff", border: "1px solid transparent" },
  empty: { display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "40px 20px", textAlign: "center", background: "var(--card)", border: "1px dashed var(--border-strong)", borderRadius: "var(--radius)", color: "var(--text-2)", fontSize: 13 },
  row: { display: "flex", alignItems: "center", gap: 10, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 11, padding: "9px 12px", boxShadow: "var(--shadow-sm)" },
  rowIn: { background: "var(--green-tint)", borderColor: "transparent" },
  check: { width: 28, height: 28, borderRadius: "50%", border: "2px solid var(--border-strong)", background: "transparent", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  checkOn: { background: "var(--green)", border: "2px solid var(--green)" },
  name: { width: "100%", background: "transparent", border: "1px solid transparent", borderRadius: 7, color: "var(--text)", fontSize: 14, fontWeight: 600, padding: "3px 5px", margin: "-3px -5px", outline: "none" },
  addedBy: { width: "100%", background: "transparent", border: "none", color: "var(--muted)", fontSize: 11.5, padding: "2px 5px 0", outline: "none" },
  plus: { display: "flex", alignItems: "center", background: "var(--inset)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", flexShrink: 0 },
  plusBtn: { width: 26, height: 28, border: "none", background: "transparent", color: "var(--text-2)", fontSize: 15, cursor: "pointer" },
  plusVal: { minWidth: 26, textAlign: "center", fontSize: 12.5, fontWeight: 600, color: "var(--text)" },
  ticket: { background: "var(--inset)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-2)", fontSize: 12, fontWeight: 500, padding: "7px 7px", cursor: "pointer", outline: "none", flexShrink: 0 },
  status: { border: "1px solid transparent", borderRadius: 8, fontSize: 12, fontWeight: 600, padding: "7px 8px", cursor: "pointer", outline: "none", flexShrink: 0 },
  trash: { width: 30, height: 30, borderRadius: 8, background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  addBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%", background: "var(--card)", border: "1px dashed var(--border-strong)", color: "var(--text-2)", fontSize: 13.5, fontWeight: 600, borderRadius: "var(--radius)", padding: "13px", cursor: "pointer", marginTop: 12 },
}
