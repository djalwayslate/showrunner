"use client"

import { useState, useRef, useEffect } from "react"
import { ArrowUp, Loader, Sparkles } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

type Message = { role: "user" | "assistant"; content: string }

const SUGGESTIONS = [
  "How many guests on Saturday?",
  "What's the total planned artist fee?",
  "Who are the headliners?",
  "Which day is busiest?",
]

export default function AskTab({ eventId }: { eventId: string }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const db = createClient()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  async function gatherContext() {
    const [{ data: settings }, { data: people }, { data: days }, { data: lineup }, { data: budget }, { data: tasks }] = await Promise.all([
      db.from("hosp_settings").select("*").eq("event_id", eventId).single(),
      db.from("hosp_people").select("*").eq("event_id", eventId),
      db.from("hosp_person_days").select("person_id, day"),
      db.from("lineup_entries").select("*").eq("event_id", eventId).order("sort_order"),
      db.from("budget_items").select("*").eq("event_id", eventId).order("sort_order"),
      db.from("tasks").select("title, phase, owner, due_date, status").eq("event_id", eventId),
    ])
    const dayMap: Record<string, number[]> = {}
    days?.forEach((r) => { if (!dayMap[r.person_id]) dayMap[r.person_id] = []; dayMap[r.person_id].push(r.day) })
    const peopleWithDays = (people ?? []).map((p) => ({ ...p, days: (dayMap[p.id] ?? []).sort((a: number, b: number) => a - b) }))
    return { settings, people: peopleWithDays, lineup, budget, tasks }
  }

  async function gatherPlaybook() {
    const { data } = await db.from("playbook_entries").select("category, title, body").order("sort_order")
    return data ?? []
  }

  async function send(text?: string) {
    const q = (text ?? input).trim()
    if (!q || loading) return
    setInput("")
    setMessages((prev) => [...prev, { role: "user", content: q }])
    setLoading(true)
    try {
      const [ctx, playbook] = await Promise.all([gatherContext(), gatherPlaybook()])
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, context: ctx, history: messages, playbook }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Ask failed")
      setMessages((prev) => [...prev, { role: "assistant", content: json.answer }])
    } catch (err: unknown) {
      setMessages((prev) => [...prev, { role: "assistant", content: `Sorry — ${err instanceof Error ? err.message : "something went wrong"}.` }])
    }
    setLoading(false)
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <div style={s.root}>
      {messages.length === 0 ? (
        <div style={s.intro}>
          <div style={s.introIcon}><Sparkles size={20} strokeWidth={1.8} /></div>
          <div style={s.introTitle}>Ask about this event</div>
          <div style={s.introSub}>
            Answers come only from your live data — headcounts, fees, lineup, budget. No invented numbers.
          </div>
          <div style={s.suggestions}>
            {SUGGESTIONS.map((q) => (
              <button key={q} style={s.suggestion} onClick={() => send(q)} type="button">{q}</button>
            ))}
          </div>
        </div>
      ) : (
        <div style={s.thread}>
          {messages.map((m, i) => (
            <div key={i} style={m.role === "user" ? s.userRow : s.botRow}>
              {m.role === "assistant" && <div style={s.botAvatar}><Sparkles size={13} strokeWidth={2} /></div>}
              <div style={{ ...s.bubble, ...(m.role === "user" ? s.userBubble : s.botBubble) }}>{m.content}</div>
            </div>
          ))}
          {loading && (
            <div style={s.botRow}>
              <div style={s.botAvatar}><Sparkles size={13} strokeWidth={2} /></div>
              <div style={{ ...s.bubble, ...s.botBubble, display: "flex", alignItems: "center" }}>
                <Loader size={14} style={{ animation: "lk-spin 0.8s linear infinite", color: "var(--muted)" }} />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      <div style={s.composer}>
        <textarea
          style={s.textarea}
          placeholder="Ask anything about your event data…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          rows={1}
          disabled={loading}
        />
        <button style={{ ...s.sendBtn, ...(input.trim() && !loading ? {} : s.sendDisabled) }} onClick={() => send()} disabled={!input.trim() || loading} type="button">
          <ArrowUp size={17} strokeWidth={2.4} />
        </button>
      </div>
      <div style={s.hint}>Grounded in your live data · Enter to send, Shift+Enter for a new line</div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  root: { display: "flex", flexDirection: "column", gap: 14 },
  intro: {
    display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
    padding: "36px 24px", background: "var(--card)", border: "1px solid var(--border)",
    borderRadius: "var(--radius)", boxShadow: "var(--shadow-sm)",
  },
  introIcon: {
    width: 48, height: 48, borderRadius: 13, marginBottom: 12,
    background: "var(--accent-tint)", color: "var(--accent)",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  introTitle: { fontFamily: "var(--font-fraunces), serif", fontSize: 19, fontWeight: 600, color: "var(--text)", marginBottom: 6 },
  introSub: { fontSize: 13, color: "var(--text-2)", maxWidth: 360, lineHeight: 1.55, marginBottom: 18 },
  suggestions: { display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  suggestion: {
    background: "var(--inset)", border: "1px solid var(--border)", color: "var(--text-2)",
    fontSize: 12.5, fontWeight: 500, borderRadius: 999, padding: "7px 14px", cursor: "pointer",
    transition: "background 0.15s, color 0.15s",
  },
  thread: {
    display: "flex", flexDirection: "column", gap: 14, maxHeight: 440, overflowY: "auto",
    padding: "4px 2px",
  },
  userRow: { display: "flex", justifyContent: "flex-end" },
  botRow: { display: "flex", gap: 9, alignItems: "flex-start" },
  botAvatar: {
    width: 26, height: 26, borderRadius: 8, flexShrink: 0, marginTop: 2,
    background: "var(--accent-tint)", color: "var(--accent)",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  bubble: { padding: "11px 14px", borderRadius: 14, fontSize: 14, lineHeight: 1.55, maxWidth: "82%", whiteSpace: "pre-wrap" },
  userBubble: { background: "var(--accent)", color: "#fff", borderBottomRightRadius: 5 },
  botBubble: { background: "var(--card)", color: "var(--text)", border: "1px solid var(--border)", borderBottomLeftRadius: 5 },
  composer: {
    display: "flex", alignItems: "flex-end", gap: 8,
    background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14,
    padding: 8, boxShadow: "var(--shadow-sm)",
  },
  textarea: {
    flex: 1, background: "transparent", border: "none", color: "var(--text)",
    fontSize: 14.5, padding: "8px 8px", resize: "none", outline: "none", maxHeight: 120, lineHeight: 1.5,
  },
  sendBtn: {
    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
    background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s, opacity 0.15s",
  },
  sendDisabled: { opacity: 0.35, cursor: "default" },
  hint: { fontSize: 11.5, color: "var(--muted)", textAlign: "center" },
}
