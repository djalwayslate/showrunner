"use client"

import { useState, useEffect } from "react"
import { CalendarDays, ListChecks, AlertCircle, TrendingUp, ArrowRight, Mic2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { EventRow } from "@/lib/types"

type EvtStat = {
  ev: EventRow
  past: boolean
  daysOut: number
  openTasks: number
  overdue: number
  pending: number
  net: number
}
type OverdueTask = { title: string; event: string; eventId: string; days: number }

export default function GlobalOverview({ onOpenEvent }: { onOpenEvent: (id: string) => void }) {
  const [stats, setStats] = useState<EvtStat[]>([])
  const [overdueTasks, setOverdueTasks] = useState<OverdueTask[]>([])
  const [loading, setLoading] = useState(true)
  const db = createClient()

  useEffect(() => {
    async function load() {
      setLoading(true)
      const today = new Date().toISOString().slice(0, 10)
      const [{ data: events }, { data: tasks }, { data: budget }, { data: lineup }] = await Promise.all([
        db.from("events").select("*").order("start_date"),
        db.from("tasks").select("event_id, title, status, due_date"),
        db.from("budget_items").select("event_id, type, planned, actual"),
        db.from("lineup_entries").select("event_id, status, kind"),
      ])
      const nameOf: Record<string, string> = {}
      ;(events ?? []).forEach((e) => (nameOf[e.id] = e.name))

      const rows: EvtStat[] = (events ?? []).map((ev: EventRow) => {
        const t = (tasks ?? []).filter((x) => x.event_id === ev.id)
        const openTasks = t.filter((x) => x.status !== "done").length
        const overdue = t.filter((x) => x.status !== "done" && x.due_date && x.due_date < today).length
        const pending = (lineup ?? []).filter((l) => l.event_id === ev.id && l.kind !== "activity" && l.status === "Pending").length
        let rev = 0, cost = 0
        ;(budget ?? []).filter((b) => b.event_id === ev.id).forEach((b) => {
          const v = Number(b.actual) || Number(b.planned) || 0
          if (b.type === "revenue") rev += v; else cost += v
        })
        const start = new Date(ev.start_date + "T00:00:00")
        return { ev, past: ev.end_date < today, daysOut: Math.ceil((start.getTime() - Date.now()) / 86400000), openTasks, overdue, pending, net: rev - cost }
      })

      const od: OverdueTask[] = (tasks ?? [])
        .filter((x) => x.status !== "done" && x.due_date && x.due_date < today)
        .map((x) => ({ title: x.title, event: nameOf[x.event_id] ?? "—", eventId: x.event_id, days: Math.round((Date.now() - new Date(x.due_date + "T00:00:00").getTime()) / 86400000) }))
        .sort((a, b) => b.days - a.days)

      setStats(rows)
      setOverdueTasks(od)
      setLoading(false)
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div style={s.skeleton} />

  const upcoming = stats.filter((s) => !s.past).sort((a, b) => a.ev.start_date.localeCompare(b.ev.start_date))
  const totalOpen = stats.reduce((a, s) => a + s.openTasks, 0)
  const totalOverdue = overdueTasks.length

  return (
    <div>
      <div style={s.cards}>
        <Card icon={CalendarDays} label="Upcoming events" value={String(upcoming.length)} />
        <Card icon={ListChecks} label="Open tasks" value={String(totalOpen)} sub="across all events" />
        <Card icon={AlertCircle} label="Overdue" value={String(totalOverdue)} tone={totalOverdue > 0 ? "warn" : undefined} />
        <Card icon={CalendarDays} label="Events total" value={String(stats.length)} />
      </div>

      {/* Upcoming */}
      <div style={s.section}>
        <h2 style={s.sectionTitle}>Upcoming</h2>
        {upcoming.length === 0 ? (
          <div style={s.empty}>No upcoming events.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {upcoming.map((st) => (
              <button key={st.ev.id} style={s.evRow} onClick={() => onOpenEvent(st.ev.id)} type="button">
                <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                  <div style={s.evName}>{st.ev.name}</div>
                  <div style={s.evMeta}>
                    {new Date(st.ev.start_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    {st.ev.venue ? ` · ${st.ev.venue}` : ""}
                  </div>
                </div>
                <div style={s.evChips}>
                  {st.daysOut >= 0 && <span style={s.evChip}>{st.daysOut === 0 ? "today" : `${st.daysOut}d`}</span>}
                  {st.openTasks > 0 && <span style={s.evChip}><ListChecks size={11} strokeWidth={2} /> {st.openTasks}</span>}
                  {st.pending > 0 && <span style={s.evChip}><Mic2 size={11} strokeWidth={2} /> {st.pending}</span>}
                  <span style={{ ...s.evChip, color: st.net >= 0 ? "var(--green)" : "var(--red)" }}>{st.net < 0 ? "−" : ""}€{Math.abs(Math.round(st.net)).toLocaleString("en-US")}</span>
                </div>
                <ArrowRight size={15} strokeWidth={2} style={{ color: "var(--muted)", flexShrink: 0 }} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Needs attention */}
      {overdueTasks.length > 0 && (
        <div style={s.section}>
          <h2 style={s.sectionTitle}>Needs attention</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {overdueTasks.slice(0, 12).map((t, i) => (
              <button key={i} style={s.taskRow} onClick={() => onOpenEvent(t.eventId)} type="button">
                <AlertCircle size={14} strokeWidth={2.2} style={{ color: "var(--accent)", flexShrink: 0 }} />
                <span style={s.taskTitle}>{t.title}</span>
                <span style={s.taskEvent}>{t.event}</span>
                <span style={s.taskDue}>{t.days}d overdue</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Card({ icon: Icon, label, value, sub, tone }: { icon: React.ElementType; label: string; value: string; sub?: string; tone?: "warn" }) {
  return (
    <div style={s.card}>
      <div style={s.cardTop}><Icon size={14} strokeWidth={2} style={{ color: tone === "warn" ? "var(--accent)" : "var(--muted)" }} /><span style={s.cardLabel}>{label}</span></div>
      <div style={{ ...s.cardValue, color: tone === "warn" && value !== "0" ? "var(--accent)" : "var(--text)" }} className="tnum">{value}</div>
      {sub && <div style={s.cardSub}>{sub}</div>}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  skeleton: { height: 360, background: "var(--inset)", borderRadius: "var(--radius)" },
  cards: { display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 },
  card: { flex: 1, minWidth: 130, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "13px 15px", boxShadow: "var(--shadow-sm)" },
  cardTop: { display: "flex", alignItems: "center", gap: 6, marginBottom: 7 },
  cardLabel: { fontSize: 11.5, fontWeight: 600, color: "var(--muted)" },
  cardValue: { fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1 },
  cardSub: { fontSize: 11, color: "var(--muted)", marginTop: 4 },
  section: { marginBottom: 20 },
  sectionTitle: { fontFamily: "var(--font-fraunces), serif", fontSize: 17, fontWeight: 600, color: "var(--text)", margin: "0 0 12px" },
  empty: { fontSize: 13, color: "var(--muted)", padding: "16px", textAlign: "center", background: "var(--card)", border: "1px dashed var(--border)", borderRadius: 11 },
  evRow: { display: "flex", alignItems: "center", gap: 12, width: "100%", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px", boxShadow: "var(--shadow-sm)", cursor: "pointer" },
  evName: { fontSize: 14, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  evMeta: { fontSize: 12, color: "var(--muted)", marginTop: 2 },
  evChips: { display: "flex", alignItems: "center", gap: 6, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" },
  evChip: { display: "flex", alignItems: "center", gap: 3, fontSize: 11.5, fontWeight: 600, color: "var(--text-2)", background: "var(--inset)", borderRadius: 6, padding: "3px 8px" },
  taskRow: { display: "flex", alignItems: "center", gap: 9, width: "100%", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "9px 12px", boxShadow: "var(--shadow-sm)", cursor: "pointer", textAlign: "left" },
  taskTitle: { flex: 1, minWidth: 0, fontSize: 13, color: "var(--text)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  taskEvent: { fontSize: 11.5, color: "var(--muted)", flexShrink: 0 },
  taskDue: { fontSize: 11, fontWeight: 600, color: "var(--accent)", background: "var(--accent-tint)", borderRadius: 6, padding: "2px 8px", flexShrink: 0 },
}
