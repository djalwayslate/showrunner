"use client"

import { useState, useEffect } from "react"
import { ClipboardList, Check, Wine, Settings2, Package } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { RiderItem } from "@/lib/types"

type Outstanding = { artist: string; cat: RiderItem["category"]; item: string; qty: string }
const CATS: { key: RiderItem["category"]; label: string; icon: React.ElementType }[] = [
  { key: "hospitality", label: "Hospitality", icon: Wine },
  { key: "technical", label: "Technical", icon: Settings2 },
  { key: "other", label: "Other", icon: Package },
]

export default function RiderRollup({ eventId, refreshKey }: { eventId: string; refreshKey: number }) {
  const [outstanding, setOutstanding] = useState<Outstanding[]>([])
  const [total, setTotal] = useState(0)
  const db = createClient()

  useEffect(() => {
    async function load() {
      const { data } = await db.from("lineup_entries").select("name, rider").eq("event_id", eventId)
      const out: Outstanding[] = []
      let tot = 0
      ;(data ?? []).forEach((e) => {
        const rider: RiderItem[] = Array.isArray(e.rider) ? e.rider : []
        rider.forEach((r) => {
          tot++
          if (!r.fulfilled) out.push({ artist: e.name, cat: r.category, item: r.item, qty: r.qty })
        })
      })
      setOutstanding(out)
      setTotal(tot)
    }
    if (eventId) load()
  }, [eventId, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  if (total === 0) return null

  return (
    <section style={s.card}>
      <div style={s.head}>
        <ClipboardList size={15} strokeWidth={2} style={{ color: "var(--accent)" }} />
        <span style={s.title}>Rider needs</span>
        {outstanding.length === 0 ? (
          <span style={s.allDone}><Check size={13} strokeWidth={2.6} /> all {total} fulfilled</span>
        ) : (
          <span style={s.count}>{outstanding.length} outstanding of {total}</span>
        )}
      </div>

      {outstanding.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {CATS.map(({ key, label, icon: Icon }) => {
            const items = outstanding.filter((o) => o.cat === key)
            if (!items.length) return null
            return (
              <div key={key}>
                <div style={s.catHead}><Icon size={13} strokeWidth={2} style={{ color: "var(--muted)" }} /> {label}</div>
                <div style={s.items}>
                  {items.map((o, i) => (
                    <span key={i} style={s.item}>
                      {o.qty && <strong className="tnum">{o.qty}×</strong>} {o.item}
                      <span style={s.artist}>· {o.artist}</span>
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

const s: Record<string, React.CSSProperties> = {
  card: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "14px 16px", boxShadow: "var(--shadow-sm)", marginBottom: 18 },
  head: { display: "flex", alignItems: "center", gap: 8, marginBottom: 12 },
  title: { fontFamily: "var(--font-fraunces), serif", fontSize: 16, fontWeight: 600, color: "var(--text)" },
  count: { marginLeft: "auto", fontSize: 12, fontWeight: 600, color: "var(--accent)", background: "var(--accent-tint)", borderRadius: 6, padding: "2px 9px" },
  allDone: { marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: "var(--green)" },
  catHead: { display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-2)", marginBottom: 6 },
  items: { display: "flex", flexWrap: "wrap", gap: 6 },
  item: { fontSize: 12.5, color: "var(--text)", background: "var(--inset)", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 10px" },
  artist: { color: "var(--muted)", marginLeft: 4 },
}
