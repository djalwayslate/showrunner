"use client"

import { useState, useEffect } from "react"
import { Plus, Trash2, Lock, TrendingUp, TrendingDown, Target, ChevronRight, ListTree } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { BudgetItem, BudgetSubItem } from "@/lib/types"

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

function subTotal(s: BudgetSubItem) {
  const base = (Number(s.fee) || 0) + (Number(s.rider) || 0)
  return s.payment === "invoice" ? base * (1 + (Number(s.tax_rate) || 0) / 100) : base
}
function breakdownTotal(b: BudgetSubItem[]) {
  return (b ?? []).reduce((a, s) => a + subTotal(s), 0)
}

export default function BudgetTab({
  eventId, refreshKey, canEdit,
}: { eventId: string; refreshKey: number; canEdit: boolean }) {
  const [items, setItems] = useState<BudgetItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const db = createClient()

  async function load() {
    setLoading(true)
    const { data } = await db.from("budget_items").select("*").eq("event_id", eventId).order("sort_order")
    if (data) setItems(data.map((i) => ({ ...i, breakdown: i.breakdown ?? [] })))
    setLoading(false)
  }

  useEffect(() => {
    if (eventId) load()
  }, [eventId, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  async function addItem(type: "revenue" | "cost") {
    if (!canEdit) return
    const { data } = await db
      .from("budget_items")
      .insert({ event_id: eventId, type, label: "New line", planned: 0, actual: 0, sort_order: items.filter((i) => i.type === type).length })
      .select().single()
    if (data) setItems((prev) => [...prev, { ...data, breakdown: data.breakdown ?? [] }])
  }

  async function updateItem(id: string, patch: Partial<BudgetItem>) {
    if (!canEdit) return
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)))
    await db.from("budget_items").update(patch).eq("id", id)
  }

  async function removeItem(id: string) {
    if (!canEdit) return
    setItems((prev) => prev.filter((i) => i.id !== id))
    await db.from("budget_items").delete().eq("id", id)
  }

  // Breakdown ops — persist breakdown jsonb + derived actual together
  async function setBreakdown(id: string, breakdown: BudgetSubItem[]) {
    if (!canEdit) return
    const actual = breakdownTotal(breakdown)
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, breakdown, actual } : i)))
    await db.from("budget_items").update({ breakdown, actual }).eq("id", id)
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  const revenue = items.filter((i) => i.type === "revenue")
  const costs = items.filter((i) => i.type === "cost")
  const sum = (rows: BudgetItem[], k: "planned" | "actual") => rows.reduce((a, r) => a + (Number(r[k]) || 0), 0)
  const revP = sum(revenue, "planned"), revA = sum(revenue, "actual")
  const costP = sum(costs, "planned"), costA = sum(costs, "actual")
  const netP = revP - costP, netA = revA - costA

  if (loading) return <div style={s.skeleton} />

  return (
    <div>
      {!canEdit && (
        <div style={s.readonly}><Lock size={13} strokeWidth={2} /> Budget is read-only for your role.</div>
      )}

      <Section
        title="Revenue" rows={revenue} expanded={expanded} canEdit={canEdit}
        onUpdate={updateItem} onAdd={() => addItem("revenue")} onRemove={removeItem}
        onToggle={toggleExpand} onSetBreakdown={setBreakdown}
      />
      <div style={{ height: 18 }} />
      <Section
        title="Costs" rows={costs} expanded={expanded} canEdit={canEdit}
        onUpdate={updateItem} onAdd={() => addItem("cost")} onRemove={removeItem}
        onToggle={toggleExpand} onSetBreakdown={setBreakdown}
      />

      <div style={s.netRow}>
        <NetCard label="Net · Planned" value={netP} />
        <NetCard label="Net · Actual" value={netA} />
      </div>

      <Projections
        fixedCosts={costP}
        otherRevenue={revenue.filter((r) => !/door|ticket/i.test(r.label)).reduce((a, r) => a + (Number(r.planned) || 0), 0)}
      />
    </div>
  )
}

function Section({
  title, rows, expanded, canEdit, onUpdate, onAdd, onRemove, onToggle, onSetBreakdown,
}: {
  title: string
  rows: BudgetItem[]
  expanded: Set<string>
  canEdit: boolean
  onUpdate: (id: string, patch: Partial<BudgetItem>) => void
  onAdd: () => void
  onRemove: (id: string) => void
  onToggle: (id: string) => void
  onSetBreakdown: (id: string, b: BudgetSubItem[]) => void
}) {
  const totalP = rows.reduce((a, r) => a + (Number(r.planned) || 0), 0)
  const totalA = rows.reduce((a, r) => a + (Number(r.actual) || 0), 0)

  return (
    <section style={s.section}>
      <div style={s.sectionHead}>
        <h2 style={s.sectionTitle}>{title}</h2>
        <div style={s.colHeads}><span>Planned</span><span>Actual</span></div>
      </div>

      <div>
        {rows.map((r) => {
          const hasBreakdown = (r.breakdown?.length ?? 0) > 0
          const isOpen = expanded.has(r.id)
          return (
            <div key={r.id}>
              <div style={s.row}>
                <button
                  style={{ ...s.expandBtn, ...(isOpen ? { transform: "rotate(90deg)" } : {}), ...(hasBreakdown ? { color: "var(--accent)" } : {}) }}
                  onClick={() => onToggle(r.id)}
                  title="Itemize"
                  type="button"
                >
                  <ChevronRight size={15} strokeWidth={2.2} />
                </button>
                <input
                  style={s.labelInput}
                  value={r.label}
                  disabled={!canEdit}
                  onChange={(e) => onUpdate(r.id, { label: e.target.value })}
                />
                <EuroInput value={Number(r.planned)} disabled={!canEdit} onChange={(v) => onUpdate(r.id, { planned: v })} />
                <EuroInput value={Number(r.actual)} disabled={!canEdit || hasBreakdown} derived={hasBreakdown} onChange={(v) => onUpdate(r.id, { actual: v })} accent />
                {canEdit ? (
                  <button style={s.trashBtn} onClick={() => onRemove(r.id)} title="Remove" type="button">
                    <Trash2 size={14} strokeWidth={2} />
                  </button>
                ) : <span style={{ width: 30 }} />}
              </div>

              {isOpen && (
                <Breakdown
                  item={r}
                  canEdit={canEdit}
                  onChange={(b) => onSetBreakdown(r.id, b)}
                />
              )}
            </div>
          )
        })}
      </div>

      <div style={s.subtotal}>
        <span style={s.subtotalLabel}>Subtotal</span>
        <span style={s.subtotalVal} className="tnum">€{totalP.toLocaleString("en-US")}</span>
        <span style={{ ...s.subtotalVal, color: "var(--text)" }} className="tnum">€{Math.round(totalA).toLocaleString("en-US")}</span>
        <span style={{ width: 30 }} />
      </div>

      {canEdit && (
        <button style={s.addLine} onClick={onAdd} type="button"><Plus size={14} strokeWidth={2.2} /> Add line</button>
      )}
    </section>
  )
}

function Breakdown({ item, canEdit, onChange }: { item: BudgetItem; canEdit: boolean; onChange: (b: BudgetSubItem[]) => void }) {
  const list = item.breakdown ?? []

  function patch(id: string, p: Partial<BudgetSubItem>) {
    onChange(list.map((s) => (s.id === id ? { ...s, ...p } : s)))
  }
  function add() {
    onChange([...list, { id: uid(), label: "", fee: 0, rider: 0, payment: "cash", tax_rate: 15 }])
  }
  function remove(id: string) {
    onChange(list.filter((s) => s.id !== id))
  }

  return (
    <div style={s.breakdown}>
      <div style={s.bdHint}>
        <ListTree size={12} strokeWidth={2} />
        Itemize this line — each entry rolls up into Actual{item.breakdown.length > 0 ? ` (€${Math.round(breakdownTotal(list)).toLocaleString("en-US")})` : ""}
      </div>
      {list.map((sub) => {
        const total = subTotal(sub)
        return (
          <div key={sub.id} style={s.bdRow}>
            <input
              style={s.bdName}
              placeholder="Artist / vendor"
              value={sub.label}
              disabled={!canEdit}
              onChange={(e) => patch(sub.id, { label: e.target.value })}
            />
            <BdNum label="Fee" value={sub.fee} disabled={!canEdit} onChange={(v) => patch(sub.id, { fee: v })} />
            <BdNum label="Rider" value={sub.rider} disabled={!canEdit} onChange={(v) => patch(sub.id, { rider: v })} />
            <div style={s.payToggle}>
              <button
                style={{ ...s.payBtn, ...(sub.payment === "cash" ? s.payOn : {}) }}
                onClick={() => canEdit && patch(sub.id, { payment: "cash" })}
                type="button"
              >Cash</button>
              <button
                style={{ ...s.payBtn, ...(sub.payment === "invoice" ? s.payOn : {}) }}
                onClick={() => canEdit && patch(sub.id, { payment: "invoice" })}
                type="button"
              >Invoice</button>
            </div>
            {sub.payment === "invoice" && (
              <div style={s.taxWrap} title="VAT added on invoice">
                <input
                  type="number" min={0} className="tnum" style={s.taxInput}
                  value={sub.tax_rate} disabled={!canEdit}
                  onChange={(e) => patch(sub.id, { tax_rate: Number(e.target.value) })}
                />
                <span style={{ fontSize: 11, color: "var(--muted)" }}>% VAT</span>
              </div>
            )}
            <span style={s.bdTotal} className="tnum">€{Math.round(total).toLocaleString("en-US")}</span>
            {canEdit && (
              <button style={s.bdTrash} onClick={() => remove(sub.id)} type="button" title="Remove">
                <Trash2 size={13} strokeWidth={2} />
              </button>
            )}
          </div>
        )
      })}
      {canEdit && (
        <button style={s.bdAdd} onClick={add} type="button"><Plus size={13} strokeWidth={2.2} /> Add entry</button>
      )}
    </div>
  )
}

function BdNum({ label, value, onChange, disabled }: { label: string; value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <div style={s.bdNumWrap}>
      <span style={s.bdNumLabel}>{label}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 2 }}>
        <span style={{ color: "var(--muted)", fontSize: 11 }}>€</span>
        <input type="number" min={0} className="tnum" style={s.bdNumInput} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} />
      </span>
    </div>
  )
}

function EuroInput({
  value, onChange, disabled, accent, derived,
}: { value: number; onChange: (v: number) => void; disabled?: boolean; accent?: boolean; derived?: boolean }) {
  return (
    <div style={{ ...s.euro, ...(disabled ? { background: "transparent", borderColor: "transparent" } : {}), ...(derived ? { background: "var(--accent-tint)", borderColor: "transparent" } : {}) }} title={derived ? "Calculated from the breakdown below" : undefined}>
      <span style={{ color: "var(--muted)", fontSize: 12 }}>€</span>
      <input
        type="number" disabled={disabled} className="tnum"
        style={{ ...s.euroInput, color: accent ? "var(--text)" : "var(--text-2)", fontWeight: accent ? 600 : 500 }}
        value={derived ? Math.round(value) : value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}

function NetCard({ label, value }: { label: string; value: number }) {
  const positive = value >= 0
  return (
    <div style={{ ...s.netCard, ...(positive ? s.netPos : s.netNeg) }}>
      <div style={s.netLabelRow}>
        {positive ? <TrendingUp size={14} strokeWidth={2.2} /> : <TrendingDown size={14} strokeWidth={2.2} />}
        <span style={s.netLabel}>{label}</span>
      </div>
      <span style={s.netValue} className="tnum">{value < 0 ? "−" : ""}€{Math.abs(Math.round(value)).toLocaleString("en-US")}</span>
    </div>
  )
}

function Projections({ fixedCosts, otherRevenue }: { fixedCosts: number; otherRevenue: number }) {
  const [price, setPrice] = useState(20)
  const [capacity, setCapacity] = useState(300)
  const [varCost, setVarCost] = useState(0)

  const contribution = Math.max(0.01, price - varCost)
  const netFixed = Math.max(0, fixedCosts - otherRevenue)
  const breakEven = Math.ceil(netFixed / contribution)
  const breakEvenPct = capacity > 0 ? Math.round((breakEven / capacity) * 100) : 0
  const scenarios = [0.5, 0.75, 1].map((pct) => {
    const tickets = Math.round(capacity * pct)
    const net = tickets * price + otherRevenue - fixedCosts - tickets * varCost
    return { pct, tickets, net }
  })

  return (
    <section style={s.proj}>
      <div style={s.projHead}>
        <Target size={15} strokeWidth={2} style={{ color: "var(--accent)" }} />
        <h2 style={s.sectionTitle}>Projections</h2>
        <span style={s.projNote}>live math on your planned budget</span>
      </div>
      <div style={s.projInputs}>
        <ProjInput label="Ticket price" prefix="€" value={price} onChange={setPrice} />
        <ProjInput label="Venue capacity" value={capacity} onChange={setCapacity} />
        <ProjInput label="Cost / head" prefix="€" value={varCost} onChange={setVarCost} />
      </div>
      <div style={s.breakeven}>
        <div>
          <div style={s.beLabel}>Break-even door count</div>
          <div style={s.beSub}>covers €{Math.round(fixedCosts).toLocaleString("en-US")} costs{otherRevenue > 0 ? `, offset by €${Math.round(otherRevenue).toLocaleString("en-US")} other revenue` : ""}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={s.beNum} className="tnum">{breakEven.toLocaleString("en-US")}</div>
          <div style={{ ...s.bePct, color: breakEvenPct > 100 ? "var(--red)" : breakEvenPct > 70 ? "var(--gold)" : "var(--green)" }}>{breakEvenPct}% of capacity</div>
        </div>
      </div>
      <div style={s.scenarios}>
        {scenarios.map(({ pct, tickets, net }) => (
          <div key={pct} style={s.scenario}>
            <div style={s.scLabel}>{Math.round(pct * 100)}% full</div>
            <div style={s.scTickets} className="tnum">{tickets} guests</div>
            <div style={{ ...s.scNet, color: net >= 0 ? "var(--green)" : "var(--red)" }} className="tnum">{net < 0 ? "−" : "+"}€{Math.abs(Math.round(net)).toLocaleString("en-US")}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

function ProjInput({ label, value, onChange, prefix }: { label: string; value: number; onChange: (v: number) => void; prefix?: string }) {
  return (
    <label style={s.projField}>
      <span style={s.projFieldLabel}>{label}</span>
      <span style={s.projInputWrap}>
        {prefix && <span style={{ color: "var(--muted)", fontSize: 13 }}>{prefix}</span>}
        <input type="number" min={0} className="tnum" style={s.projInput} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      </span>
    </label>
  )
}

const s: Record<string, React.CSSProperties> = {
  skeleton: { height: 300, background: "var(--inset)", borderRadius: "var(--radius)" },
  readonly: { display: "flex", alignItems: "center", gap: 7, background: "var(--inset)", border: "1px solid var(--border)", borderRadius: 9, padding: "9px 12px", fontSize: 12.5, color: "var(--text-2)", marginBottom: 16 },
  section: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "14px 16px", boxShadow: "var(--shadow-sm)" },
  sectionHead: { display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 10, borderBottom: "1px solid var(--border)", marginBottom: 4 },
  sectionTitle: { fontFamily: "var(--font-fraunces), serif", fontSize: 17, fontWeight: 600, color: "var(--text)", margin: 0 },
  colHeads: { display: "flex", gap: 30, fontSize: 10.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, paddingRight: 38 },
  row: { display: "flex", alignItems: "center", gap: 8, padding: "7px 0" },
  expandBtn: { width: 22, height: 22, borderRadius: 6, background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "transform 0.15s" },
  labelInput: { flex: 1, minWidth: 0, background: "transparent", border: "1px solid transparent", borderRadius: 7, color: "var(--text)", fontSize: 13.5, fontWeight: 500, padding: "6px 8px", margin: "0 -8px 0 0", outline: "none" },
  euro: { display: "flex", alignItems: "center", gap: 2, width: 96, background: "var(--inset)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 9px" },
  euroInput: { width: "100%", background: "transparent", border: "none", fontSize: 13, outline: "none" },
  subtotal: { display: "flex", alignItems: "center", gap: 8, paddingTop: 11, marginTop: 5, borderTop: "1px solid var(--border)" },
  subtotalLabel: { flex: 1, fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", paddingLeft: 22 },
  subtotalVal: { width: 96, fontSize: 13.5, fontWeight: 600, color: "var(--muted)", padding: "0 9px", textAlign: "left" },
  addLine: { display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: "var(--accent)", fontSize: 12.5, fontWeight: 600, padding: "10px 0 2px 22px", cursor: "pointer" },

  breakdown: { background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 11, padding: "11px 12px", margin: "2px 0 8px 22px" },
  bdHint: { display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--muted)", marginBottom: 10, fontWeight: 500 },
  bdRow: { display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", padding: "5px 0", borderTop: "1px solid var(--border)" },
  bdName: { flex: "1 1 130px", minWidth: 100, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 7, color: "var(--text)", fontSize: 13, fontWeight: 500, padding: "7px 9px", outline: "none" },
  bdNumWrap: { display: "flex", flexDirection: "column", gap: 2 },
  bdNumLabel: { fontSize: 9.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", paddingLeft: 2 },
  bdNumInput: { width: 56, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 7, color: "var(--text)", fontSize: 12.5, padding: "5px 7px", outline: "none" },
  payToggle: { display: "flex", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 7, padding: 2, alignSelf: "flex-end" },
  payBtn: { background: "transparent", border: "none", borderRadius: 5, padding: "5px 9px", fontSize: 11.5, fontWeight: 600, color: "var(--muted)", cursor: "pointer" },
  payOn: { background: "var(--accent)", color: "#fff" },
  taxWrap: { display: "flex", alignItems: "center", gap: 4, alignSelf: "flex-end" },
  taxInput: { width: 42, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 7, color: "var(--text)", fontSize: 12.5, padding: "5px 6px", outline: "none" },
  bdTotal: { marginLeft: "auto", alignSelf: "flex-end", fontSize: 13.5, fontWeight: 700, color: "var(--text)", minWidth: 64, textAlign: "right" },
  bdTrash: { width: 26, height: 26, borderRadius: 6, background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", alignSelf: "flex-end" },
  bdAdd: { display: "flex", alignItems: "center", gap: 5, background: "transparent", border: "none", color: "var(--accent)", fontSize: 12, fontWeight: 600, padding: "9px 0 2px", cursor: "pointer" },

  netRow: { display: "flex", gap: 12, marginTop: 18 },
  netCard: { flex: 1, borderRadius: "var(--radius)", padding: "16px 18px", border: "1px solid transparent" },
  netPos: { background: "var(--green-tint)", color: "var(--green)" },
  netNeg: { background: "var(--red-tint)", color: "var(--red)" },
  netLabelRow: { display: "flex", alignItems: "center", gap: 6, marginBottom: 8 },
  netLabel: { fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" },
  netValue: { fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em" },

  proj: { marginTop: 18, background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "16px", boxShadow: "var(--shadow-sm)" },
  projHead: { display: "flex", alignItems: "center", gap: 8, marginBottom: 14 },
  projNote: { fontSize: 11.5, color: "var(--muted)", marginLeft: "auto" },
  projInputs: { display: "flex", gap: 9, marginBottom: 14, flexWrap: "wrap" },
  projField: { flex: 1, minWidth: 100, display: "flex", flexDirection: "column", gap: 5 },
  projFieldLabel: { fontSize: 11.5, fontWeight: 500, color: "var(--text-2)" },
  projInputWrap: { display: "flex", alignItems: "center", gap: 3, background: "var(--inset)", border: "1px solid var(--border)", borderRadius: 9, padding: "8px 11px" },
  projInput: { width: "100%", background: "transparent", border: "none", color: "var(--text)", fontSize: 14, fontWeight: 600, outline: "none" },
  breakeven: { display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-2)", borderRadius: 11, padding: "13px 15px", marginBottom: 12 },
  beLabel: { fontSize: 13, fontWeight: 600, color: "var(--text)" },
  beSub: { fontSize: 11, color: "var(--muted)", marginTop: 2, maxWidth: 320 },
  beNum: { fontSize: 24, fontWeight: 700, color: "var(--text)", lineHeight: 1, letterSpacing: "-0.02em" },
  bePct: { fontSize: 11.5, fontWeight: 600, marginTop: 3 },
  scenarios: { display: "flex", gap: 9 },
  scenario: { flex: 1, background: "var(--inset)", border: "1px solid var(--border)", borderRadius: 11, padding: "11px 12px", textAlign: "center" },
  scLabel: { fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 },
  scTickets: { fontSize: 12.5, color: "var(--text-2)", marginBottom: 4 },
  scNet: { fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em" },
}
