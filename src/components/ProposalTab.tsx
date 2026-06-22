"use client"

import { useState, useEffect } from "react"
import { Sparkles, Loader, Copy, Check, Save, FileText, Trash2, Plus } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { Proposal, EventRow } from "@/lib/types"

export default function ProposalTab({ eventId }: { eventId: string }) {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [active, setActive] = useState<Proposal | null>(null)
  const [audience, setAudience] = useState("")
  const [angle, setAngle] = useState("")
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const db = createClient()

  async function load() {
    setLoading(true)
    const { data } = await db.from("proposals").select("*").eq("event_id", eventId).order("created_at", { ascending: false })
    if (data) setProposals(data)
    setLoading(false)
  }

  useEffect(() => {
    if (eventId) load()
  }, [eventId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function gatherContext() {
    const [{ data: event }, { data: settings }, { data: people }, { data: days }, { data: lineup }, { data: budget }, { data: playbook }] =
      await Promise.all([
        db.from("events").select("*").eq("id", eventId).single(),
        db.from("hosp_settings").select("*").eq("event_id", eventId).single(),
        db.from("hosp_people").select("*").eq("event_id", eventId),
        db.from("hosp_person_days").select("person_id, day"),
        db.from("lineup_entries").select("*").eq("event_id", eventId).order("sort_order"),
        db.from("budget_items").select("*").eq("event_id", eventId).order("sort_order"),
        db.from("playbook_entries").select("category, title, body").order("sort_order"),
      ])
    const dayMap: Record<string, number[]> = {}
    days?.forEach((r) => { if (!dayMap[r.person_id]) dayMap[r.person_id] = []; dayMap[r.person_id].push(r.day) })
    const peopleWithDays = (people ?? []).map((p) => ({ ...p, days: (dayMap[p.id] ?? []).sort((a: number, b: number) => a - b) }))
    return { event: event as EventRow, context: { settings, people: peopleWithDays, lineup, budget }, playbook }
  }

  async function generate() {
    if (generating) return
    setGenerating(true); setError(null)
    try {
      const { event, context, playbook } = await gatherContext()
      const res = await fetch("/api/proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audience, angle, event, context, playbook }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Generation failed")
      const title = audience ? `${event.name} × ${audience}` : `${event.name} — Proposal`
      const { data } = await db
        .from("proposals")
        .insert({ event_id: eventId, title, audience, body: json.body })
        .select()
        .single()
      if (data) {
        setProposals((prev) => [data, ...prev])
        setActive(data)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    }
    setGenerating(false)
  }

  async function saveBody() {
    if (!active) return
    await db.from("proposals").update({ body: active.body, title: active.title }).eq("id", active.id)
    setProposals((prev) => prev.map((p) => (p.id === active.id ? active : p)))
    setSaved(true); setTimeout(() => setSaved(false), 1500)
  }

  async function remove(id: string) {
    setProposals((prev) => prev.filter((p) => p.id !== id))
    if (active?.id === id) setActive(null)
    await db.from("proposals").delete().eq("id", id)
  }

  function copy() {
    if (!active) return
    navigator.clipboard.writeText(active.body)
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }

  if (loading) return <div style={s.skeleton} />

  return (
    <div>
      {/* Generator */}
      <div style={s.gen}>
        <div style={s.genHead}>
          <div style={s.introIcon}><Sparkles size={16} strokeWidth={2} /></div>
          <div>
            <div style={s.introTitle}>Proposal generator</div>
            <div style={s.introSub}>Drafts a sponsor pitch from this event&apos;s real data and your Playbook. You edit before sending.</div>
          </div>
        </div>
        <div style={s.genFields}>
          <input style={s.input} placeholder="Partner / sponsor (e.g. Red Bull, a local brand)" value={audience} onChange={(e) => setAudience(e.target.value)} />
          <input style={s.input} placeholder="Angle or notes (optional)" value={angle} onChange={(e) => setAngle(e.target.value)} />
          <button style={s.genBtn} onClick={generate} disabled={generating} type="button">
            {generating ? <Loader size={15} style={{ animation: "lk-spin 0.8s linear infinite" }} /> : <Sparkles size={15} strokeWidth={2.2} />}
            {generating ? "Writing…" : "Generate"}
          </button>
        </div>
        {error && <div style={s.error}>{error}</div>}
      </div>

      {/* Active proposal editor */}
      {active && (
        <div style={s.editor}>
          <div style={s.editorBar}>
            <input
              style={s.titleInput}
              value={active.title}
              onChange={(e) => setActive({ ...active, title: e.target.value })}
            />
            <div style={{ display: "flex", gap: 6 }}>
              <button style={s.barBtn} onClick={copy} type="button">
                {copied ? <Check size={14} strokeWidth={2.4} /> : <Copy size={14} strokeWidth={2} />}
                {copied ? "Copied" : "Copy"}
              </button>
              <button style={{ ...s.barBtn, ...s.barBtnPrimary }} onClick={saveBody} type="button">
                {saved ? <Check size={14} strokeWidth={2.4} /> : <Save size={14} strokeWidth={2} />}
                {saved ? "Saved" : "Save"}
              </button>
            </div>
          </div>
          <textarea
            style={s.bodyArea}
            value={active.body}
            onChange={(e) => setActive({ ...active, body: e.target.value })}
            rows={18}
          />
        </div>
      )}

      {/* Saved list */}
      {proposals.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <div style={s.sectionHead}>
            <h2 style={s.sectionTitle}>Saved proposals</h2>
            <span style={s.count}>{proposals.length}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {proposals.map((p) => (
              <div key={p.id} style={{ ...s.savedRow, ...(active?.id === p.id ? s.savedActive : {}) }}>
                <button style={s.savedMain} onClick={() => setActive(p)} type="button">
                  <FileText size={15} strokeWidth={2} style={{ color: "var(--accent)", flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={s.savedTitle}>{p.title}</div>
                    <div style={s.savedDate}>{new Date(p.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
                  </div>
                </button>
                <button style={s.trashBtn} onClick={() => remove(p.id)} title="Delete" type="button">
                  <Trash2 size={14} strokeWidth={2} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {proposals.length === 0 && !active && (
        <div style={s.empty}>
          <Plus size={18} strokeWidth={1.8} style={{ color: "var(--muted)" }} />
          <span>No proposals yet. Name a partner above and hit Generate.</span>
        </div>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  skeleton: { height: 300, background: "var(--inset)", borderRadius: "var(--radius)" },
  gen: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "16px", marginBottom: 18, boxShadow: "var(--shadow-sm)" },
  genHead: { display: "flex", gap: 12, marginBottom: 14 },
  introIcon: { width: 34, height: 34, borderRadius: 9, flexShrink: 0, background: "var(--accent-tint)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" },
  introTitle: { fontFamily: "var(--font-fraunces), serif", fontSize: 15, fontWeight: 600, color: "var(--text)", marginBottom: 3 },
  introSub: { fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.5 },
  genFields: { display: "flex", flexDirection: "column", gap: 8 },
  input: { background: "var(--inset)", border: "1px solid var(--border)", borderRadius: 9, color: "var(--text)", fontSize: 13.5, padding: "10px 12px", outline: "none" },
  genBtn: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
    background: "var(--accent)", color: "#fff", border: "none", borderRadius: 9,
    padding: "11px", fontSize: 13.5, fontWeight: 600, cursor: "pointer",
  },
  error: { fontSize: 12.5, color: "var(--red)", background: "var(--red-tint)", borderRadius: 8, padding: "9px 11px", marginTop: 10 },
  editor: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 14, boxShadow: "var(--shadow-sm)" },
  editorBar: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 },
  titleInput: {
    flex: 1, minWidth: 0, background: "transparent", border: "1px solid transparent", borderRadius: 7,
    color: "var(--text)", fontSize: 15, fontWeight: 600, fontFamily: "var(--font-fraunces), serif",
    padding: "5px 7px", margin: "-5px -7px", outline: "none",
  },
  barBtn: {
    display: "flex", alignItems: "center", gap: 5, background: "var(--inset)", border: "1px solid var(--border)",
    color: "var(--text-2)", fontSize: 12.5, fontWeight: 600, borderRadius: 8, padding: "7px 11px", cursor: "pointer",
  },
  barBtnPrimary: { background: "var(--accent)", color: "#fff", border: "1px solid transparent" },
  bodyArea: {
    width: "100%", background: "var(--inset)", border: "1px solid var(--border)", borderRadius: 10,
    color: "var(--text)", fontSize: 13.5, lineHeight: 1.6, padding: "13px 14px", outline: "none",
    resize: "vertical", fontFamily: "var(--font-inter), monospace",
  },
  sectionHead: { display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 },
  sectionTitle: { fontFamily: "var(--font-fraunces), serif", fontSize: 17, fontWeight: 600, color: "var(--text)", margin: 0 },
  count: { fontSize: 11, fontWeight: 600, color: "var(--muted)", background: "var(--bg-2)", borderRadius: 6, padding: "1px 7px" },
  savedRow: {
    display: "flex", alignItems: "center", gap: 8, background: "var(--card)", border: "1px solid var(--border)",
    borderRadius: 11, padding: "4px 6px 4px 4px", boxShadow: "var(--shadow-sm)",
  },
  savedActive: { borderColor: "color-mix(in srgb, var(--accent) 45%, transparent)" },
  savedMain: { display: "flex", alignItems: "center", gap: 10, flex: 1, background: "transparent", border: "none", cursor: "pointer", padding: "8px 8px", textAlign: "left", minWidth: 0 },
  savedTitle: { fontSize: 13.5, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  savedDate: { fontSize: 11.5, color: "var(--muted)" },
  trashBtn: { width: 30, height: 30, borderRadius: 8, background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  empty: {
    display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "32px 20px",
    background: "var(--card)", border: "1px dashed var(--border-strong)", borderRadius: "var(--radius)",
    color: "var(--text-2)", fontSize: 13,
  },
}
