"use client"

import { useState, useEffect, useRef } from "react"
import { ArrowUp, Loader, Sparkles, ListChecks, Mic2, Wallet, Bed, AlertCircle, ArrowRight, Paperclip, X, Check } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { EventRow, TabKey } from "@/lib/types"

type Proposal = { target: "hosp" | "lineup" | "budget" | "guests"; summary?: string; rows: Record<string, unknown>[] }
type Msg = { role: "user" | "assistant"; content: string; proposal?: Proposal | null; saved?: boolean }
type Attachment = { name: string; image?: string; imageMime?: string; fileText?: string }

export default function HomeTab({
  event, eventId, refreshKey, onGoTo,
}: { event: EventRow; eventId: string; refreshKey: number; onGoTo: (t: TabKey) => void }) {
  const [stats, setStats] = useState({ taskDone: 0, taskTotal: 0, taskOverdue: 0, acts: 0, pending: 0, netP: 0, netA: 0, guestDays: 0 })
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [attachment, setAttachment] = useState<Attachment | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const db = createClient()

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type.startsWith("image/")) {
      const buf = await file.arrayBuffer()
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)))
      setAttachment({ name: file.name, image: b64, imageMime: file.type })
    } else {
      const text = await file.text()
      setAttachment({ name: file.name, fileText: text })
    }
    if (fileRef.current) fileRef.current.value = ""
  }

  async function saveProposal(i: number, p: Proposal) {
    try {
      if (p.target === "hosp") {
        for (const r of p.rows) {
          const { data: person } = await db.from("hosp_people")
            .insert({ event_id: eventId, name: r.name ?? "Unknown", count: Number(r.count) || 1, room: r.room ?? "Single", role: r.role ?? "", sort_order: 999 })
            .select().single()
          if (person && Array.isArray(r.days) && r.days.length)
            await db.from("hosp_person_days").insert((r.days as number[]).map((d) => ({ person_id: person.id, day: d })))
        }
      } else if (p.target === "lineup") {
        await db.from("lineup_entries").insert(p.rows.map((r, j) => ({
          event_id: eventId, name: r.name ?? "Act", role: r.role ?? "Support",
          start_time: r.start_time ?? null, end_time: r.end_time ?? null, fee: Number(r.fee) || 0,
          status: r.status ?? "Pending", stage: r.stage ?? "", day_date: r.day_date ?? null, sort_order: 999 + j,
        })))
      } else if (p.target === "guests") {
        await db.from("guests").insert(p.rows.map((r, j) => ({
          event_id: eventId, name: r.name ?? "New guest", ticket_type: r.ticket_type ?? "Paper",
          plus_ones: Number(r.plus_ones) || 0, added_by: r.added_by ?? "", status: "Accepted", attended: false, sort_order: 999 + j,
        })))
      } else {
        await db.from("budget_items").insert(p.rows.map((r, j) => ({
          event_id: eventId, type: r.type ?? "cost", label: r.label ?? "Item",
          planned: Number(r.planned) || 0, actual: Number(r.actual) || 0, sort_order: 999 + j,
        })))
      }
      setMessages((prev) => prev.map((m, j) => (j === i ? { ...m, saved: true } : m)))
    } catch {
      setMessages((prev) => prev.map((m, j) => (j === i ? { ...m, content: m.content + "\n\n(Couldn't save — try again.)" } : m)))
    }
  }

  useEffect(() => {
    async function load() {
      const today = new Date().toISOString().slice(0, 10)
      const [{ data: tasks }, { data: lineup }, { data: budget }, { data: days }] = await Promise.all([
        db.from("tasks").select("status, due_date").eq("event_id", eventId),
        db.from("lineup_entries").select("status").eq("event_id", eventId),
        db.from("budget_items").select("type, planned, actual").eq("event_id", eventId),
        db.from("hosp_person_days").select("person_id").in("person_id",
          (await db.from("hosp_people").select("id").eq("event_id", eventId)).data?.map((p) => p.id) ?? ["00000000-0000-0000-0000-000000000000"]),
      ])
      const taskTotal = tasks?.length ?? 0
      const taskDone = tasks?.filter((t) => t.status === "done").length ?? 0
      const taskOverdue = tasks?.filter((t) => t.status !== "done" && t.due_date && t.due_date < today).length ?? 0
      const acts = lineup?.length ?? 0
      const pending = lineup?.filter((l) => l.status === "Pending").length ?? 0
      let revP = 0, revA = 0, costP = 0, costA = 0
      ;(budget ?? []).forEach((b) => {
        if (b.type === "revenue") { revP += Number(b.planned) || 0; revA += Number(b.actual) || 0 }
        else { costP += Number(b.planned) || 0; costA += Number(b.actual) || 0 }
      })
      setStats({ taskDone, taskTotal, taskOverdue, acts, pending, netP: revP - costP, netA: revA - costA, guestDays: days?.length ?? 0 })
    }
    if (eventId) load()
  }, [eventId, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages])

  async function gather() {
    const [{ data: settings }, { data: people }, { data: pdays }, { data: lineup }, { data: budget }, { data: tasks }, { data: playbook }] = await Promise.all([
      db.from("hosp_settings").select("*").eq("event_id", eventId).single(),
      db.from("hosp_people").select("*").eq("event_id", eventId),
      db.from("hosp_person_days").select("person_id, day"),
      db.from("lineup_entries").select("*").eq("event_id", eventId).order("start_time"),
      db.from("budget_items").select("*").eq("event_id", eventId).order("sort_order"),
      db.from("tasks").select("title, phase, owner, due_date, status").eq("event_id", eventId),
      db.from("playbook_entries").select("category, title, body").order("sort_order"),
    ])
    const dayMap: Record<string, number[]> = {}
    pdays?.forEach((r) => { if (!dayMap[r.person_id]) dayMap[r.person_id] = []; dayMap[r.person_id].push(r.day) })
    return {
      context: { event, settings, people: (people ?? []).map((p) => ({ ...p, days: dayMap[p.id] ?? [] })), lineup, budget, tasks },
      playbook: playbook ?? [],
    }
  }

  async function send(text?: string) {
    const q = (text ?? input).trim()
    const att = attachment
    if ((!q && !att) || loading) return
    setInput("")
    setAttachment(null)
    setMessages((p) => [...p, { role: "user", content: att ? `${q || "Read this and add what's useful."}  📎 ${att.name}` : q }])
    setLoading(true)
    try {
      const { context, playbook } = await gather()
      const res = await fetch("/api/brain", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, context, history: messages, playbook, image: att?.image, imageMime: att?.imageMime, fileText: att?.fileText }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "failed")
      setMessages((p) => [...p, { role: "assistant", content: json.answer, proposal: json.proposal ?? null }])
    } catch (err: unknown) {
      setMessages((p) => [...p, { role: "assistant", content: `Sorry — ${err instanceof Error ? err.message : "something went wrong"}.` }])
    }
    setLoading(false)
  }

  // Proactive "what's next" — derived from real state
  const nudges: { text: string; tab: TabKey; warn?: boolean }[] = []
  if (stats.taskTotal === 0) nudges.push({ text: "No plan yet — auto-plan this event", tab: "planner" })
  if (stats.taskOverdue > 0) nudges.push({ text: `${stats.taskOverdue} task${stats.taskOverdue > 1 ? "s" : ""} overdue`, tab: "planner", warn: true })
  if (stats.acts === 0) nudges.push({ text: "Build the timetable", tab: "lineup" })
  if (stats.pending > 0) nudges.push({ text: `${stats.pending} booking${stats.pending > 1 ? "s" : ""} still pending`, tab: "lineup", warn: true })
  if (stats.netP < 0) nudges.push({ text: `Budget is €${Math.abs(Math.round(stats.netP)).toLocaleString("en-US")} under — review`, tab: "budget", warn: true })

  const start = new Date(event.start_date + "T00:00:00")
  const daysOut = Math.ceil((start.getTime() - Date.now()) / 86400000)

  const cards = [
    { icon: ListChecks, label: "Planner", value: `${stats.taskDone}/${stats.taskTotal}`, sub: "tasks done", tab: "planner" as TabKey },
    { icon: Mic2, label: "Lineup", value: String(stats.acts), sub: stats.pending ? `${stats.pending} pending` : "acts", tab: "lineup" as TabKey },
    { icon: Wallet, label: "Budget net", value: `${stats.netP < 0 ? "−" : ""}€${Math.abs(Math.round(stats.netP)).toLocaleString("en-US")}`, sub: "planned", tab: "budget" as TabKey },
    { icon: Bed, label: "Hospitality", value: String(stats.guestDays), sub: "guest-days", tab: "hosp" as TabKey },
  ]

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Hero */}
      <div style={s.hero}>
        {event.poster_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.poster_url} alt="" style={s.heroPoster} onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={s.heroName}>{event.name}</div>
          <div style={s.heroMeta}>
            {start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
            {event.venue ? ` · ${event.venue}` : ""}
            {event.attendance ? ` · ${event.attendance} expected` : ""}
          </div>
          {daysOut >= 0 && <div style={s.heroCountdown}>{daysOut === 0 ? "Today" : `${daysOut} day${daysOut > 1 ? "s" : ""} out`}</div>}
        </div>
      </div>

      {/* Status cards */}
      <div style={s.cardRow}>
        {cards.map((c) => (
          <button key={c.label} style={s.statCard} onClick={() => onGoTo(c.tab)} type="button">
            <div style={s.statTop}><c.icon size={14} strokeWidth={2} style={{ color: "var(--muted)" }} /><span style={s.statLabel}>{c.label}</span></div>
            <div style={s.statValue} className="tnum">{c.value}</div>
            <div style={s.statSub}>{c.sub}</div>
          </button>
        ))}
      </div>

      {/* What's next */}
      {nudges.length > 0 && (
        <div style={s.nudges}>
          <div style={s.nudgeLabel}>What needs you</div>
          {nudges.map((n, i) => (
            <button key={i} style={s.nudge} onClick={() => onGoTo(n.tab)} type="button">
              {n.warn ? <AlertCircle size={14} strokeWidth={2.2} style={{ color: "var(--accent)" }} /> : <Sparkles size={14} strokeWidth={2} style={{ color: "var(--accent)" }} />}
              <span style={{ flex: 1 }}>{n.text}</span>
              <ArrowRight size={14} strokeWidth={2} style={{ color: "var(--muted)" }} />
            </button>
          ))}
        </div>
      )}

      {/* Master chat */}
      <div style={s.chatCard}>
        <div style={s.chatHead}>
          <div style={s.chatIcon}><Sparkles size={15} strokeWidth={2} /></div>
          <div>
            <div style={s.chatTitle}>Ask anything about {event.name}</div>
            <div style={s.chatSub}>Grounded in your live data + Playbook</div>
          </div>
        </div>

        {messages.length > 0 && (
          <div style={s.thread}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: 7, alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "92%" }}>
                <div style={{ ...s.bubble, ...(m.role === "user" ? s.userBubble : s.botBubble) }}>{m.content}</div>
                {m.proposal && m.proposal.rows?.length > 0 && (
                  <div style={s.proposal}>
                    <div style={s.proposalText}>
                      <Sparkles size={13} strokeWidth={2} style={{ color: "var(--accent)" }} />
                      {m.proposal.summary || `${m.proposal.rows.length} rows for ${m.proposal.target}`}
                    </div>
                    {m.saved ? (
                      <span style={s.savedTag}><Check size={13} strokeWidth={2.4} /> Added</span>
                    ) : (
                      <button style={s.proposalBtn} onClick={() => saveProposal(i, m.proposal!)} type="button">
                        Add {m.proposal.rows.length} to {m.proposal.target === "hosp" ? "Hosp" : m.proposal.target === "lineup" ? "Lineup" : m.proposal.target === "guests" ? "Guests" : "Budget"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
            {loading && <div style={{ ...s.bubble, ...s.botBubble, alignSelf: "flex-start" }}><Loader size={13} style={{ animation: "lk-spin 0.8s linear infinite", color: "var(--muted)" }} /></div>}
            <div ref={bottomRef} />
          </div>
        )}

        {messages.length === 0 && (
          <div style={s.suggestions}>
            {["What should I focus on next?", "How's the budget looking?", "Who still needs a contract?"].map((q) => (
              <button key={q} style={s.suggestion} onClick={() => send(q)} type="button">{q}</button>
            ))}
          </div>
        )}

        {attachment && (
          <div style={s.attachChip}>
            <Paperclip size={13} strokeWidth={2} />
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{attachment.name}</span>
            <button style={s.attachRemove} onClick={() => setAttachment(null)} type="button"><X size={13} strokeWidth={2.2} /></button>
          </div>
        )}
        <div style={s.composer}>
          <input ref={fileRef} type="file" accept="image/*,.csv,.tsv,.txt" style={{ display: "none" }} onChange={handleFile} />
          <button style={s.attachBtn} onClick={() => fileRef.current?.click()} title="Attach a screenshot or file" type="button">
            <Paperclip size={17} strokeWidth={2} />
          </button>
          <textarea
            style={s.textarea}
            placeholder={attachment ? "Add a note (optional)…" : "Ask, or drop a screenshot to add data…"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() } }}
            rows={1}
            disabled={loading}
          />
          <button style={{ ...s.sendBtn, ...((input.trim() || attachment) && !loading ? {} : { opacity: 0.35 }) }} onClick={() => send()} disabled={(!input.trim() && !attachment) || loading} type="button">
            <ArrowUp size={17} strokeWidth={2.4} />
          </button>
        </div>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  hero: { display: "flex", alignItems: "center", gap: 14, background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "14px 16px", boxShadow: "var(--shadow-sm)" },
  heroPoster: { width: 60, height: 60, borderRadius: 11, objectFit: "cover", border: "1px solid var(--border)", flexShrink: 0 },
  heroName: { fontFamily: "var(--font-fraunces), serif", fontSize: 19, fontWeight: 600, color: "var(--text)", lineHeight: 1.15 },
  heroMeta: { fontSize: 12.5, color: "var(--text-2)", marginTop: 3 },
  heroCountdown: { display: "inline-block", marginTop: 8, fontSize: 11.5, fontWeight: 600, color: "var(--accent)", background: "var(--accent-tint)", borderRadius: 999, padding: "3px 11px" },
  cardRow: { display: "flex", gap: 10, flexWrap: "wrap" },
  statCard: { flex: 1, minWidth: 130, textAlign: "left", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px", boxShadow: "var(--shadow-sm)", cursor: "pointer" },
  statTop: { display: "flex", alignItems: "center", gap: 6, marginBottom: 7 },
  statLabel: { fontSize: 11.5, fontWeight: 600, color: "var(--muted)" },
  statValue: { fontSize: 20, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em", lineHeight: 1 },
  statSub: { fontSize: 11, color: "var(--muted)", marginTop: 3 },
  nudges: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "12px 14px", boxShadow: "var(--shadow-sm)" },
  nudgeLabel: { fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 },
  nudge: { display: "flex", alignItems: "center", gap: 9, width: "100%", background: "transparent", border: "none", borderTop: "1px solid var(--border)", padding: "10px 2px", fontSize: 13.5, color: "var(--text)", cursor: "pointer", textAlign: "left", fontWeight: 500 },
  chatCard: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 14, boxShadow: "var(--shadow-sm)" },
  chatHead: { display: "flex", alignItems: "center", gap: 11, marginBottom: 12 },
  chatIcon: { width: 34, height: 34, borderRadius: 9, background: "var(--accent-tint)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  chatTitle: { fontSize: 14, fontWeight: 600, color: "var(--text)" },
  chatSub: { fontSize: 12, color: "var(--muted)" },
  thread: { display: "flex", flexDirection: "column", gap: 10, maxHeight: 340, overflowY: "auto", marginBottom: 12, padding: "2px" },
  bubble: { padding: "10px 13px", borderRadius: 13, fontSize: 13.5, lineHeight: 1.55, maxWidth: "88%", whiteSpace: "pre-wrap" },
  userBubble: { background: "var(--accent)", color: "#fff", borderBottomRightRadius: 4 },
  botBubble: { background: "var(--inset)", color: "var(--text)", border: "1px solid var(--border)", borderBottomLeftRadius: 4 },
  suggestions: { display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 12 },
  suggestion: { background: "var(--inset)", border: "1px solid var(--border)", color: "var(--text-2)", fontSize: 12, fontWeight: 500, borderRadius: 999, padding: "6px 12px", cursor: "pointer" },
  proposal: { display: "flex", alignItems: "center", gap: 10, background: "var(--accent-tint)", borderRadius: 11, padding: "9px 11px", flexWrap: "wrap" },
  proposalText: { display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--text)", fontWeight: 500, flex: 1, minWidth: 140 },
  proposalBtn: { background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8, padding: "7px 13px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
  savedTag: { display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 600, color: "var(--green)" },
  attachChip: { display: "flex", alignItems: "center", gap: 7, background: "var(--inset)", border: "1px solid var(--border)", borderRadius: 9, padding: "7px 10px", fontSize: 12.5, color: "var(--text-2)", marginBottom: 8, maxWidth: 280 },
  attachRemove: { background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer", display: "flex", padding: 0 },
  attachBtn: { width: 34, height: 34, borderRadius: 9, background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  composer: { display: "flex", alignItems: "flex-end", gap: 8, background: "var(--inset)", border: "1px solid var(--border)", borderRadius: 12, padding: 7 },
  textarea: { flex: 1, background: "transparent", border: "none", color: "var(--text)", fontSize: 14, padding: "7px 8px", resize: "none", outline: "none", maxHeight: 120, lineHeight: 1.5 },
  sendBtn: { width: 34, height: 34, borderRadius: 9, background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
}
