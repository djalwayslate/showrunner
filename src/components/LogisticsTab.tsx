"use client"

import { useState, useEffect } from "react"
import { Plus, Trash2, Check, Phone, Mail, Users, Boxes } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { CrewContact, InventoryItem } from "@/lib/types"

export default function LogisticsTab({ eventId, refreshKey }: { eventId: string; refreshKey: number }) {
  const [view, setView] = useState<"crew" | "gear">("crew")
  const [crew, setCrew] = useState<CrewContact[]>([])
  const [gear, setGear] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const db = createClient()

  async function load() {
    setLoading(true)
    const [{ data: c }, { data: g }] = await Promise.all([
      db.from("crew_contacts").select("*").eq("event_id", eventId).order("sort_order"),
      db.from("inventory_items").select("*").eq("event_id", eventId).order("sort_order"),
    ])
    if (c) setCrew(c)
    if (g) setGear(g)
    setLoading(false)
  }
  useEffect(() => { if (eventId) load() }, [eventId, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // crew ops
  async function addCrew() {
    const { data } = await db.from("crew_contacts").insert({ event_id: eventId, name: "", role: "", phone: "", email: "", sort_order: crew.length }).select().single()
    if (data) setCrew((p) => [...p, data])
  }
  async function updCrew(id: string, patch: Partial<CrewContact>) {
    setCrew((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)))
    await db.from("crew_contacts").update(patch).eq("id", id)
  }
  async function rmCrew(id: string) { setCrew((p) => p.filter((x) => x.id !== id)); await db.from("crew_contacts").delete().eq("id", id) }

  // gear ops
  async function addGear() {
    const { data } = await db.from("inventory_items").insert({ event_id: eventId, item: "", qty: "", source: "", got: false, sort_order: gear.length }).select().single()
    if (data) setGear((p) => [...p, data])
  }
  async function updGear(id: string, patch: Partial<InventoryItem>) {
    setGear((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)))
    await db.from("inventory_items").update(patch).eq("id", id)
  }
  async function rmGear(id: string) { setGear((p) => p.filter((x) => x.id !== id)); await db.from("inventory_items").delete().eq("id", id) }

  const gotCount = gear.filter((g) => g.got).length

  if (loading) return <div style={s.skeleton} />

  return (
    <div>
      <div style={s.seg}>
        <button style={{ ...s.segBtn, ...(view === "crew" ? s.segOn : {}) }} onClick={() => setView("crew")} type="button">
          <Users size={14} strokeWidth={2} /> Crew {crew.length > 0 && <span style={s.segCount}>{crew.length}</span>}
        </button>
        <button style={{ ...s.segBtn, ...(view === "gear" ? s.segOn : {}) }} onClick={() => setView("gear")} type="button">
          <Boxes size={14} strokeWidth={2} /> Gear {gear.length > 0 && <span style={s.segCount}>{gotCount}/{gear.length}</span>}
        </button>
      </div>

      {view === "crew" ? (
        <>
          {crew.length === 0 ? (
            <div style={s.empty}><Users size={20} strokeWidth={1.6} style={{ color: "var(--muted)" }} /><span>No crew yet. Add your team & their contacts.</span></div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {crew.map((c) => (
                <div key={c.id} style={s.card}>
                  <div style={s.crewTop}>
                    <input style={s.crewName} placeholder="Name" value={c.name} onChange={(e) => setCrew((p) => p.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)))} onBlur={() => db.from("crew_contacts").update({ name: c.name }).eq("id", c.id)} />
                    <input style={s.crewRole} placeholder="Role" value={c.role} onChange={(e) => setCrew((p) => p.map((x) => (x.id === c.id ? { ...x, role: e.target.value } : x)))} onBlur={() => db.from("crew_contacts").update({ role: c.role }).eq("id", c.id)} />
                    <button style={s.trash} onClick={() => rmCrew(c.id)} type="button"><Trash2 size={14} strokeWidth={2} /></button>
                  </div>
                  <div style={s.crewContacts}>
                    <div style={s.contactField}>
                      <Phone size={13} strokeWidth={2} style={{ color: "var(--muted)" }} />
                      <input style={s.contactInput} placeholder="Phone" value={c.phone} onChange={(e) => setCrew((p) => p.map((x) => (x.id === c.id ? { ...x, phone: e.target.value } : x)))} onBlur={() => db.from("crew_contacts").update({ phone: c.phone }).eq("id", c.id)} />
                      {c.phone && <a href={`tel:${c.phone.replace(/\s/g, "")}`} style={s.callBtn}>Call</a>}
                    </div>
                    <div style={s.contactField}>
                      <Mail size={13} strokeWidth={2} style={{ color: "var(--muted)" }} />
                      <input style={s.contactInput} placeholder="Email" value={c.email} onChange={(e) => setCrew((p) => p.map((x) => (x.id === c.id ? { ...x, email: e.target.value } : x)))} onBlur={() => db.from("crew_contacts").update({ email: c.email }).eq("id", c.id)} />
                      {c.email && <a href={`mailto:${c.email}`} style={s.callBtn}>Mail</a>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button style={s.addBtn} onClick={addCrew} type="button"><Plus size={16} strokeWidth={2.2} /> Add crew member</button>
        </>
      ) : (
        <>
          {gear.length === 0 ? (
            <div style={s.empty}><Boxes size={20} strokeWidth={1.6} style={{ color: "var(--muted)" }} /><span>No gear yet. List what you need and where to get it.</span></div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {gear.map((g) => (
                <div key={g.id} style={{ ...s.card, ...(g.got ? s.gotRow : {}) }}>
                  <div style={s.gearRow}>
                    <button style={{ ...s.check, ...(g.got ? s.checkOn : {}) }} onClick={() => updGear(g.id, { got: !g.got })} title={g.got ? "Got it" : "Mark acquired"} type="button">
                      {g.got && <Check size={13} strokeWidth={3} />}
                    </button>
                    <input style={{ ...s.gearItem, ...(g.got ? { textDecoration: "line-through", color: "var(--muted)" } : {}) }} placeholder="Item" value={g.item} onChange={(e) => setGear((p) => p.map((x) => (x.id === g.id ? { ...x, item: e.target.value } : x)))} onBlur={() => db.from("inventory_items").update({ item: g.item }).eq("id", g.id)} />
                    <input style={s.gearQty} placeholder="qty" value={g.qty} onChange={(e) => setGear((p) => p.map((x) => (x.id === g.id ? { ...x, qty: e.target.value } : x)))} onBlur={() => db.from("inventory_items").update({ qty: g.qty }).eq("id", g.id)} />
                    <input style={s.gearSource} placeholder="where to get" value={g.source} onChange={(e) => setGear((p) => p.map((x) => (x.id === g.id ? { ...x, source: e.target.value } : x)))} onBlur={() => db.from("inventory_items").update({ source: g.source }).eq("id", g.id)} />
                    <button style={s.trash} onClick={() => rmGear(g.id)} type="button"><Trash2 size={14} strokeWidth={2} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button style={s.addBtn} onClick={addGear} type="button"><Plus size={16} strokeWidth={2.2} /> Add item</button>
        </>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  skeleton: { height: 360, background: "var(--inset)", borderRadius: "var(--radius)" },
  seg: { display: "flex", gap: 3, padding: 4, background: "var(--bg-2)", borderRadius: 11, marginBottom: 16, width: "fit-content" },
  segBtn: { display: "flex", alignItems: "center", gap: 7, background: "transparent", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, color: "var(--text-2)", cursor: "pointer" },
  segOn: { background: "var(--card)", color: "var(--text)", boxShadow: "var(--shadow-sm)" },
  segCount: { fontSize: 11, fontWeight: 600, color: "var(--muted)", background: "var(--bg-2)", borderRadius: 5, padding: "1px 6px" },
  empty: { display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "40px 20px", textAlign: "center", background: "var(--card)", border: "1px dashed var(--border-strong)", borderRadius: "var(--radius)", color: "var(--text-2)", fontSize: 13 },
  card: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "11px 13px", boxShadow: "var(--shadow-sm)" },
  gotRow: { background: "var(--green-tint)", borderColor: "transparent" },
  crewTop: { display: "flex", alignItems: "center", gap: 9, marginBottom: 9 },
  crewName: { flex: 1, minWidth: 0, background: "transparent", border: "1px solid transparent", borderRadius: 7, color: "var(--text)", fontSize: 14, fontWeight: 600, padding: "5px 7px", margin: "-5px -7px", outline: "none" },
  crewRole: { width: 150, background: "var(--inset)", border: "1px solid var(--border)", borderRadius: 7, color: "var(--text-2)", fontSize: 12.5, padding: "6px 9px", outline: "none" },
  crewContacts: { display: "flex", gap: 10, flexWrap: "wrap" },
  contactField: { flex: 1, minWidth: 200, display: "flex", alignItems: "center", gap: 7, background: "var(--inset)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px" },
  contactInput: { flex: 1, minWidth: 0, background: "transparent", border: "none", color: "var(--text)", fontSize: 13, outline: "none" },
  callBtn: { fontSize: 11.5, fontWeight: 600, color: "var(--accent)", background: "var(--accent-tint)", borderRadius: 6, padding: "3px 9px", textDecoration: "none", flexShrink: 0 },
  gearRow: { display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" },
  check: { width: 24, height: 24, borderRadius: 6, border: "2px solid var(--border-strong)", background: "transparent", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  checkOn: { background: "var(--green)", border: "2px solid var(--green)" },
  gearItem: { flex: "1 1 140px", minWidth: 110, background: "transparent", border: "1px solid transparent", borderRadius: 7, color: "var(--text)", fontSize: 14, fontWeight: 600, padding: "5px 7px", margin: "0 -7px", outline: "none" },
  gearQty: { width: 60, background: "var(--inset)", border: "1px solid var(--border)", borderRadius: 7, color: "var(--text-2)", fontSize: 12.5, padding: "6px 8px", outline: "none", textAlign: "center" },
  gearSource: { flex: "1 1 130px", minWidth: 110, background: "var(--inset)", border: "1px solid var(--border)", borderRadius: 7, color: "var(--text-2)", fontSize: 12.5, padding: "6px 9px", outline: "none" },
  trash: { width: 30, height: 30, borderRadius: 8, background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  addBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%", background: "var(--card)", border: "1px dashed var(--border-strong)", color: "var(--text-2)", fontSize: 13.5, fontWeight: 600, borderRadius: "var(--radius)", padding: "13px", cursor: "pointer", marginTop: 12 },
}
