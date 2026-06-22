"use client"

import { useState } from "react"
import { X, Sparkles, Loader, Wand2, Check, Calendar, Clock, Mic2, Wallet, Bed, ListChecks, Layers, Users } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { EventRow, Task } from "@/lib/types"

type BPTask = { title: string; phase: Task["phase"]; days_before: number; owner?: string }
type BPBudget = { type: "revenue" | "cost"; label: string; planned: number }
type BPHosp = { name: string; count: number; room: "Single" | "Double" | "Room"; role: "" | "Org" | "Crew" | "Headliner"; day_offsets: number[] }
type BPLineup = { name: string; role: "Headliner" | "Support" | "Crew" | "Org"; stage: string; day_offset: number; start_time: string | null; end_time: string | null; kind: "music" | "activity" }
type BPEvent = { name: string; venue: string | null; start_date: string | null; end_date: string | null; start_time: string | null; attendance: number | null; description: string; stages: string[] }
type Blueprint = { event: BPEvent | null; tasks: BPTask[]; budget: BPBudget[]; hosp: BPHosp[]; lineup: BPLineup[] }

type Section = "stages" | "tasks" | "budget" | "hosp" | "lineup"

const PHASES: { key: Task["phase"]; label: string }[] = [
  { key: "prep", label: "Pre-production" },
  { key: "week", label: "Week of" },
  { key: "day", label: "Day of" },
  { key: "post", label: "Post-event" },
]

function dueFrom(start: string, daysBefore: number): string {
  const d = new Date(start + "T00:00:00")
  d.setDate(d.getDate() - daysBefore)
  return d.toISOString().slice(0, 10)
}
function addDays(start: string, n: number): string {
  const d = new Date(start + "T00:00:00")
  d.setDate(d.getDate() + (n || 0))
  return d.toISOString().slice(0, 10)
}
function whenLabel(daysBefore: number): string {
  return daysBefore > 0 ? `${daysBefore}d before` : daysBefore === 0 ? "day of" : `${-daysBefore}d after`
}

export default function EventBuilder({ onCreated, onClose }: { onCreated: (e: EventRow) => void; onClose: () => void }) {
  const [step, setStep] = useState<"compose" | "review">("compose")
  const [context, setContext] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [startTime, setStartTime] = useState("")
  const [name, setName] = useState("")
  const [venue, setVenue] = useState("")
  const [attendance, setAttendance] = useState("")
  const [building, setBuilding] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bp, setBp] = useState<Blueprint | null>(null)
  const [include, setInclude] = useState<Record<Section, boolean>>({ stages: true, tasks: true, budget: true, hosp: true, lineup: true })
  const db = createClient()

  async function build() {
    if (!context.trim() || building) return
    setBuilding(true); setError(null)
    try {
      const [{ data: org }, { data: playbook }, { data: pastEvents }] = await Promise.all([
        db.from("org_settings").select("default_stages, default_drinks, default_food").eq("id", 1).single(),
        db.from("playbook_entries").select("category, title, body").order("sort_order"),
        db.from("events").select("id, name, attendance, start_date").order("start_date", { ascending: false }).limit(8),
      ])

      // Light budget rollup over past events so attendance/budget estimates are grounded, not invented.
      const ids = (pastEvents ?? []).map((e) => e.id)
      const netByEvent: Record<string, number> = {}
      if (ids.length) {
        const { data: bi } = await db.from("budget_items").select("event_id, type, planned, actual").in("event_id", ids)
        ;(bi ?? []).forEach((b) => {
          const v = Number(b.actual) || Number(b.planned) || 0
          netByEvent[b.event_id] = (netByEvent[b.event_id] ?? 0) + (b.type === "revenue" ? v : -v)
        })
      }
      const history = (pastEvents ?? []).map((e) => ({ name: e.name, attendance: e.attendance, net: Math.round(netByEvent[e.id] ?? 0) }))

      const res = await fetch("/api/event-build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context, startDate: startDate || null, endDate: endDate || null, playbook, orgDefaults: org, history }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Build failed")

      const blueprint: Blueprint = {
        event: json.event ?? null,
        tasks: json.tasks ?? [],
        budget: json.budget ?? [],
        hosp: json.hosp ?? [],
        lineup: json.lineup ?? [],
      }
      setBp(blueprint)
      const ev = blueprint.event
      if (ev) {
        setName(ev.name ?? "")
        setVenue(ev.venue ?? "")
        if (!startDate && ev.start_date) setStartDate(ev.start_date)
        if (!endDate && (ev.end_date || ev.start_date)) setEndDate(ev.end_date ?? ev.start_date ?? "")
        if (ev.start_time) setStartTime(ev.start_time)
        if (ev.attendance != null) setAttendance(String(ev.attendance))
      }
      setStep("review")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Build failed")
    }
    setBuilding(false)
  }

  async function create() {
    if (!bp) return
    const start = startDate || bp.event?.start_date || ""
    const end = endDate || bp.event?.end_date || start
    if (!name.trim() || !start || !end) { setError("Name, start and end dates are required."); return }
    setCreating(true); setError(null)

    const { data: org } = await db.from("org_settings").select("default_stages, default_drinks, default_food").eq("id", 1).single()
    const stages = include.stages && bp.event?.stages?.length
      ? bp.event.stages
      : (Array.isArray(org?.default_stages) && org!.default_stages.length ? org!.default_stages : ["Main Stage"])

    // 1. The event itself
    const { data: event, error: evErr } = await db.from("events").insert({
      name: name.trim(),
      venue: venue || null,
      start_date: start,
      end_date: end,
      start_time: startTime || null,
      attendance: attendance ? Number(attendance) : null,
      description: bp.event?.description || null,
      stages,
    }).select().single()
    if (evErr || !event) { setCreating(false); setError(evErr?.message ?? "Could not create event."); return }

    try {
      // 2. Hospitality settings (always, mirrors EventEditor)
      await db.from("hosp_settings").insert({
        event_id: event.id,
        drinks_per_person: org?.default_drinks ?? 4,
        food_per_person: org?.default_food ?? 1,
      })

      // 3. Budget — blueprint lines, or fall back to the standard seed so the tab isn't empty
      if (include.budget && bp.budget.length) {
        await db.from("budget_items").insert(
          bp.budget.map((b, i) => ({ event_id: event.id, type: b.type, label: b.label, planned: Number(b.planned) || 0, actual: 0, sort_order: i }))
        )
      } else {
        const seed = [
          ["revenue", "Door", 1], ["revenue", "Sponsorship", 2], ["revenue", "Merch", 3], ["revenue", "Bar split", 4],
          ["cost", "Artist fees", 1], ["cost", "Venue rent", 2], ["cost", "Hospitality", 3], ["cost", "Production", 4], ["cost", "Marketing", 5],
        ].map(([type, label, ord]) => ({ event_id: event.id, type, label, planned: 0, actual: 0, sort_order: ord as number }))
        await db.from("budget_items").insert(seed)
      }

      // 4. Tasks — deadlines counted back from the start date
      if (include.tasks && bp.tasks.length) {
        await db.from("tasks").insert(
          bp.tasks.map((t, i) => ({
            event_id: event.id, title: t.title, phase: t.phase, owner: t.owner ?? "",
            due_date: dueFrom(start, t.days_before), status: "todo", sort_order: i,
          }))
        )
      }

      // 5. Hospitality roster. The Hosp board renders a FIXED week (days 13–19), and
      // hosp_person_days.day is a day-of-month int — so map event-day offsets onto that window.
      if (include.hosp && bp.hosp.length) {
        const { data: people } = await db.from("hosp_people").insert(
          bp.hosp.map((h, i) => ({
            event_id: event.id, name: h.name, count: Number(h.count) || 1,
            room: h.room || "Single", role: h.role ?? "", sort_order: i,
          }))
        ).select()
        if (people) {
          const dayRows: { person_id: string; day: number }[] = []
          people.forEach((p, i) => {
            ;(bp.hosp[i]?.day_offsets ?? []).forEach((off) => {
              const day = 13 + (off || 0)
              if (day >= 13 && day <= 19) dayRows.push({ person_id: p.id, day })
            })
          })
          if (dayRows.length) await db.from("hosp_person_days").insert(dayRows)
        }
      }

      // 6. Draft timetable
      if (include.lineup && bp.lineup.length) {
        await db.from("lineup_entries").insert(
          bp.lineup.map((l, i) => ({
            event_id: event.id, name: l.name, role: l.role || "Support",
            start_time: l.start_time || "", end_time: l.end_time || "", fee: 0,
            status: l.kind === "activity" ? "Signed" : "Pending",
            stage: l.stage || stages[0] || "", day_date: addDays(start, l.day_offset ?? 0),
            kind: l.kind || "music", rider: [], sort_order: i,
          }))
        )
      }
    } catch (err: unknown) {
      // The event exists; surface that the scaffold was partial rather than losing it.
      setCreating(false)
      setError(`Event created, but some sections didn't save: ${err instanceof Error ? err.message : "unknown error"}. Open it and check.`)
      onCreated(event)
      return
    }

    setCreating(false)
    onCreated(event)
  }

  const tasksByPhase = (ph: Task["phase"]) => (bp?.tasks ?? []).filter((t) => t.phase === ph)
  const revenue = (bp?.budget ?? []).filter((b) => b.type === "revenue")
  const costs = (bp?.budget ?? []).filter((b) => b.type === "cost")

  return (
    <div style={s.overlay} onMouseDown={onClose}>
      <div style={s.modal} onMouseDown={(e) => e.stopPropagation()}>
        <div style={s.head}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={s.headIcon}><Wand2 size={15} strokeWidth={2} /></div>
            <div>
              <h2 style={s.title}>{step === "compose" ? "Build an event with AI" : "Review the blueprint"}</h2>
              <div style={s.sub}>{step === "compose" ? "One or two sentences — we scaffold the rest." : "Tweak the basics, pick what to keep, then create."}</div>
            </div>
          </div>
          <button style={s.closeBtn} onClick={onClose} type="button"><X size={17} strokeWidth={2} /></button>
        </div>

        {step === "compose" ? (
          <div style={s.body}>
            <Field label="Describe the event">
              <textarea
                style={{ ...s.input, resize: "vertical", minHeight: 92, lineHeight: 1.5 }}
                rows={4}
                autoFocus
                placeholder="e.g. Two-night Latino Kings Carnaval at Pacha beach club, mid-August, ~600 a night, main stage + beach bar with a samba show."
                value={context}
                onChange={(e) => setContext(e.target.value)}
              />
            </Field>
            <div style={{ display: "flex", gap: 10 }}>
              <Field label="Start date (optional)" icon={Calendar}>
                <input type="date" style={s.input} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </Field>
              <Field label="End date (optional)" icon={Calendar}>
                <input type="date" style={s.input} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </Field>
            </div>
            <div style={s.hint}>Leave dates blank and the AI will infer them if your description implies a date. Nothing is saved until you review and confirm.</div>
            {error && <div style={s.error}>{error}</div>}
          </div>
        ) : (
          <div style={s.body}>
            {/* Editable basics */}
            <Field label="Event name">
              <input style={s.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Event name" />
            </Field>
            <Field label="Venue">
              <input style={s.input} value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Venue (optional)" />
            </Field>
            <div style={{ display: "flex", gap: 10 }}>
              <Field label="Start" icon={Calendar}>
                <input type="date" style={s.input} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </Field>
              <Field label="End" icon={Calendar}>
                <input type="date" style={s.input} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </Field>
              <Field label="Doors" icon={Clock}>
                <input type="time" style={s.input} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </Field>
            </div>
            <Field label="Attendance (powers forecasting)">
              <input type="number" min={0} style={s.input} value={attendance} onChange={(e) => setAttendance(e.target.value)} placeholder="grounded in history, or blank" />
            </Field>
            {bp?.event?.description && <div style={s.blurb}>{bp.event.description}</div>}

            <div style={s.divider} />

            {/* Stages */}
            <SectionHead icon={Layers} label="Stages" count={bp?.event?.stages?.length ?? 0} on={include.stages} toggle={() => setInclude((p) => ({ ...p, stages: !p.stages }))} />
            {include.stages && (
              <div style={s.chips}>
                {(bp?.event?.stages ?? []).map((st, i) => <span key={i} style={s.chip}>{st}</span>)}
              </div>
            )}

            {/* Tasks */}
            <SectionHead icon={ListChecks} label="Tasks" count={bp?.tasks.length ?? 0} on={include.tasks} toggle={() => setInclude((p) => ({ ...p, tasks: !p.tasks }))} />
            {include.tasks && (
              <div style={s.list}>
                {PHASES.map(({ key, label }) => {
                  const items = tasksByPhase(key)
                  if (!items.length) return null
                  return (
                    <div key={key} style={{ marginBottom: 8 }}>
                      <div style={s.phaseLabel}>{label}</div>
                      {items.map((t, i) => (
                        <div key={i} style={s.row}>
                          <span style={s.rowDot} />
                          <span style={{ flex: 1 }}>{t.title}</span>
                          <span style={s.rowMeta}>{whenLabel(t.days_before)}</span>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Budget */}
            <SectionHead icon={Wallet} label="Budget" count={bp?.budget.length ?? 0} on={include.budget} toggle={() => setInclude((p) => ({ ...p, budget: !p.budget }))} />
            {include.budget && (
              <div style={s.list}>
                {[{ label: "Revenue", rows: revenue }, { label: "Costs", rows: costs }].map(({ label, rows }) =>
                  rows.length ? (
                    <div key={label} style={{ marginBottom: 8 }}>
                      <div style={s.phaseLabel}>{label}</div>
                      {rows.map((b, i) => (
                        <div key={i} style={s.row}>
                          <span style={s.rowDot} />
                          <span style={{ flex: 1 }}>{b.label}</span>
                          <span style={s.rowMeta}>{b.planned ? `€${Number(b.planned).toLocaleString("en-US")}` : "—"}</span>
                        </div>
                      ))}
                    </div>
                  ) : null
                )}
              </div>
            )}

            {/* Hospitality */}
            <SectionHead icon={Bed} label="Hospitality" count={bp?.hosp.length ?? 0} on={include.hosp} toggle={() => setInclude((p) => ({ ...p, hosp: !p.hosp }))} />
            {include.hosp && (
              <div style={s.list}>
                {(bp?.hosp ?? []).map((h, i) => (
                  <div key={i} style={s.row}>
                    <Users size={12} strokeWidth={2} style={{ color: "var(--muted)", flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{h.name}{h.count > 1 ? ` ×${h.count}` : ""}</span>
                    <span style={s.rowMeta}>{[h.role || "Guest", h.room].join(" · ")}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Timetable */}
            <SectionHead icon={Mic2} label="Draft timetable" count={bp?.lineup.length ?? 0} on={include.lineup} toggle={() => setInclude((p) => ({ ...p, lineup: !p.lineup }))} />
            {include.lineup && (
              <div style={s.list}>
                {(bp?.lineup ?? []).map((l, i) => (
                  <div key={i} style={s.row}>
                    <span style={{ ...s.rowDot, background: l.kind === "activity" ? "var(--gold)" : "var(--accent)" }} />
                    <span style={{ flex: 1 }}>{l.name}</span>
                    <span style={s.rowMeta}>{[l.stage, l.start_time].filter(Boolean).join(" · ") || "unscheduled"}</span>
                  </div>
                ))}
              </div>
            )}

            {error && <div style={s.error}>{error}</div>}
          </div>
        )}

        <div style={s.foot}>
          {step === "compose" ? (
            <>
              <button style={s.cancel} onClick={onClose} type="button">Cancel</button>
              <button style={s.primary} onClick={build} disabled={building || !context.trim()} type="button">
                {building ? <Loader size={15} style={{ animation: "lk-spin 0.8s linear infinite" }} /> : <Sparkles size={15} strokeWidth={2.2} />}
                {building ? "Building…" : "Build blueprint"}
              </button>
            </>
          ) : (
            <>
              <button style={s.cancel} onClick={() => { setStep("compose"); setError(null) }} type="button">Back</button>
              <button style={s.primary} onClick={create} disabled={creating} type="button">
                {creating ? <Loader size={15} style={{ animation: "lk-spin 0.8s linear infinite" }} /> : <Check size={15} strokeWidth={2.4} />}
                {creating ? "Creating…" : "Create event"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, icon: Icon, children }: { label: string; icon?: React.ElementType; children: React.ReactNode }) {
  return (
    <label style={s.field}>
      <span style={s.fieldLabel}>{Icon && <Icon size={12} strokeWidth={2} style={{ color: "var(--muted)" }} />}{label}</span>
      {children}
    </label>
  )
}

function SectionHead({ icon: Icon, label, count, on, toggle }: { icon: React.ElementType; label: string; count: number; on: boolean; toggle: () => void }) {
  return (
    <button style={s.sectionHead} onClick={toggle} type="button">
      <span style={{ ...s.check, ...(on ? s.checkOn : {}) }}>{on && <Check size={12} strokeWidth={3} />}</span>
      <Icon size={14} strokeWidth={2} style={{ color: on ? "var(--accent)" : "var(--muted)" }} />
      <span style={{ ...s.sectionLabel, color: on ? "var(--text)" : "var(--muted)" }}>{label}</span>
      <span style={s.sectionCount}>{count}</span>
    </button>
  )
}

const s: Record<string, React.CSSProperties> = {
  overlay: { position: "fixed", inset: 0, background: "rgba(28,27,23,0.32)", backdropFilter: "blur(2px)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", zIndex: 100, overflowY: "auto" },
  modal: { background: "var(--card)", borderRadius: 18, width: "100%", maxWidth: 480, boxShadow: "var(--shadow-lg)", border: "1px solid var(--border)", animation: "lk-fade-up 0.2s ease both" },
  head: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border)" },
  headIcon: { width: 30, height: 30, borderRadius: 9, flexShrink: 0, background: "var(--accent-tint)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" },
  title: { fontFamily: "var(--font-fraunces), serif", fontSize: 18, fontWeight: 600, color: "var(--text)", margin: 0 },
  sub: { fontSize: 12, color: "var(--muted)", marginTop: 1 },
  closeBtn: { width: 30, height: 30, borderRadius: 8, background: "var(--inset)", border: "none", color: "var(--text-2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  body: { padding: "16px 20px", display: "flex", flexDirection: "column", gap: 13, maxHeight: "62vh", overflowY: "auto" },
  field: { display: "flex", flexDirection: "column", gap: 5, flex: 1 },
  fieldLabel: { display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "var(--text-2)" },
  input: { background: "var(--inset)", border: "1px solid var(--border)", borderRadius: 9, color: "var(--text)", fontSize: 13.5, padding: "10px 12px", outline: "none", fontFamily: "inherit", width: "100%" },
  hint: { fontSize: 11.5, color: "var(--muted)", lineHeight: 1.5, background: "var(--bg-2)", borderRadius: 9, padding: "10px 12px" },
  blurb: { fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.5, background: "var(--bg-2)", borderRadius: 9, padding: "10px 12px" },
  divider: { height: 1, background: "var(--border)", margin: "2px 0" },
  sectionHead: { display: "flex", alignItems: "center", gap: 9, width: "100%", background: "transparent", border: "none", padding: "6px 0", cursor: "pointer", textAlign: "left" },
  check: { width: 18, height: 18, borderRadius: 6, border: "1.5px solid var(--border-strong)", background: "var(--inset)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", flexShrink: 0 },
  checkOn: { background: "var(--accent)", borderColor: "var(--accent)" },
  sectionLabel: { fontSize: 13.5, fontWeight: 600, flex: 1 },
  sectionCount: { fontSize: 11.5, fontWeight: 600, color: "var(--muted)", background: "var(--bg-2)", borderRadius: 999, padding: "2px 9px" },
  list: { paddingLeft: 2, marginTop: -2 },
  phaseLabel: { fontSize: 10.5, fontWeight: 600, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5 },
  row: { display: "flex", alignItems: "center", gap: 9, fontSize: 13, color: "var(--text)", padding: "4px 0" },
  rowDot: { width: 5, height: 5, borderRadius: "50%", background: "var(--border-strong)", flexShrink: 0 },
  rowMeta: { fontSize: 11, color: "var(--muted)", fontWeight: 500, whiteSpace: "nowrap" },
  chips: { display: "flex", flexWrap: "wrap", gap: 6 },
  chip: { fontSize: 12, fontWeight: 600, color: "var(--accent)", background: "var(--accent-tint)", borderRadius: 8, padding: "5px 10px" },
  error: { fontSize: 12.5, color: "var(--red)", background: "var(--red-tint)", borderRadius: 8, padding: "9px 11px" },
  foot: { display: "flex", justifyContent: "flex-end", gap: 8, padding: "14px 20px", borderTop: "1px solid var(--border)" },
  cancel: { background: "var(--inset)", border: "1px solid var(--border)", color: "var(--text-2)", borderRadius: 9, padding: "10px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer" },
  primary: { display: "flex", alignItems: "center", gap: 7, background: "var(--accent)", color: "#fff", border: "none", borderRadius: 9, padding: "10px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" },
}
