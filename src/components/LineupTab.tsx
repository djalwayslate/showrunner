"use client"

import { useState, useEffect, useRef } from "react"
import { Plus, Trash2, GripVertical, Mic2, Inbox, X, RotateCcw, ClipboardList } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { LineupEntry, EventRow, RiderItem } from "@/lib/types"
import RiderModal from "./RiderModal"

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  Pending: { color: "var(--muted)", background: "var(--inset)" },
  Sent: { color: "var(--gold)", background: "color-mix(in srgb, var(--gold) 14%, transparent)" },
  Signed: { color: "var(--accent)", background: "var(--accent-tint)" },
  Paid: { color: "var(--green)", background: "var(--green-tint)" },
}
const STATUSES = ["Pending", "Sent", "Signed", "Paid"] as const

function dateRange(start: string, end: string): string[] {
  const out: string[] = []
  const d = new Date(start + "T00:00:00")
  const e = new Date(end + "T00:00:00")
  while (d <= e) {
    out.push(d.toISOString().slice(0, 10))
    d.setDate(d.getDate() + 1)
  }
  return out
}
// Night-aware ordering: times after midnight (00:00–06:59) belong to the
// end of the night, so 23:00 sorts before 00:30 before 03:00.
function nightKey(t: string | null): number {
  if (!t) return 99999
  const [h, m] = t.split(":").map(Number)
  if (Number.isNaN(h)) return 99999
  let mins = h * 60 + (m || 0)
  if (h < 7) mins += 1440
  return mins
}
// Group acts whose times overlap into "concurrent" clusters (acts already sorted by start)
function clusterActs(acts: LineupEntry[]): LineupEntry[][] {
  const clusters: LineupEntry[][] = []
  let cur: LineupEntry[] = []
  let maxEnd = -Infinity
  for (const a of acts) {
    const sIso = a.start_time
    const s = nightKey(sIso)
    const e = a.end_time ? nightKey(a.end_time) : s
    if (cur.length && s < maxEnd) {
      cur.push(a)
      maxEnd = Math.max(maxEnd, e)
    } else {
      if (cur.length) clusters.push(cur)
      cur = [a]
      maxEnd = e
    }
  }
  if (cur.length) clusters.push(cur)
  return clusters
}
function dayLabel(iso: string) {
  const d = new Date(iso + "T00:00:00")
  return {
    wd: d.toLocaleString("en-US", { weekday: "short" }),
    md: d.toLocaleString("en-US", { month: "short", day: "numeric" }),
  }
}

export default function LineupTab({ eventId, refreshKey }: { eventId: string; refreshKey: number }) {
  const [entries, setEntries] = useState<LineupEntry[]>([])
  const [event, setEvent] = useState<EventRow | null>(null)
  const [stages, setStages] = useState<string[]>([])
  const [excluded, setExcluded] = useState<string[]>([])
  const [mode, setMode] = useState<"edit" | "view">("edit")
  const [raBusy, setRaBusy] = useState(false)
  const [raMsg, setRaMsg] = useState<string | null>(null)
  const [riderEntry, setRiderEntry] = useState<LineupEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropKey, setDropKey] = useState<string | null>(null)
  const draggingRef = useRef<string | null>(null)
  const db = createClient()

  async function load() {
    setLoading(true)
    const [{ data: ev }, { data: rows }] = await Promise.all([
      db.from("events").select("*").eq("id", eventId).single(),
      db.from("lineup_entries").select("*").eq("event_id", eventId).order("start_time"),
    ])
    if (ev) {
      setEvent(ev)
      setStages(Array.isArray(ev.stages) && ev.stages.length ? ev.stages : ["Main Stage"])
      setExcluded(Array.isArray(ev.excluded_days) ? ev.excluded_days : [])
    }
    if (rows) setEntries(rows.map((r) => ({ ...r, stage: r.stage ?? "", day_date: r.day_date ?? null, kind: r.kind ?? "music", rider: r.rider ?? [] })))
    setLoading(false)
  }

  useEffect(() => {
    if (eventId) load()
  }, [eventId, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  async function saveStages(next: string[]) {
    setStages(next)
    await db.from("events").update({ stages: next }).eq("id", eventId)
  }

  async function addStage() {
    const name = `Stage ${stages.length + 1}`
    await saveStages([...stages, name])
  }

  async function removeDay(day: string) {
    const next = [...excluded, day]
    setExcluded(next)
    // move any acts on that day back to unscheduled so they're not lost
    setEntries((prev) => prev.map((e) => (e.day_date === day ? { ...e, day_date: null } : e)))
    await db.from("lineup_entries").update({ day_date: null }).eq("event_id", eventId).eq("day_date", day)
    await db.from("events").update({ excluded_days: next }).eq("id", eventId)
  }

  async function restoreDays() {
    setExcluded([])
    await db.from("events").update({ excluded_days: [] }).eq("id", eventId)
  }

  async function renameStage(idx: number, name: string) {
    const old = stages[idx]
    const next = stages.map((st, i) => (i === idx ? name : st))
    setStages(next)
    await db.from("events").update({ stages: next }).eq("id", eventId)
    // move entries from old stage name to new
    setEntries((prev) => prev.map((e) => (e.stage === old ? { ...e, stage: name } : e)))
    await db.from("lineup_entries").update({ stage: name }).eq("event_id", eventId).eq("stage", old)
  }

  async function removeStage(idx: number) {
    const name = stages[idx]
    if (!confirm(`Remove the "${name}" stage? Its acts move to Unscheduled.`)) return
    await saveStages(stages.filter((_, i) => i !== idx))
    setEntries((prev) => prev.map((e) => (e.stage === name ? { ...e, stage: "", day_date: null } : e)))
    await db.from("lineup_entries").update({ stage: "", day_date: null }).eq("event_id", eventId).eq("stage", name)
  }

  async function importLineupFromRA() {
    let link = event?.ticket_url && /ra\.co\/events\/\d+/.test(event.ticket_url) ? event.ticket_url : ""
    if (!link) link = window.prompt("Paste the Resident Advisor event link (ra.co/events/…)") || ""
    if (!/ra\.co\/events\/\d+/.test(link)) { if (link) setRaMsg("That's not an RA event link."); return }
    setRaBusy(true); setRaMsg(null)
    try {
      const res = await fetch("/api/event-import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: link }) })
      const json = await res.json()
      const names: string[] = json?.data?.lineup ?? []
      const existing = new Set(entries.map((e) => e.name.toLowerCase().trim()))
      const toAdd = names.filter((n) => n && !existing.has(n.toLowerCase().trim()))
      if (!toAdd.length) { setRaMsg(names.length ? "All those artists are already in your lineup." : "No lineup found on that RA page."); setRaBusy(false); return }
      const rows = toAdd.map((name, i) => ({ event_id: eventId, name, role: "Support", start_time: "", end_time: "", fee: 0, status: "Pending", stage: "", day_date: null, sort_order: entries.length + i }))
      const { data } = await db.from("lineup_entries").insert(rows).select()
      if (data) setEntries((prev) => [...prev, ...data.map((d) => ({ ...d, stage: d.stage ?? "", day_date: d.day_date ?? null }))])
      setRaMsg(`Added ${toAdd.length} artists to Unscheduled — drag them onto a stage & day.`)
    } catch {
      setRaMsg("Couldn't read that RA link.")
    }
    setRaBusy(false)
  }

  async function addAct(stage: string, day: string | null, kind: "music" | "activity" = "music") {
    const { data } = await db
      .from("lineup_entries")
      .insert({ event_id: eventId, name: kind === "activity" ? "New activity" : "New act", role: "Support", start_time: "", end_time: "", fee: 0, status: kind === "activity" ? "Signed" : "Pending", stage, day_date: day, kind, sort_order: entries.length })
      .select().single()
    if (data) setEntries((prev) => [...prev, { ...data, stage: data.stage ?? "", day_date: data.day_date ?? null, kind: data.kind ?? "music", rider: data.rider ?? [] }])
  }

  async function saveRider(id: string, rider: RiderItem[]) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, rider } : e)))
    setRiderEntry((r) => (r && r.id === id ? { ...r, rider } : r))
    await db.from("lineup_entries").update({ rider }).eq("id", id)
  }

  async function updateEntry(id: string, patch: Partial<LineupEntry>) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)))
    await db.from("lineup_entries").update(patch).eq("id", id)
  }

  async function removeEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id))
    await db.from("lineup_entries").delete().eq("id", id)
  }

  async function moveEntry(id: string, stage: string, day: string | null) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, stage, day_date: day } : e)))
    await db.from("lineup_entries").update({ stage, day_date: day }).eq("id", id)
  }

  function cellEntries(stage: string, day: string | null) {
    return entries
      .filter((e) => e.stage === stage && e.day_date === day)
      .sort((a, b) => nightKey(a.start_time) - nightKey(b.start_time))
  }

  const unscheduled = entries.filter((e) => !e.day_date || !e.stage || !stages.includes(e.stage))
  const allDays = event ? dateRange(event.start_date, event.end_date) : []
  const days = allDays.filter((d) => !excluded.includes(d))
  const totalFee = entries.reduce((a, e) => a + (Number(e.fee) || 0), 0)

  if (loading) return <div style={s.skeleton} />

  const Card = (e: LineupEntry) => (
    <div
      key={e.id}
      style={{ ...s.card, ...(e.kind === "activity" ? s.cardActivity : {}), ...(dragId === e.id ? { opacity: 0.4 } : {}) }}
    >
      <div
        style={s.grip}
        draggable
        onDragStart={() => { draggingRef.current = e.id; setDragId(e.id) }}
        onDragEnd={() => { draggingRef.current = null; setDragId(null); setDropKey(null) }}
        title="Drag to move"
      >
        <GripVertical size={14} strokeWidth={2} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <input
          style={s.cardName}
          value={e.name}
          onChange={(ev) => setEntries((prev) => prev.map((x) => (x.id === e.id ? { ...x, name: ev.target.value } : x)))}
          onBlur={() => db.from("lineup_entries").update({ name: e.name }).eq("id", e.id)}
        />
        <div style={s.cardMeta}>
          <input
            style={s.timeInput} placeholder="23:00" value={e.start_time ?? ""}
            onChange={(ev) => setEntries((prev) => prev.map((x) => (x.id === e.id ? { ...x, start_time: ev.target.value } : x)))}
            onBlur={() => updateEntry(e.id, { start_time: e.start_time })}
          />
          <span style={{ color: "var(--muted)", fontSize: 11 }}>→</span>
          <input
            style={s.timeInput} placeholder="01:00" value={e.end_time ?? ""}
            onChange={(ev) => setEntries((prev) => prev.map((x) => (x.id === e.id ? { ...x, end_time: ev.target.value } : x)))}
            onBlur={() => updateEntry(e.id, { end_time: e.end_time })}
          />
          {e.kind === "activity" ? (
            <span style={s.activityTag}>Activity</span>
          ) : (
            <select
              style={{ ...s.statusSelect, ...STATUS_STYLE[e.status] }}
              value={e.status}
              onChange={(ev) => updateEntry(e.id, { status: ev.target.value as LineupEntry["status"] })}
            >
              {STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
            </select>
          )}
          {e.kind === "music" && (
            <button style={{ ...s.riderBtn, ...(e.rider?.length ? s.riderBtnOn : {}) }} onClick={() => setRiderEntry(e)} type="button" title="Rider">
              <ClipboardList size={13} strokeWidth={2} />
              {e.rider?.length ? <span className="tnum">{e.rider.filter((r) => r.fulfilled).length}/{e.rider.length}</span> : null}
            </button>
          )}
          <button style={s.cardTrash} onClick={() => removeEntry(e.id)} type="button" title="Remove">
            <Trash2 size={13} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  )

  const Column = ({ stage, day, stageIdx, k }: { stage: string; day: string | null; stageIdx: number; k: string }) => {
    const key = `${day}__${stage}`
    return (
      <div
        key={k}
        style={{ ...s.col, ...(dropKey === key ? s.colDrop : {}) }}
        onDragOver={(ev) => { ev.preventDefault(); if (dropKey !== key) setDropKey(key) }}
        onDragLeave={() => setDropKey((k) => (k === key ? null : k))}
        onDrop={() => { const id = draggingRef.current; if (id) moveEntry(id, stage, day); setDropKey(null); setDragId(null) }}
      >
        {day === days[0] && (
          <div style={s.colHead}>
            <input
              style={s.stageName}
              value={stage}
              onChange={(ev) => setStages((prev) => prev.map((st, i) => (i === stageIdx ? ev.target.value : st)))}
              onBlur={(ev) => renameStage(stageIdx, ev.target.value)}
            />
            <button style={s.stageRemove} onClick={() => removeStage(stageIdx)} type="button" title="Remove stage">
              <Trash2 size={12} strokeWidth={2} />
            </button>
          </div>
        )}
        <div style={s.cells}>
          {cellEntries(stage, day).map((e) => Card(e))}
          <div style={{ display: "flex", gap: 5 }}>
            <button style={{ ...s.addAct, flex: 1 }} onClick={() => addAct(stage, day, "music")} type="button">
              <Plus size={13} strokeWidth={2.2} /> Act
            </button>
            <button style={{ ...s.addAct, flex: 1, color: "var(--accent)", borderColor: "color-mix(in srgb, var(--accent) 35%, transparent)" }} onClick={() => addAct(stage, day, "activity")} type="button">
              <Plus size={13} strokeWidth={2.2} /> Activity
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={s.head}>
        <h2 style={s.title}>Timetable</h2>
        <div style={s.headRight}>
          {entries.length > 0 && <span style={s.feeTotal} className="tnum">€{totalFee.toLocaleString("en-US")} fees</span>}
          <div style={s.modeToggle}>
            <button style={{ ...s.modeBtn, ...(mode === "edit" ? s.modeOn : {}) }} onClick={() => setMode("edit")} type="button">Edit</button>
            <button style={{ ...s.modeBtn, ...(mode === "view" ? s.modeOn : {}) }} onClick={() => setMode("view")} type="button">View</button>
          </div>
          {mode === "edit" && <button style={s.raBtn} onClick={importLineupFromRA} disabled={raBusy} type="button">{raBusy ? "Reading…" : "↓ From RA"}</button>}
          {mode === "edit" && <button style={s.addStage} onClick={addStage} type="button"><Plus size={14} strokeWidth={2.2} /> Stage</button>}
        </div>
      </div>
      {raMsg && <div style={s.raMsg}>{raMsg}</div>}

      {!event && <div style={s.empty}>Loading event…</div>}

      {/* ---- VIEW MODE: clean, presentable ---- */}
      {mode === "view" && event && (
        <div style={s.viewWrap}>
          {days.every((day) => stages.every((st) => cellEntries(st, day).length === 0)) && (
            <div style={s.empty}>Nothing scheduled yet — add acts in Edit mode.</div>
          )}
          {days.map((day) => {
            const dayStages = stages
              .map((stage) => ({ stage, acts: cellEntries(stage, day) }))
              .filter((x) => x.acts.length > 0)
            if (!dayStages.length) return null
            const { wd, md } = dayLabel(day)
            return (
              <section key={day} style={s.viewDay}>
                <div style={s.viewDayHead}>
                  <span style={s.viewWd}>{wd}</span>
                  <span style={s.viewMd}>{md}</span>
                </div>
                <div style={s.viewStages}>
                  {dayStages.map(({ stage, acts }) => (
                    <div key={stage} style={s.viewStage}>
                      <div style={s.viewStageName}>{stage}</div>
                      {clusterActs(acts).map((cluster, ci) =>
                        cluster.length === 1 ? (
                          <div key={cluster[0].id} style={s.viewAct}>
                            <span style={s.viewTime} className="tnum">{cluster[0].start_time || "—"}{cluster[0].end_time ? `–${cluster[0].end_time}` : ""}</span>
                            <span style={s.viewActName}>{cluster[0].name}{cluster[0].kind === "activity" && <span style={s.viewActivity}> · activity</span>}</span>
                          </div>
                        ) : (
                          <div key={ci} style={s.viewCluster}>
                            <span style={s.viewClusterTag}>at the same time</span>
                            {cluster.map((a) => (
                              <div key={a.id} style={s.viewAct}>
                                <span style={s.viewTime} className="tnum">{a.start_time || "—"}{a.end_time ? `–${a.end_time}` : ""}</span>
                                <span style={s.viewActName}>{a.name}{a.kind === "activity" && <span style={s.viewActivity}> · activity</span>}</span>
                              </div>
                            ))}
                          </div>
                        )
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {mode === "edit" && (
      <>
      {/* ---- EDIT MODE ---- */}

      {/* Unscheduled */}
      {unscheduled.length > 0 && (
        <div
          style={{ ...s.unscheduled, ...(dropKey === "null__" ? s.colDrop : {}) }}
          onDragOver={(ev) => { ev.preventDefault(); setDropKey("null__") }}
          onDragLeave={() => setDropKey((k) => (k === "null__" ? null : k))}
          onDrop={() => { const id = draggingRef.current; if (id) moveEntry(id, "", null); setDropKey(null); setDragId(null) }}
        >
          <div style={s.unschedHead}><Inbox size={14} strokeWidth={2} /> Unscheduled — drag onto a stage & day</div>
          <div style={s.unschedRow}>{unscheduled.map((e) => Card(e))}</div>
        </div>
      )}

      {/* Restore hidden days */}
      {excluded.length > 0 && (
        <button style={s.restore} onClick={restoreDays} type="button">
          <RotateCcw size={13} strokeWidth={2} />
          {excluded.length} day{excluded.length > 1 ? "s" : ""} hidden — show all
        </button>
      )}

      {/* Day grids */}
      {days.map((day) => {
        const { wd, md } = dayLabel(day)
        return (
          <section key={day} style={s.daySection}>
            <div style={s.dayHead}>
              <span style={s.dayWd}>{wd}</span>
              <span style={s.dayMd}>{md}</span>
              <button style={s.removeDay} onClick={() => removeDay(day)} title="Hide this day" type="button">
                <X size={13} strokeWidth={2.4} />
              </button>
            </div>
            <div style={s.grid}>
              {stages.map((stage, i) => Column({ stage, day, stageIdx: i, k: `${day}-${i}` }))}
            </div>
          </section>
        )
      })}

      {days.length === 0 && event && (
        <div style={s.empty}><Mic2 size={18} strokeWidth={1.6} /> Set the event dates to build the timetable.</div>
      )}
      </>
      )}
      {riderEntry && (
        <RiderModal entry={riderEntry} onSave={(rider) => saveRider(riderEntry.id, rider)} onClose={() => setRiderEntry(null)} />
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  skeleton: { height: 360, background: "var(--inset)", borderRadius: "var(--radius)" },
  head: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  title: { fontFamily: "var(--font-fraunces), serif", fontSize: 18, fontWeight: 600, color: "var(--text)", margin: 0 },
  headRight: { display: "flex", alignItems: "center", gap: 10 },
  feeTotal: { fontSize: 12.5, color: "var(--text-2)", fontWeight: 600 },
  addStage: { display: "flex", alignItems: "center", gap: 5, background: "var(--card)", border: "1px solid var(--border)", color: "var(--text-2)", fontSize: 12.5, fontWeight: 600, borderRadius: 9, padding: "7px 11px", cursor: "pointer", boxShadow: "var(--shadow-sm)" },
  raBtn: { display: "flex", alignItems: "center", gap: 5, background: "var(--accent-tint)", border: "1px solid transparent", color: "var(--accent)", fontSize: 12.5, fontWeight: 600, borderRadius: 9, padding: "7px 11px", cursor: "pointer" },
  raMsg: { fontSize: 12.5, color: "var(--text-2)", background: "var(--accent-tint)", borderRadius: 9, padding: "9px 12px", marginBottom: 14 },
  modeToggle: { display: "flex", gap: 2, padding: 3, background: "var(--bg-2)", borderRadius: 9 },
  modeBtn: { background: "transparent", border: "none", borderRadius: 7, padding: "5px 12px", fontSize: 12.5, fontWeight: 600, color: "var(--text-2)", cursor: "pointer" },
  modeOn: { background: "var(--card)", color: "var(--text)", boxShadow: "var(--shadow-sm)" },
  viewWrap: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "8px 20px 20px", boxShadow: "var(--shadow-sm)" },
  viewDay: { paddingTop: 16, marginTop: 12, borderTop: "1px solid var(--border)" },
  viewDayHead: { display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 },
  viewWd: { fontFamily: "var(--font-fraunces), serif", fontSize: 18, fontWeight: 600, color: "var(--text)" },
  viewMd: { fontSize: 13, color: "var(--muted)" },
  viewStages: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 22 },
  viewStage: {},
  viewStageName: { fontSize: 11.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 9, paddingBottom: 6, borderBottom: "1px solid var(--border)" },
  viewCluster: { borderLeft: "2px solid var(--accent)", paddingLeft: 11, margin: "4px 0", background: "var(--accent-tint)", borderRadius: "0 8px 8px 0", paddingTop: 4, paddingBottom: 4 },
  viewClusterTag: { display: "block", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 2 },
  viewAct: { display: "flex", gap: 12, padding: "6px 0", alignItems: "baseline" },
  viewTime: { fontSize: 12, color: "var(--muted)", minWidth: 86, flexShrink: 0 },
  viewActName: { fontSize: 14, fontWeight: 600, color: "var(--text)", lineHeight: 1.35 },
  viewActivity: { fontSize: 11, fontWeight: 600, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.04em" },
  empty: { padding: "30px", textAlign: "center", color: "var(--muted)", fontSize: 13, display: "flex", gap: 8, justifyContent: "center", alignItems: "center" },
  unscheduled: { background: "var(--bg-2)", border: "1px dashed var(--border-strong)", borderRadius: 12, padding: "10px 12px", marginBottom: 18 },
  unschedHead: { display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, color: "var(--muted)", marginBottom: 8 },
  unschedRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  daySection: { marginBottom: 18 },
  dayHead: { display: "flex", alignItems: "center", gap: 8, marginBottom: 8 },
  dayWd: { fontFamily: "var(--font-fraunces), serif", fontSize: 16, fontWeight: 600, color: "var(--text)" },
  dayMd: { fontSize: 12.5, color: "var(--muted)" },
  removeDay: { width: 22, height: 22, borderRadius: 6, background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.6 },
  restore: { display: "flex", alignItems: "center", gap: 6, background: "var(--inset)", border: "1px solid var(--border)", color: "var(--text-2)", fontSize: 12, fontWeight: 500, borderRadius: 8, padding: "7px 12px", cursor: "pointer", marginBottom: 14 },
  grid: { display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6 },
  col: { flex: "1 0 220px", minWidth: 200, background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 12, padding: 8, transition: "background 0.15s, border-color 0.15s" },
  colDrop: { borderColor: "var(--accent)", background: "var(--accent-tint)" },
  colHead: { display: "flex", alignItems: "center", gap: 4, marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid var(--border)" },
  stageName: { flex: 1, minWidth: 0, background: "transparent", border: "1px solid transparent", borderRadius: 6, color: "var(--text)", fontSize: 12.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", padding: "4px 6px", margin: "-4px 0", outline: "none" },
  stageRemove: { width: 24, height: 24, borderRadius: 6, background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  cells: { display: "flex", flexDirection: "column", gap: 7, minHeight: 50 },
  card: { display: "flex", gap: 6, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 9px", boxShadow: "var(--shadow-sm)" },
  cardActivity: { background: "var(--accent-tint)", borderColor: "color-mix(in srgb, var(--accent) 30%, transparent)" },
  activityTag: { fontSize: 10, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.05em", padding: "3px 6px" },
  grip: { display: "flex", alignItems: "flex-start", paddingTop: 2, color: "var(--border-strong)", cursor: "grab", flexShrink: 0 },
  cardName: { width: "100%", background: "transparent", border: "1px solid transparent", borderRadius: 6, color: "var(--text)", fontSize: 13.5, fontWeight: 600, padding: "2px 4px", margin: "-2px -4px 5px", outline: "none" },
  cardMeta: { display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" },
  timeInput: { width: 46, background: "var(--inset)", border: "1px solid var(--border)", borderRadius: 7, color: "var(--text)", fontSize: 12, fontWeight: 600, textAlign: "center", padding: "4px 4px", outline: "none", fontVariantNumeric: "tabular-nums" },
  statusSelect: { border: "1px solid transparent", borderRadius: 6, fontSize: 10.5, fontWeight: 700, padding: "3px 5px", cursor: "pointer", outline: "none" },
  riderBtn: { display: "flex", alignItems: "center", gap: 3, height: 22, padding: "0 6px", borderRadius: 5, background: "var(--inset)", border: "1px solid var(--border)", color: "var(--muted)", cursor: "pointer", fontSize: 10.5, fontWeight: 600, marginLeft: "auto" },
  riderBtnOn: { background: "var(--accent-tint)", border: "1px solid transparent", color: "var(--accent)" },
  cardTrash: { width: 22, height: 22, borderRadius: 5, background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  addAct: { display: "flex", alignItems: "center", justifyContent: "center", gap: 4, background: "transparent", border: "1px dashed var(--border-strong)", color: "var(--muted)", fontSize: 11.5, fontWeight: 600, borderRadius: 8, padding: "6px", cursor: "pointer", marginTop: 1 },
}
