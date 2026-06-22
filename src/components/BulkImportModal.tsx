"use client"

import { useState } from "react"
import { X, Loader, Check, AlertCircle, Link2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { EventRow } from "@/lib/types"

type Result = { url: string; status: "ok" | "fail" | "pending"; name?: string; msg?: string }

export default function BulkImportModal({
  onClose, onCreated,
}: { onClose: () => void; onCreated: (e: EventRow) => void }) {
  const [text, setText] = useState("")
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<Result[]>([])
  const db = createClient()

  async function createEvent(data: Record<string, unknown>, fallbackUrl: string): Promise<EventRow | null> {
    const today = new Date().toISOString().slice(0, 10)
    const payload = {
      name: (data.name as string) || "Imported event",
      venue: (data.venue as string) || null,
      start_date: (data.start_date as string) || today,
      end_date: (data.end_date as string) || (data.start_date as string) || today,
      start_time: (data.start_time as string) || null,
      poster_url: (data.poster_url as string) || null,
      description: (data.description as string) || null,
      fb_url: /facebook\.com/i.test(fallbackUrl) ? fallbackUrl : null,
      ticket_url: /facebook\.com/i.test(fallbackUrl) ? null : fallbackUrl,
    }
    const { data: ev, error } = await db.from("events").insert(payload).select().single()
    if (error || !ev) return null
    await db.from("hosp_settings").insert({ event_id: ev.id, drinks_per_person: 4, food_per_person: 1 })
    const seed = [
      ["revenue", "Door", 1], ["revenue", "Sponsorship", 2], ["revenue", "Merch", 3], ["revenue", "Bar split", 4],
      ["cost", "Artist fees", 1], ["cost", "Venue rent", 2], ["cost", "Hospitality", 3], ["cost", "Production", 4], ["cost", "Marketing", 5],
    ].map(([type, label, ord]) => ({ event_id: ev.id, type, label, planned: 0, actual: 0, sort_order: ord as number }))
    await db.from("budget_items").insert(seed)
    return ev
  }

  async function run() {
    const links = text.split("\n").map((l) => l.trim()).filter((l) => /^https?:\/\//.test(l))
    if (!links.length || running) return
    setRunning(true)
    setResults(links.map((url) => ({ url, status: "pending" })))

    for (let i = 0; i < links.length; i++) {
      const url = links[i]
      try {
        const res = await fetch("/api/event-import", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? "could not read link")
        const ev = await createEvent(json.data ?? {}, url)
        if (!ev) throw new Error("could not save event")
        onCreated(ev)
        setResults((prev) => prev.map((r, j) => (j === i ? { ...r, status: "ok", name: ev.name } : r)))
      } catch (err: unknown) {
        setResults((prev) => prev.map((r, j) => (j === i ? { ...r, status: "fail", msg: err instanceof Error ? err.message : "failed" } : r)))
      }
    }
    setRunning(false)
  }

  const done = results.length > 0 && !running
  const okCount = results.filter((r) => r.status === "ok").length

  return (
    <div style={s.overlay} onMouseDown={onClose}>
      <div style={s.modal} onMouseDown={(e) => e.stopPropagation()}>
        <div style={s.head}>
          <div>
            <h2 style={s.title}>Import past events</h2>
            <div style={s.sub}>Paste FB / RA / ticket links, one per line</div>
          </div>
          <button style={s.closeBtn} onClick={onClose} type="button"><X size={17} strokeWidth={2} /></button>
        </div>

        <div style={s.body}>
          {results.length === 0 ? (
            <textarea
              style={s.textarea}
              rows={8}
              placeholder={"https://facebook.com/events/...\nhttps://ra.co/events/...\nhttps://..."}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          ) : (
            <div style={s.results}>
              {results.map((r, i) => (
                <div key={i} style={s.resultRow}>
                  <span style={s.resultIcon}>
                    {r.status === "pending" && <Loader size={14} style={{ animation: "lk-spin 0.8s linear infinite", color: "var(--muted)" }} />}
                    {r.status === "ok" && <Check size={14} strokeWidth={2.4} style={{ color: "var(--green)" }} />}
                    {r.status === "fail" && <AlertCircle size={14} strokeWidth={2.2} style={{ color: "var(--red)" }} />}
                  </span>
                  <span style={s.resultText}>{r.status === "ok" ? r.name : r.status === "fail" ? r.msg : r.url}</span>
                  <Link2 size={12} strokeWidth={2} style={{ color: "var(--muted)", flexShrink: 0 }} />
                </div>
              ))}
            </div>
          )}
          <div style={s.note}>
            Heads up: private Facebook events usually block reading. RA and ticket links work best. Anything that fails, add manually with New event.
          </div>
        </div>

        <div style={s.foot}>
          {done ? (
            <button style={s.primary} onClick={onClose} type="button">Done · {okCount} added</button>
          ) : (
            <>
              <button style={s.cancel} onClick={onClose} type="button">Cancel</button>
              <button style={s.primary} onClick={run} disabled={running || !text.trim()} type="button">
                {running ? "Importing…" : "Import all"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  overlay: { position: "fixed", inset: 0, background: "rgba(28,27,23,0.32)", backdropFilter: "blur(2px)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", zIndex: 100, overflowY: "auto" },
  modal: { background: "var(--card)", borderRadius: 18, width: "100%", maxWidth: 460, boxShadow: "var(--shadow-lg)", border: "1px solid var(--border)", animation: "lk-fade-up 0.2s ease both" },
  head: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border)" },
  title: { fontFamily: "var(--font-fraunces), serif", fontSize: 18, fontWeight: 600, color: "var(--text)", margin: 0 },
  sub: { fontSize: 12, color: "var(--muted)", marginTop: 2 },
  closeBtn: { width: 30, height: 30, borderRadius: 8, background: "var(--inset)", border: "none", color: "var(--text-2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  body: { padding: "16px 20px" },
  textarea: { width: "100%", background: "var(--inset)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text)", fontSize: 13.5, padding: "11px 12px", outline: "none", resize: "vertical", fontFamily: "var(--font-inter), monospace", lineHeight: 1.6 },
  results: { display: "flex", flexDirection: "column", gap: 6, maxHeight: 280, overflowY: "auto" },
  resultRow: { display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", background: "var(--inset)", borderRadius: 9 },
  resultIcon: { width: 16, display: "flex", justifyContent: "center", flexShrink: 0 },
  resultText: { flex: 1, fontSize: 12.5, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  note: { fontSize: 11.5, color: "var(--muted)", marginTop: 12, lineHeight: 1.5, background: "var(--bg-2)", borderRadius: 9, padding: "10px 12px" },
  foot: { display: "flex", justifyContent: "flex-end", gap: 8, padding: "14px 20px", borderTop: "1px solid var(--border)" },
  cancel: { background: "var(--inset)", border: "1px solid var(--border)", color: "var(--text-2)", borderRadius: 9, padding: "10px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer" },
  primary: { background: "var(--accent)", color: "#fff", border: "none", borderRadius: 9, padding: "10px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" },
}
