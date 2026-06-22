"use client"

import { useState, useEffect } from "react"
import { Plus, Trash2, FunctionSquare, Scale, TrendingUp, Store, StickyNote, BookOpen } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { PlaybookEntry } from "@/lib/types"

const CATEGORIES: { key: PlaybookEntry["category"]; label: string; icon: React.ElementType; hint: string }[] = [
  { key: "formula", label: "Formulas", icon: FunctionSquare, hint: "Your math — multipliers, break-even, ratios" },
  { key: "rule", label: "Rules", icon: Scale, hint: "Standards you always follow" },
  { key: "pattern", label: "Patterns", icon: TrendingUp, hint: "What you've learned about your crowd & events" },
  { key: "vendor", label: "Vendors", icon: Store, hint: "Go-to suppliers, contacts, rates" },
  { key: "note", label: "Notes", icon: StickyNote, hint: "Anything else worth remembering" },
]

export default function PlaybookTab({ refreshKey }: { eventId: string; refreshKey: number }) {
  const [entries, setEntries] = useState<PlaybookEntry[]>([])
  const [loading, setLoading] = useState(true)
  const db = createClient()

  async function load() {
    setLoading(true)
    const { data } = await db.from("playbook_entries").select("*").order("sort_order")
    if (data) setEntries(data)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  async function addEntry(category: PlaybookEntry["category"]) {
    const { data } = await db
      .from("playbook_entries")
      .insert({ category, title: "New entry", body: "", sort_order: entries.length })
      .select()
      .single()
    if (data) setEntries((prev) => [...prev, data])
  }

  async function updateEntry(id: string, patch: Partial<PlaybookEntry>) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)))
    await db.from("playbook_entries").update(patch).eq("id", id)
  }

  async function removeEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id))
    await db.from("playbook_entries").delete().eq("id", id)
  }

  if (loading) return <div style={s.skeleton} />

  return (
    <div>
      <div style={s.intro}>
        <div style={s.introIcon}><BookOpen size={16} strokeWidth={2} /></div>
        <div>
          <div style={s.introTitle}>The Playbook</div>
          <div style={s.introSub}>
            Your formulas, rules and patterns — the Latino Kings way. <strong style={{ color: "var(--text-2)" }}>Ask and the Proposal generator read from this</strong>, so the AI answers with your numbers, not invented ones.
          </div>
        </div>
      </div>

      {CATEGORIES.map(({ key, label, icon: Icon, hint }) => {
        const items = entries.filter((e) => e.category === key)
        return (
          <section key={key} style={s.section}>
            <div style={s.catHead}>
              <div style={s.catTitleWrap}>
                <Icon size={15} strokeWidth={2} style={{ color: "var(--accent)" }} />
                <h2 style={s.catTitle}>{label}</h2>
                <span style={s.catCount}>{items.length}</span>
              </div>
              <button style={s.addCat} onClick={() => addEntry(key)} type="button">
                <Plus size={14} strokeWidth={2.4} /> Add
              </button>
            </div>
            <div style={s.catHint}>{hint}</div>

            {items.length === 0 ? (
              <div style={s.emptyCat}>Nothing here yet.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {items.map((e) => (
                  <div key={e.id} style={s.card}>
                    <div style={s.cardTop}>
                      <input
                        style={s.titleInput}
                        value={e.title}
                        onChange={(ev) => setEntries((prev) => prev.map((x) => (x.id === e.id ? { ...x, title: ev.target.value } : x)))}
                        onBlur={() => db.from("playbook_entries").update({ title: e.title }).eq("id", e.id)}
                      />
                      <button style={s.trashBtn} onClick={() => removeEntry(e.id)} title="Remove" type="button">
                        <Trash2 size={14} strokeWidth={2} />
                      </button>
                    </div>
                    <textarea
                      style={s.bodyInput}
                      placeholder="Write the detail — a formula, a rule, a number, a contact…"
                      value={e.body}
                      rows={2}
                      onChange={(ev) => setEntries((prev) => prev.map((x) => (x.id === e.id ? { ...x, body: ev.target.value } : x)))}
                      onBlur={() => db.from("playbook_entries").update({ body: e.body }).eq("id", e.id)}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  skeleton: { height: 400, background: "var(--inset)", borderRadius: "var(--radius)" },
  intro: {
    display: "flex", gap: 12, background: "var(--card)", border: "1px solid var(--border)",
    borderRadius: "var(--radius)", padding: "14px 16px", marginBottom: 20, boxShadow: "var(--shadow-sm)",
  },
  introIcon: {
    width: 34, height: 34, borderRadius: 9, flexShrink: 0, background: "var(--accent-tint)",
    color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center",
  },
  introTitle: { fontFamily: "var(--font-fraunces), serif", fontSize: 15, fontWeight: 600, color: "var(--text)", marginBottom: 3 },
  introSub: { fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.5 },
  section: { marginBottom: 22 },
  catHead: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 },
  catTitleWrap: { display: "flex", alignItems: "center", gap: 8 },
  catTitle: { fontFamily: "var(--font-fraunces), serif", fontSize: 16, fontWeight: 600, color: "var(--text)", margin: 0 },
  catCount: {
    fontSize: 11, fontWeight: 600, color: "var(--muted)", background: "var(--bg-2)",
    borderRadius: 6, padding: "1px 7px",
  },
  addCat: {
    display: "flex", alignItems: "center", gap: 5, background: "transparent", border: "none",
    color: "var(--accent)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: "4px 6px",
  },
  catHint: { fontSize: 12, color: "var(--muted)", marginBottom: 10 },
  emptyCat: {
    fontSize: 12.5, color: "var(--muted)", padding: "14px", textAlign: "center",
    background: "var(--card)", border: "1px dashed var(--border)", borderRadius: 11,
  },
  card: {
    background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12,
    padding: "11px 13px", boxShadow: "var(--shadow-sm)",
  },
  cardTop: { display: "flex", alignItems: "center", gap: 8, marginBottom: 4 },
  titleInput: {
    flex: 1, minWidth: 0, background: "transparent", border: "1px solid transparent", borderRadius: 7,
    color: "var(--text)", fontSize: 14, fontWeight: 600, padding: "5px 7px", margin: "-5px -7px", outline: "none",
  },
  bodyInput: {
    width: "100%", background: "var(--inset)", border: "1px solid var(--border)", borderRadius: 8,
    color: "var(--text-2)", fontSize: 13, lineHeight: 1.55, padding: "9px 11px", outline: "none",
    resize: "vertical", fontFamily: "inherit", marginTop: 4,
  },
  trashBtn: {
    width: 30, height: 30, borderRadius: 8, background: "transparent", border: "none",
    color: "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
  },
}
