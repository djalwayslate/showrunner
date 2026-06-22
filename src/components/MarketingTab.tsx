"use client"

import { useState, useEffect } from "react"
import { Plus, Trash2, Megaphone, Target, Sparkles, Loader, TrendingUp } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { MarketingSpend } from "@/lib/types"

const CHANNELS = ["Instagram", "Facebook", "TikTok", "Posters", "Influencer", "Other"]

export default function MarketingTab({ eventId, refreshKey }: { eventId: string; refreshKey: number }) {
  const [rows, setRows] = useState<MarketingSpend[]>([])
  const [attendance, setAttendance] = useState<number | null>(null)
  const [revenue, setRevenue] = useState(0)
  const [fixedCosts, setFixedCosts] = useState(0)
  const [loading, setLoading] = useState(true)
  const [tips, setTips] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const db = createClient()

  async function load() {
    setLoading(true)
    const [{ data: m }, { data: ev }, { data: budget }] = await Promise.all([
      db.from("marketing_spend").select("*").eq("event_id", eventId).order("sort_order"),
      db.from("events").select("attendance").eq("id", eventId).single(),
      db.from("budget_items").select("type, planned, actual").eq("event_id", eventId),
    ])
    if (m) setRows(m)
    setAttendance(ev?.attendance ?? null)
    let rev = 0, cost = 0
    ;(budget ?? []).forEach((b) => {
      const v = Number(b.actual) || Number(b.planned) || 0
      if (b.type === "revenue") rev += v
      else cost += v
    })
    setRevenue(rev); setFixedCosts(cost)
    setLoading(false)
  }

  useEffect(() => { if (eventId) load() }, [eventId, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  async function addRow() {
    const { data } = await db.from("marketing_spend")
      .insert({ event_id: eventId, channel: "Instagram", amount: 0, reach: 0, conversions: 0, notes: "", sort_order: rows.length })
      .select().single()
    if (data) setRows((p) => [...p, data])
  }
  async function updateRow(id: string, patch: Partial<MarketingSpend>) {
    setRows((p) => p.map((r) => (r.id === id ? { ...r, ...patch } : r)))
    await db.from("marketing_spend").update(patch).eq("id", id)
  }
  async function removeRow(id: string) {
    setRows((p) => p.filter((r) => r.id !== id))
    await db.from("marketing_spend").delete().eq("id", id)
  }

  async function analyze() {
    if (analyzing) return
    setAnalyzing(true)
    try {
      const today = new Date().toISOString().slice(0, 10)
      const [{ data: ev }, { data: playbook }, { data: events }, { data: budgetAll }] = await Promise.all([
        db.from("events").select("name, attendance, start_date").eq("id", eventId).single(),
        db.from("playbook_entries").select("category, title, body").order("sort_order"),
        db.from("events").select("id, name, attendance, end_date"),
        db.from("budget_items").select("event_id, type, planned, actual"),
      ])
      const history = (events ?? []).filter((e) => e.end_date < today).map((e) => {
        let rev = 0, cost = 0
        ;(budgetAll ?? []).filter((b) => b.event_id === e.id).forEach((b) => {
          const v = Number(b.actual) || Number(b.planned) || 0
          if (b.type === "revenue") rev += v; else cost += v
        })
        return { name: e.name, attendance: e.attendance, revenue: rev, cost, net: rev - cost }
      })
      const res = await fetch("/api/marketing", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: ev, spend: rows, budget: { revenue, fixedCosts }, history, playbook }),
      })
      const json = await res.json()
      if (res.ok) setTips(json.tips)
    } finally { setAnalyzing(false) }
  }

  const totalSpend = rows.reduce((a, r) => a + (Number(r.amount) || 0), 0)
  const totalReach = rows.reduce((a, r) => a + (Number(r.reach) || 0), 0)
  const totalConv = rows.reduce((a, r) => a + (Number(r.conversions) || 0), 0)
  const cpaActual = totalConv > 0 ? totalSpend / totalConv : null
  const pctOfRev = revenue > 0 ? (totalSpend / revenue) * 100 : null

  if (loading) return <div style={s.skeleton} />

  return (
    <div>
      <div style={s.intro}>
        <div style={s.introIcon}><Megaphone size={16} strokeWidth={2} /></div>
        <div>
          <div style={s.introTitle}>Marketing</div>
          <div style={s.introSub}>Log your ad spend by channel, see what each ticket costs you, and work out how much to spend to hit a target.</div>
        </div>
      </div>

      {/* Summary */}
      <div style={s.cards}>
        <Card label="Total spend" value={`€${Math.round(totalSpend).toLocaleString("en-US")}`} />
        <Card label="Cost / ticket" value={cpaActual != null ? `€${cpaActual.toFixed(2)}` : "—"} sub={totalConv > 0 ? `${totalConv} attributed` : "log conversions"} />
        <Card label="Total reach" value={totalReach ? totalReach.toLocaleString("en-US") : "—"} />
        <Card label="% of revenue" value={pctOfRev != null ? `${pctOfRev.toFixed(0)}%` : "—"} />
      </div>

      {/* Spend log */}
      <div style={s.section}>
        <div style={s.sectionHead}>
          <h2 style={s.sectionTitle}>Spend by channel</h2>
        </div>
        {rows.length === 0 ? (
          <div style={s.empty}>No spend logged yet. Add your first channel.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rows.map((r) => (
              <div key={r.id} style={s.row}>
                <select style={s.channel} value={r.channel} onChange={(e) => updateRow(r.id, { channel: e.target.value })}>
                  {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <Num label="Spend" prefix="€" value={r.amount} onChange={(v) => updateRow(r.id, { amount: v })} />
                <Num label="Reach" value={r.reach} onChange={(v) => updateRow(r.id, { reach: v })} />
                <Num label="Tickets" value={r.conversions} onChange={(v) => updateRow(r.id, { conversions: v })} />
                <span style={s.rowCpa} className="tnum">{r.conversions > 0 ? `€${(r.amount / r.conversions).toFixed(2)}/tkt` : "—"}</span>
                <button style={s.trash} onClick={() => removeRow(r.id)} type="button"><Trash2 size={14} strokeWidth={2} /></button>
              </div>
            ))}
          </div>
        )}
        <button style={s.addBtn} onClick={addRow} type="button"><Plus size={14} strokeWidth={2.2} /> Add channel</button>
      </div>

      {/* Spend-to-earn calculator */}
      <Calculator cpaActual={cpaActual} ticketHint={revenue > 0 && attendance ? revenue / attendance : null} fixedCosts={fixedCosts} />

      {/* AI tips */}
      <div style={s.tipsCard}>
        {!tips ? (
          <div style={s.tipsEmpty}>
            <div style={s.introIcon}><Sparkles size={16} strokeWidth={2} /></div>
            <div style={{ flex: 1 }}>
              <div style={s.introTitle}>Marketing tips</div>
              <div style={s.introSub}>Claude reviews your spend + history + Playbook and tells you where to put the money.</div>
            </div>
            <button style={s.analyzeBtn} onClick={analyze} disabled={analyzing} type="button">
              {analyzing ? <Loader size={15} style={{ animation: "lk-spin 0.8s linear infinite" }} /> : <Sparkles size={15} strokeWidth={2.2} />}
              {analyzing ? "Thinking…" : "Get tips"}
            </button>
          </div>
        ) : (
          <div>
            <div style={s.tipsHead}><Sparkles size={15} strokeWidth={2} style={{ color: "var(--accent)" }} /><span style={{ fontWeight: 600 }}>Tips</span>
              <button style={s.regen} onClick={analyze} disabled={analyzing} type="button">{analyzing ? "…" : "Refresh"}</button>
            </div>
            <div style={s.tipsText}>{tips}</div>
          </div>
        )}
      </div>
    </div>
  )
}

function Calculator({ cpaActual, ticketHint, fixedCosts }: { cpaActual: number | null; ticketHint: number | null; fixedCosts: number }) {
  const [price, setPrice] = useState(Math.round(ticketHint || 20))
  const [cpa, setCpa] = useState(cpaActual != null ? Number(cpaActual.toFixed(2)) : 3)
  const [targetNet, setTargetNet] = useState(1000)

  const roas = cpa > 0 ? price / cpa : 0 // revenue per €1 of ad spend
  const netPerEuro = roas - 1
  const profitable = price > cpa
  const requiredSpend = profitable ? targetNet / netPerEuro : Infinity
  const ticketsNeeded = profitable ? requiredSpend / cpa : Infinity

  return (
    <section style={s.calc}>
      <div style={s.calcHead}>
        <Target size={15} strokeWidth={2} style={{ color: "var(--accent)" }} />
        <h2 style={s.sectionTitle}>Spend-to-earn</h2>
        <span style={s.calcNote}>how much ad spend to hit a target</span>
      </div>
      <div style={s.calcInputs}>
        <CalcField label="Ticket price" prefix="€" value={price} onChange={setPrice} />
        <CalcField label="Cost / ticket from ads" prefix="€" value={cpa} onChange={setCpa} />
        <CalcField label="Target net from ads" prefix="€" value={targetNet} onChange={setTargetNet} />
      </div>

      {profitable ? (
        <>
          <div style={s.calcResult}>
            <div>
              <div style={s.calcLabel}>Spend ≈</div>
              <div style={s.calcSub}>to net €{targetNet.toLocaleString("en-US")} from ticket sales driven by ads</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={s.calcNum} className="tnum">€{Math.round(requiredSpend).toLocaleString("en-US")}</div>
              <div style={s.calcPct}>≈ {Math.round(ticketsNeeded)} tickets</div>
            </div>
          </div>
          <div style={s.calcStrip}>
            <span><TrendingUp size={13} strokeWidth={2} style={{ color: "var(--green)", verticalAlign: -2 }} /> Every €1 on ads ≈ <strong className="tnum">€{roas.toFixed(2)}</strong> back (<span style={{ color: "var(--green)" }}>+€{netPerEuro.toFixed(2)} net</span>)</span>
          </div>
        </>
      ) : (
        <div style={s.calcWarn}>At €{cpa}/ticket vs a €{price} ticket, ads lose money on each sale. Lower the cost per ticket or raise the price before scaling spend.</div>
      )}
      {fixedCosts > 0 && <div style={s.calcFoot}>Your fixed costs this event are €{Math.round(fixedCosts).toLocaleString("en-US")} — ads are on top of covering those.</div>}
    </section>
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
function Num({ label, value, onChange, prefix }: { label: string; value: number; onChange: (v: number) => void; prefix?: string }) {
  return (
    <div style={s.numWrap}>
      <span style={s.numLabel}>{label}</span>
      <span style={s.numInner}>
        {prefix && <span style={{ color: "var(--muted)", fontSize: 11 }}>{prefix}</span>}
        <input type="number" min={0} className="tnum" style={s.numInput} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      </span>
    </div>
  )
}
function CalcField({ label, value, onChange, prefix }: { label: string; value: number; onChange: (v: number) => void; prefix?: string }) {
  return (
    <label style={s.calcField}>
      <span style={s.calcFieldLabel}>{label}</span>
      <span style={s.calcInputWrap}>
        {prefix && <span style={{ color: "var(--muted)", fontSize: 13 }}>{prefix}</span>}
        <input type="number" min={0} className="tnum" style={s.calcInput} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      </span>
    </label>
  )
}

const s: Record<string, React.CSSProperties> = {
  skeleton: { height: 360, background: "var(--inset)", borderRadius: "var(--radius)" },
  intro: { display: "flex", gap: 12, background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "14px 16px", marginBottom: 18, boxShadow: "var(--shadow-sm)" },
  introIcon: { width: 34, height: 34, borderRadius: 9, flexShrink: 0, background: "var(--accent-tint)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" },
  introTitle: { fontFamily: "var(--font-fraunces), serif", fontSize: 15, fontWeight: 600, color: "var(--text)", marginBottom: 3 },
  introSub: { fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.5 },
  cards: { display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 },
  card: { flex: 1, minWidth: 120, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px", boxShadow: "var(--shadow-sm)" },
  cardLabel: { fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 },
  cardValue: { fontSize: 20, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em", lineHeight: 1 },
  cardSub: { fontSize: 11, color: "var(--muted)", marginTop: 4 },
  section: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "14px 16px", marginBottom: 18, boxShadow: "var(--shadow-sm)" },
  sectionHead: { marginBottom: 12 },
  sectionTitle: { fontFamily: "var(--font-fraunces), serif", fontSize: 17, fontWeight: 600, color: "var(--text)", margin: 0 },
  empty: { fontSize: 13, color: "var(--muted)", padding: "16px", textAlign: "center", background: "var(--inset)", borderRadius: 10 },
  row: { display: "flex", alignItems: "flex-end", gap: 8, flexWrap: "wrap", padding: "8px 0", borderTop: "1px solid var(--border)" },
  channel: { background: "var(--inset)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontSize: 13, fontWeight: 600, padding: "8px 9px", cursor: "pointer", alignSelf: "flex-end" },
  numWrap: { display: "flex", flexDirection: "column", gap: 3 },
  numLabel: { fontSize: 9.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", paddingLeft: 2 },
  numInner: { display: "flex", alignItems: "center", gap: 2, background: "var(--inset)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 9px" },
  numInput: { width: 64, background: "transparent", border: "none", color: "var(--text)", fontSize: 13, outline: "none" },
  rowCpa: { fontSize: 12, fontWeight: 600, color: "var(--text-2)", marginLeft: "auto", alignSelf: "flex-end", paddingBottom: 6 },
  trash: { width: 30, height: 30, borderRadius: 8, background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", alignSelf: "flex-end" },
  addBtn: { display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: "var(--accent)", fontSize: 12.5, fontWeight: 600, padding: "10px 0 2px", cursor: "pointer" },
  calc: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "16px", marginBottom: 18, boxShadow: "var(--shadow-sm)" },
  calcHead: { display: "flex", alignItems: "center", gap: 8, marginBottom: 14 },
  calcNote: { fontSize: 11.5, color: "var(--muted)", marginLeft: "auto" },
  calcInputs: { display: "flex", gap: 9, marginBottom: 14, flexWrap: "wrap" },
  calcField: { flex: 1, minWidth: 110, display: "flex", flexDirection: "column", gap: 5 },
  calcFieldLabel: { fontSize: 11.5, fontWeight: 500, color: "var(--text-2)" },
  calcInputWrap: { display: "flex", alignItems: "center", gap: 3, background: "var(--inset)", border: "1px solid var(--border)", borderRadius: 9, padding: "8px 11px" },
  calcInput: { width: "100%", background: "transparent", border: "none", color: "var(--text)", fontSize: 14, fontWeight: 600, outline: "none" },
  calcResult: { display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--accent-tint)", borderRadius: 11, padding: "13px 15px", marginBottom: 10 },
  calcLabel: { fontSize: 13, fontWeight: 600, color: "var(--text)" },
  calcSub: { fontSize: 11, color: "var(--text-2)", marginTop: 2, maxWidth: 280 },
  calcNum: { fontSize: 24, fontWeight: 700, color: "var(--accent)", lineHeight: 1, letterSpacing: "-0.02em" },
  calcPct: { fontSize: 11.5, fontWeight: 600, color: "var(--text-2)", marginTop: 3 },
  calcStrip: { fontSize: 12.5, color: "var(--text-2)" },
  calcWarn: { fontSize: 13, color: "var(--red)", background: "var(--red-tint)", borderRadius: 10, padding: "12px 14px", lineHeight: 1.5 },
  calcFoot: { fontSize: 11.5, color: "var(--muted)", marginTop: 10 },
  tipsCard: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "16px", boxShadow: "var(--shadow-sm)" },
  tipsEmpty: { display: "flex", alignItems: "center", gap: 12 },
  analyzeBtn: { display: "flex", alignItems: "center", gap: 7, background: "var(--accent)", color: "#fff", border: "none", borderRadius: 9, padding: "10px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0 },
  tipsHead: { display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--text-2)", marginBottom: 12 },
  regen: { marginLeft: "auto", background: "var(--inset)", border: "1px solid var(--border)", color: "var(--text-2)", fontSize: 11.5, fontWeight: 600, borderRadius: 7, padding: "5px 10px", cursor: "pointer" },
  tipsText: { fontSize: 13.5, lineHeight: 1.65, color: "var(--text)", whiteSpace: "pre-wrap" },
}
