"use client"

import { useState, useEffect } from "react"
import { TrendingUp, TrendingDown, Users, Sparkles, Loader, BarChart3 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { EventRow } from "@/lib/types"

type EventStat = {
  id: string
  name: string
  date: string
  past: boolean
  attendance: number | null
  revenue: number
  cost: number
  net: number
  perHead: number | null
}

export default function InsightsTab() {
  const [stats, setStats] = useState<EventStat[]>([])
  const [loading, setLoading] = useState(true)
  const [narrative, setNarrative] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const db = createClient()

  useEffect(() => {
    async function load() {
      setLoading(true)
      const today = new Date().toISOString().slice(0, 10)
      const [{ data: events }, { data: budget }] = await Promise.all([
        db.from("events").select("*").order("start_date"),
        db.from("budget_items").select("event_id, type, actual, planned"),
      ])
      const rev: Record<string, number> = {}
      const cost: Record<string, number> = {}
      ;(budget ?? []).forEach((b) => {
        const v = Number(b.actual) || Number(b.planned) || 0
        if (b.type === "revenue") rev[b.event_id] = (rev[b.event_id] || 0) + v
        else cost[b.event_id] = (cost[b.event_id] || 0) + v
      })
      const rows: EventStat[] = (events ?? []).map((e: EventRow) => {
        const revenue = rev[e.id] || 0
        const c = cost[e.id] || 0
        const net = revenue - c
        const att = e.attendance ?? null
        return {
          id: e.id, name: e.name, date: e.start_date, past: e.end_date < today,
          attendance: att, revenue, cost: c, net,
          perHead: att && att > 0 ? net / att : null,
        }
      })
      setStats(rows)
      setLoading(false)
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function analyze() {
    if (analyzing) return
    setAnalyzing(true); setError(null)
    try {
      const { data: playbook } = await db.from("playbook_entries").select("category, title, body").order("sort_order")
      const history = stats.filter((s) => s.past).map(({ id: _id, ...r }) => r)
      const upcoming = stats.filter((s) => !s.past).map(({ id: _id, ...r }) => r)
      const res = await fetch("/api/insights", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history, upcoming, playbook }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Analysis failed")
      setNarrative(json.narrative)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    }
    setAnalyzing(false)
  }

  const past = stats.filter((s) => s.past)
  const withMoney = past.filter((s) => s.revenue > 0 || s.cost > 0)
  const totalNet = withMoney.reduce((a, s) => a + s.net, 0)
  const avgAttendance = past.filter((s) => s.attendance).length
    ? Math.round(past.filter((s) => s.attendance).reduce((a, s) => a + (s.attendance || 0), 0) / past.filter((s) => s.attendance).length)
    : null
  const perHeads = withMoney.filter((s) => s.perHead != null).map((s) => s.perHead as number)
  const avgPerHead = perHeads.length ? perHeads.reduce((a, b) => a + b, 0) / perHeads.length : null
  const maxAbsNet = Math.max(1, ...stats.map((s) => Math.abs(s.net)))

  if (loading) return <div style={s.skeleton} />

  return (
    <div>
      <div style={s.intro}>
        <div style={s.introIcon}><BarChart3 size={16} strokeWidth={2} /></div>
        <div>
          <div style={s.introTitle}>Insights</div>
          <div style={s.introSub}>Your real track record across every event — and a forecast built from it, not from guesses.</div>
        </div>
      </div>

      {past.length === 0 ? (
        <div style={s.empty}>
          <Users size={20} strokeWidth={1.6} style={{ color: "var(--muted)" }} />
          <span>No past events yet. Once an event wraps (or you backfill history with real numbers), insights appear here.</span>
        </div>
      ) : (
        <>
          {/* Summary band */}
          <div style={s.summaryRow}>
            <SummaryCard label="Past events" value={String(past.length)} />
            <SummaryCard label="Total net" value={`${totalNet < 0 ? "−" : ""}€${Math.abs(Math.round(totalNet)).toLocaleString("en-US")}`} tone={totalNet >= 0 ? "pos" : "neg"} />
            <SummaryCard label="Avg attendance" value={avgAttendance ? avgAttendance.toLocaleString("en-US") : "—"} />
            <SummaryCard label="Net / head" value={avgPerHead != null ? `${avgPerHead < 0 ? "−" : ""}€${Math.abs(avgPerHead).toFixed(1)}` : "—"} tone={avgPerHead != null ? (avgPerHead >= 0 ? "pos" : "neg") : undefined} />
          </div>

          {/* Per-event comparison */}
          <div style={s.section}>
            <div style={s.sectionTitle}>Event by event</div>
            {stats.map((e) => (
              <div key={e.id} style={s.eventRow}>
                <div style={s.eventLeft}>
                  <span style={s.eventName}>{e.name}</span>
                  <span style={s.eventMeta}>
                    {new Date(e.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                    {e.attendance ? ` · ${e.attendance} ppl` : ""}
                    {!e.past && " · upcoming"}
                  </span>
                </div>
                <div style={s.barWrap}>
                  <div style={s.barTrack}>
                    <div style={{
                      ...s.bar,
                      width: `${(Math.abs(e.net) / maxAbsNet) * 100}%`,
                      background: e.net >= 0 ? "var(--green)" : "var(--red)",
                    }} />
                  </div>
                </div>
                <span style={{ ...s.eventNet, color: e.net > 0 ? "var(--green)" : e.net < 0 ? "var(--red)" : "var(--muted)" }} className="tnum">
                  {e.revenue === 0 && e.cost === 0 ? "—" : `${e.net < 0 ? "−" : "+"}€${Math.abs(Math.round(e.net)).toLocaleString("en-US")}`}
                </span>
              </div>
            ))}
          </div>

          {/* AI forecast */}
          <div style={s.forecast}>
            {!narrative ? (
              <div style={s.forecastEmpty}>
                <div style={s.introIcon}><Sparkles size={16} strokeWidth={2} /></div>
                <div style={{ flex: 1 }}>
                  <div style={s.introTitle}>Forecast & analysis</div>
                  <div style={s.introSub}>Claude reads your history + Playbook and tells you what&apos;s working, what&apos;s bleeding, and what to expect next.</div>
                </div>
                <button style={s.analyzeBtn} onClick={analyze} disabled={analyzing} type="button">
                  {analyzing ? <Loader size={15} style={{ animation: "lk-spin 0.8s linear infinite" }} /> : <Sparkles size={15} strokeWidth={2.2} />}
                  {analyzing ? "Analyzing…" : "Analyze"}
                </button>
              </div>
            ) : (
              <div>
                <div style={s.forecastHead}>
                  <Sparkles size={15} strokeWidth={2} style={{ color: "var(--accent)" }} />
                  <span style={{ fontWeight: 600 }}>Analysis</span>
                  <button style={s.regen} onClick={analyze} disabled={analyzing} type="button">{analyzing ? "…" : "Regenerate"}</button>
                </div>
                <div style={s.narrative}>{narrative}</div>
              </div>
            )}
            {error && <div style={s.error}>{error}</div>}
          </div>
        </>
      )}
    </div>
  )
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  return (
    <div style={s.summaryCard}>
      <div style={s.summaryLabel}>{label}</div>
      <div style={{ ...s.summaryValue, color: tone === "pos" ? "var(--green)" : tone === "neg" ? "var(--red)" : "var(--text)" }} className="tnum">{value}</div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  skeleton: { height: 360, background: "var(--inset)", borderRadius: "var(--radius)" },
  intro: { display: "flex", gap: 12, background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "14px 16px", marginBottom: 18, boxShadow: "var(--shadow-sm)" },
  introIcon: { width: 34, height: 34, borderRadius: 9, flexShrink: 0, background: "var(--accent-tint)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" },
  introTitle: { fontFamily: "var(--font-fraunces), serif", fontSize: 15, fontWeight: 600, color: "var(--text)", marginBottom: 3 },
  introSub: { fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.5 },
  empty: { display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "40px 24px", textAlign: "center", background: "var(--card)", border: "1px dashed var(--border-strong)", borderRadius: "var(--radius)", color: "var(--text-2)", fontSize: 13, maxWidth: 420, margin: "0 auto" },
  summaryRow: { display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" },
  summaryCard: { flex: 1, minWidth: 130, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "13px 15px", boxShadow: "var(--shadow-sm)" },
  summaryLabel: { fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 },
  summaryValue: { fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" },
  section: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "14px 16px", marginBottom: 18, boxShadow: "var(--shadow-sm)" },
  sectionTitle: { fontFamily: "var(--font-fraunces), serif", fontSize: 16, fontWeight: 600, color: "var(--text)", marginBottom: 12 },
  eventRow: { display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderTop: "1px solid var(--border)" },
  eventLeft: { width: 160, flexShrink: 0, display: "flex", flexDirection: "column", gap: 2 },
  eventName: { fontSize: 13, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  eventMeta: { fontSize: 11, color: "var(--muted)" },
  barWrap: { flex: 1, minWidth: 0 },
  barTrack: { height: 8, background: "var(--bg-2)", borderRadius: 4, overflow: "hidden" },
  bar: { height: "100%", borderRadius: 4, minWidth: 2 },
  eventNet: { width: 76, textAlign: "right", fontSize: 13.5, fontWeight: 700, flexShrink: 0 },
  forecast: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "16px", boxShadow: "var(--shadow-sm)" },
  forecastEmpty: { display: "flex", alignItems: "center", gap: 12 },
  analyzeBtn: { display: "flex", alignItems: "center", gap: 7, background: "var(--accent)", color: "#fff", border: "none", borderRadius: 9, padding: "10px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0 },
  forecastHead: { display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--text-2)", marginBottom: 12 },
  regen: { marginLeft: "auto", background: "var(--inset)", border: "1px solid var(--border)", color: "var(--text-2)", fontSize: 11.5, fontWeight: 600, borderRadius: 7, padding: "5px 10px", cursor: "pointer" },
  narrative: { fontSize: 13.5, lineHeight: 1.65, color: "var(--text)", whiteSpace: "pre-wrap" },
  error: { fontSize: 12.5, color: "var(--red)", background: "var(--red-tint)", borderRadius: 8, padding: "9px 11px", marginTop: 10 },
}
