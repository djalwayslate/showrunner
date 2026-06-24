"use client"

import { useState, useEffect } from "react"
import { Wine, UtensilsCrossed, Users, Plus, Trash2, Bed, Send, ChevronRight } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { HospPerson, HospSettings, TabKey } from "@/lib/types"
import RiderRollup from "./RiderRollup"

const DAYS = [
  { d: 13, label: "Mon" },
  { d: 14, label: "Tue" },
  { d: 15, label: "Wed" },
  { d: 16, label: "Thu" },
  { d: 17, label: "Fri" },
  { d: 18, label: "Sat" },
  { d: 19, label: "Sun" },
]
const ROOM_TYPES = ["Single", "Double", "Room"] as const
const ROLE_TAGS = ["", "Org", "Crew", "Headliner"] as const

export default function HospTab({ eventId, refreshKey, onGoTo }: { eventId: string; refreshKey: number; onGoTo?: (tab: TabKey) => void }) {
  const [settings, setSettings] = useState<HospSettings | null>(null)
  const [people, setPeople] = useState<HospPerson[]>([])
  const [loading, setLoading] = useState(true)
  const db = createClient()

  async function load() {
    setLoading(true)
    const [{ data: st }, { data: rawPeople }, { data: days }] = await Promise.all([
      db.from("hosp_settings").select("*").eq("event_id", eventId).single(),
      db.from("hosp_people").select("*").eq("event_id", eventId).order("sort_order"),
      db.from("hosp_person_days").select("person_id, day"),
    ])
    if (st) setSettings(st)
    if (rawPeople && days) {
      const dayMap: Record<string, number[]> = {}
      days.forEach((r) => {
        if (!dayMap[r.person_id]) dayMap[r.person_id] = []
        dayMap[r.person_id].push(r.day)
      })
      setPeople(rawPeople.map((p) => ({ ...p, days: (dayMap[p.id] ?? []).sort((a, b) => a - b) })))
    }
    setLoading(false)
  }

  useEffect(() => {
    if (eventId) load()
  }, [eventId, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  async function updateSettings(patch: Partial<HospSettings>) {
    if (!settings) return
    setSettings({ ...settings, ...patch })
    await db.from("hosp_settings").update(patch).eq("id", settings.id)
  }

  async function addPerson() {
    const { data } = await db
      .from("hosp_people")
      .insert({ event_id: eventId, name: "New guest", count: 1, room: "Single", role: "", sort_order: people.length })
      .select()
      .single()
    if (data) setPeople((prev) => [...prev, { ...data, days: [] }])
  }

  async function updatePerson(id: string, patch: Partial<HospPerson>) {
    setPeople((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))
    const { days: _d, ...dbPatch } = patch as HospPerson
    if (Object.keys(dbPatch).length) await db.from("hosp_people").update(dbPatch).eq("id", id)
  }

  async function toggleDay(personId: string, day: number) {
    const person = people.find((p) => p.id === personId)
    if (!person) return
    const has = person.days.includes(day)
    const next = has ? person.days.filter((d) => d !== day) : [...person.days, day].sort((a, b) => a - b)
    setPeople((prev) => prev.map((p) => (p.id === personId ? { ...p, days: next } : p)))
    if (has) await db.from("hosp_person_days").delete().eq("person_id", personId).eq("day", day)
    else await db.from("hosp_person_days").insert({ person_id: personId, day })
  }

  async function removePerson(id: string) {
    setPeople((prev) => prev.filter((p) => p.id !== id))
    await db.from("hosp_people").delete().eq("id", id)
  }

  const stats: Record<number, number> = {}
  DAYS.forEach(({ d }) => (stats[d] = 0))
  people.forEach((p) => p.days.forEach((d) => (stats[d] = (stats[d] || 0) + (Number(p.count) || 1))))
  const totalHeadcountDays = Object.values(stats).reduce((a, b) => a + b, 0)
  const drinks = Number(settings?.drinks_per_person || 0)
  const food = Number(settings?.food_per_person || 0)
  const peakDay = DAYS.reduce((mx, day) => (stats[day.d] > stats[mx.d] ? day : mx), DAYS[0])

  if (loading) return <Skeleton />

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {onGoTo && (
        <button type="button" onClick={() => onGoTo("advance")} style={s.advanceLink}>
          <Send size={15} strokeWidth={2} style={{ color: "var(--accent)", flexShrink: 0 }} />
          <span style={{ flex: 1, textAlign: "left" }}>
            <span style={s.advanceTitle}>Advance the artists &amp; venue</span>
            <span style={s.advanceSub}>External fill-in links for contacts, transfers, hotel &amp; tech.</span>
          </span>
          <ChevronRight size={16} strokeWidth={2} style={{ color: "var(--accent)" }} />
        </button>
      )}
      <RiderRollup eventId={eventId} refreshKey={refreshKey} />
      {/* Day overview */}
      <section style={s.board}>
        {DAYS.map(({ d, label }) => {
          const pax = stats[d]
          const isPeak = pax > 0 && d === peakDay.d
          return (
            <div key={d} style={{ ...s.day, ...(isPeak ? s.dayPeak : {}) }}>
              <div style={s.dayHead}>
                <span style={s.dayLabel}>{label}</span>
                <span style={s.dayDate}>{String(d).padStart(2, "0")}.07</span>
              </div>
              <div style={s.payRow}>
                <span style={{ ...s.pax, color: pax > 0 ? "var(--text)" : "var(--muted)" }} className="tnum">{pax}</span>
                <span style={s.paxUnit}>guests</span>
              </div>
              <div style={s.daySub}>
                <span className="tnum"><Wine size={11} strokeWidth={2} /> {pax * drinks}</span>
                <span className="tnum"><UtensilsCrossed size={11} strokeWidth={2} /> {pax * food}</span>
              </div>
            </div>
          )
        })}
        <div style={s.totalCard}>
          <Users size={15} strokeWidth={2} style={{ color: "var(--accent)" }} />
          <span style={s.totalNum} className="tnum">{totalHeadcountDays}</span>
          <span style={s.totalLabel}>total<br />guest-days</span>
        </div>
      </section>

      {/* Settings */}
      {settings && (
        <section style={s.settings}>
          <div style={s.setting}>
            <Wine size={15} strokeWidth={2} style={{ color: "var(--accent)" }} />
            <div style={{ flex: 1 }}>
              <div style={s.settingLabel}>Drink tickets</div>
              <div style={s.settingHint}>per guest / day</div>
            </div>
            <Stepper value={drinks} onChange={(v) => updateSettings({ drinks_per_person: v })} />
          </div>
          <div style={s.settingDivider} />
          <div style={s.setting}>
            <UtensilsCrossed size={15} strokeWidth={2} style={{ color: "var(--accent)" }} />
            <div style={{ flex: 1 }}>
              <div style={s.settingLabel}>Food coupons</div>
              <div style={s.settingHint}>per guest / day</div>
            </div>
            <Stepper value={food} onChange={(v) => updateSettings({ food_per_person: v })} />
          </div>
        </section>
      )}

      {/* Roster */}
      <section>
        <div style={s.sectionHead}>
          <h2 style={s.sectionTitle}>Roster</h2>
          <span style={s.sectionCount}>{people.length} {people.length === 1 ? "person" : "people"}</span>
        </div>

        {people.length === 0 ? (
          <div style={s.emptyRoster}>
            <Bed size={20} strokeWidth={1.6} style={{ color: "var(--muted)" }} />
            <span>No one on the roster yet. Add the first guest.</span>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {people.map((p) => (
              <div key={p.id} style={s.card}>
                <div style={s.cardTop}>
                  <input
                    style={s.nameInput}
                    value={p.name}
                    onChange={(e) => updatePerson(p.id, { name: e.target.value })}
                    onBlur={() => db.from("hosp_people").update({ name: p.name }).eq("id", p.id)}
                  />
                  <div style={s.cardControls}>
                    <Stepper value={Number(p.count)} min={1} onChange={(v) => updatePerson(p.id, { count: v })} compact />
                    <select style={s.select} value={p.room} onChange={(e) => updatePerson(p.id, { room: e.target.value as HospPerson["room"] })}>
                      {ROOM_TYPES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <select
                      style={{ ...s.select, ...(p.role ? s.selectRole : {}) }}
                      value={p.role}
                      onChange={(e) => updatePerson(p.id, { role: e.target.value as HospPerson["role"] })}
                    >
                      {ROLE_TAGS.map((r) => <option key={r} value={r}>{r || "Guest"}</option>)}
                    </select>
                    <button style={s.trashBtn} onClick={() => removePerson(p.id)} title="Remove" type="button">
                      <Trash2 size={15} strokeWidth={2} />
                    </button>
                  </div>
                </div>
                <div style={s.dayToggles}>
                  {DAYS.map(({ d, label }) => {
                    const on = p.days.includes(d)
                    return (
                      <button
                        key={d}
                        style={{ ...s.toggle, ...(on ? s.toggleOn : {}) }}
                        onClick={() => toggleDay(p.id, d)}
                        type="button"
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <button style={s.addBtn} onClick={addPerson} type="button">
          <Plus size={16} strokeWidth={2.2} />
          Add guest
        </button>
      </section>
    </div>
  )
}

function Stepper({
  value, onChange, min = 0, compact = false,
}: { value: number; onChange: (v: number) => void; min?: number; compact?: boolean }) {
  return (
    <div style={{ ...st.wrap, ...(compact ? st.wrapCompact : {}) }}>
      <button type="button" style={st.btn} onClick={() => onChange(Math.max(min, value - 1))}>−</button>
      <span style={st.val} className="tnum">{value}</span>
      <button type="button" style={st.btn} onClick={() => onChange(value + 1)}>+</button>
    </div>
  )
}

function Skeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ ...s.board }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} style={{ ...s.day, height: 96, background: "var(--inset)", border: "1px solid var(--border)" }} />
        ))}
      </div>
      <div style={{ height: 120, background: "var(--inset)", borderRadius: "var(--radius)" }} />
    </div>
  )
}

const st: Record<string, React.CSSProperties> = {
  wrap: {
    display: "inline-flex",
    alignItems: "center",
    background: "var(--inset)",
    border: "1px solid var(--border)",
    borderRadius: 9,
    overflow: "hidden",
  },
  wrapCompact: { transform: "none" },
  btn: {
    width: 28,
    height: 30,
    border: "none",
    background: "transparent",
    color: "var(--text-2)",
    fontSize: 16,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  val: {
    minWidth: 24,
    textAlign: "center",
    fontSize: 13.5,
    fontWeight: 600,
    color: "var(--text)",
  },
}

const s: Record<string, React.CSSProperties> = {
  advanceLink: {
    display: "flex", alignItems: "center", gap: 11, width: "100%",
    background: "var(--accent-tint)", border: "1px solid transparent", borderRadius: 13,
    padding: "12px 14px", cursor: "pointer",
  },
  advanceTitle: { display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--text)" },
  advanceSub: { display: "block", fontSize: 11.5, color: "var(--text-2)", marginTop: 1 },
  board: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 9,
  },
  day: {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: 13,
    padding: "12px 13px",
    boxShadow: "var(--shadow-sm)",
  },
  dayPeak: {
    borderColor: "color-mix(in srgb, var(--accent) 40%, transparent)",
    background: "linear-gradient(180deg, var(--accent-tint), var(--card) 60%)",
  },
  dayHead: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 },
  dayLabel: { fontSize: 12.5, fontWeight: 600, color: "var(--text-2)" },
  dayDate: { fontSize: 10.5, color: "var(--muted)" },
  payRow: { display: "flex", alignItems: "baseline", gap: 5, marginBottom: 8 },
  pax: { fontSize: 26, fontWeight: 600, lineHeight: 1, letterSpacing: "-0.02em" },
  paxUnit: { fontSize: 10.5, color: "var(--muted)" },
  daySub: {
    display: "flex",
    gap: 12,
    fontSize: 11.5,
    color: "var(--text-2)",
  },
  totalCard: {
    background: "var(--text)",
    borderRadius: 13,
    padding: "12px 13px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: 2,
  },
  totalNum: { fontSize: 26, fontWeight: 600, color: "var(--bg)", lineHeight: 1, letterSpacing: "-0.02em" },
  totalLabel: { fontSize: 10, color: "color-mix(in srgb, var(--bg) 65%, transparent)", lineHeight: 1.3, textTransform: "uppercase", letterSpacing: "0.04em" },

  settings: {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: "6px 16px",
    boxShadow: "var(--shadow-sm)",
  },
  setting: { display: "flex", alignItems: "center", gap: 12, padding: "12px 0" },
  settingDivider: { height: 1, background: "var(--border)" },
  settingLabel: { fontSize: 13.5, fontWeight: 600, color: "var(--text)" },
  settingHint: { fontSize: 11.5, color: "var(--muted)" },

  sectionHead: { display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { fontFamily: "var(--font-fraunces), serif", fontSize: 18, fontWeight: 600, color: "var(--text)", margin: 0 },
  sectionCount: { fontSize: 12.5, color: "var(--muted)", fontWeight: 500 },

  emptyRoster: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    padding: "36px 20px",
    background: "var(--card)",
    border: "1px dashed var(--border-strong)",
    borderRadius: "var(--radius)",
    color: "var(--text-2)",
    fontSize: 13,
  },

  card: {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: "13px 14px",
    boxShadow: "var(--shadow-sm)",
  },
  cardTop: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
  nameInput: {
    flex: "1 1 150px",
    minWidth: 120,
    background: "transparent",
    border: "1px solid transparent",
    borderRadius: 8,
    color: "var(--text)",
    fontSize: 15,
    fontWeight: 600,
    padding: "6px 8px",
    margin: "-6px -8px",
    outline: "none",
  },
  cardControls: { display: "flex", alignItems: "center", gap: 8 },
  select: {
    background: "var(--inset)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--text-2)",
    fontSize: 12.5,
    fontWeight: 500,
    padding: "7px 8px",
    cursor: "pointer",
    outline: "none",
  },
  selectRole: { color: "var(--accent)", background: "var(--accent-tint)", borderColor: "transparent" },
  trashBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    background: "transparent",
    border: "none",
    color: "var(--muted)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background 0.15s, color 0.15s",
  },
  dayToggles: { display: "flex", gap: 5, marginTop: 12 },
  toggle: {
    flex: 1,
    background: "var(--inset)",
    border: "1px solid transparent",
    borderRadius: 8,
    color: "var(--muted)",
    fontSize: 11.5,
    fontWeight: 600,
    padding: "7px 0",
    cursor: "pointer",
    transition: "all 0.14s",
  },
  toggleOn: {
    background: "var(--accent)",
    color: "#fff",
  },
  addBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    width: "100%",
    background: "var(--card)",
    border: "1px dashed var(--border-strong)",
    color: "var(--text-2)",
    fontSize: 13.5,
    fontWeight: 600,
    borderRadius: "var(--radius)",
    padding: "13px",
    cursor: "pointer",
    marginTop: 12,
    transition: "border-color 0.15s, color 0.15s",
  },
}
