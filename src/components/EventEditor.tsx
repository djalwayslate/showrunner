"use client"

import { useState } from "react"
import { X, Trash2, Image as ImageIcon, Link2, Calendar, Clock, Sparkles, Loader, Wand2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { EventRow } from "@/lib/types"

type Props = {
  event: EventRow | null // null = create
  canDelete: boolean
  onSaved: (e: EventRow, isNew: boolean) => void
  onDeleted: (id: string) => void
  onClose: () => void
}

export default function EventEditor({ event, canDelete, onSaved, onDeleted, onClose }: Props) {
  const isNew = !event
  const [name, setName] = useState(event?.name ?? "")
  const [venue, setVenue] = useState(event?.venue ?? "")
  const [start, setStart] = useState(event?.start_date ?? "")
  const [end, setEnd] = useState(event?.end_date ?? "")
  const [startTime, setStartTime] = useState(event?.start_time ?? "")
  const [attendance, setAttendance] = useState(event?.attendance != null ? String(event.attendance) : "")
  const [poster, setPoster] = useState(event?.poster_url ?? "")
  const [description, setDescription] = useState(event?.description ?? "")
  const [ticket, setTicket] = useState(event?.ticket_url ?? "")
  const [drive, setDrive] = useState(event?.drive_url ?? "")
  const [fb, setFb] = useState(event?.fb_url ?? "")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importUrl, setImportUrl] = useState("")
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const db = createClient()

  async function importFromLink() {
    if (!importUrl || importing) return
    setImporting(true); setImportMsg(null); setError(null)
    try {
      const res = await fetch("/api/event-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: importUrl }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Import failed")
      const d = json.data ?? {}
      const filled: string[] = []
      if (d.name) { setName(d.name); filled.push("name") }
      if (d.venue) { setVenue(d.venue); filled.push("venue") }
      if (d.start_date) { setStart(d.start_date); filled.push("date") }
      if (d.end_date) setEnd(d.end_date)
      else if (d.start_date) setEnd(d.start_date)
      if (d.start_time) { setStartTime(d.start_time); filled.push("time") }
      if (d.description) { setDescription(d.description); filled.push("blurb") }
      if (d.poster_url) { setPoster(d.poster_url); filled.push("poster") }
      if (/facebook\.com/i.test(importUrl)) setFb(importUrl)
      else if (/ra\.co|residentadvisor/i.test(importUrl)) setTicket(importUrl)
      else setTicket(importUrl)
      const lineupNote = Array.isArray(d.lineup) && d.lineup.length ? ` · found ${d.lineup.length} artists (${d.lineup.slice(0, 3).join(", ")}${d.lineup.length > 3 ? "…" : ""})` : ""
      setImportMsg(filled.length ? `Filled in: ${filled.join(", ")}${lineupNote}. Check and tweak below.` : "Couldn't read much from that link — fill it in manually.")
    } catch (err: unknown) {
      setImportMsg(err instanceof Error ? err.message : "Import failed")
    }
    setImporting(false)
  }

  async function save() {
    if (!name || !start || !end) {
      setError("Name, start and end dates are required.")
      return
    }
    setBusy(true); setError(null)
    const payload = {
      name, venue: venue || null, start_date: start, end_date: end, start_time: startTime || null,
      attendance: attendance ? Number(attendance) : null,
      poster_url: poster || null, description: description || null,
      ticket_url: ticket || null, drive_url: drive || null, fb_url: fb || null,
    }

    if (isNew) {
      const { data: org } = await db.from("org_settings").select("default_stages, default_drinks, default_food").eq("id", 1).single()
      const stages = Array.isArray(org?.default_stages) && org!.default_stages.length ? org!.default_stages : ["Main Stage"]
      const { data, error } = await db.from("events").insert({ ...payload, stages }).select().single()
      if (error || !data) { setBusy(false); setError(error?.message ?? "Could not save."); return }
      await db.from("hosp_settings").insert({ event_id: data.id, drinks_per_person: org?.default_drinks ?? 4, food_per_person: org?.default_food ?? 1 })
      const seed = [
        ["revenue", "Door", 1], ["revenue", "Sponsorship", 2], ["revenue", "Merch", 3], ["revenue", "Bar split", 4],
        ["cost", "Artist fees", 1], ["cost", "Venue rent", 2], ["cost", "Hospitality", 3], ["cost", "Production", 4], ["cost", "Marketing", 5],
      ].map(([type, label, ord]) => ({ event_id: data.id, type, label, planned: 0, actual: 0, sort_order: ord as number }))
      await db.from("budget_items").insert(seed)
      setBusy(false)
      onSaved(data, true)
    } else {
      const { data, error } = await db.from("events").update(payload).eq("id", event!.id).select().single()
      if (error || !data) { setBusy(false); setError(error?.message ?? "Could not save."); return }
      setBusy(false)
      onSaved(data, false)
    }
  }

  async function remove() {
    if (!event) return
    if (!confirm(`Delete "${event.name}" and all its data? This can't be undone.`)) return
    setBusy(true)
    const { error } = await db.from("events").delete().eq("id", event.id)
    if (error) { setBusy(false); setError(error.message); return }
    onDeleted(event.id)
  }

  return (
    <div style={s.overlay} onMouseDown={onClose}>
      <div style={s.modal} onMouseDown={(e) => e.stopPropagation()}>
        <div style={s.head}>
          <h2 style={s.title}>{isNew ? "New event" : "Edit event"}</h2>
          <button style={s.closeBtn} onClick={onClose} type="button"><X size={17} strokeWidth={2} /></button>
        </div>

        <div style={s.body}>
          {/* Import from a link */}
          <div style={s.importCard}>
            <div style={s.importTop}>
              <Wand2 size={15} strokeWidth={2} style={{ color: "var(--accent)" }} />
              <span style={s.importTitle}>Paste a link — fill it for me</span>
            </div>
            <div style={s.importRow}>
              <input
                style={s.importInput}
                placeholder="Facebook event, ra.co, or ticket link…"
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), importFromLink())}
              />
              <button style={s.importBtn} onClick={importFromLink} disabled={importing || !importUrl} type="button">
                {importing ? <Loader size={14} style={{ animation: "lk-spin 0.8s linear infinite" }} /> : <Sparkles size={14} strokeWidth={2.2} />}
                {importing ? "Reading…" : "Fetch"}
              </button>
            </div>
            {importMsg && <div style={s.importMsg}>{importMsg}</div>}
          </div>

          <div style={s.divider} />

          <Field label="Event name">
            <input style={s.input} placeholder="Latino Kings x …" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <Field label="Venue">
            <input style={s.input} placeholder="Venue (optional)" value={venue} onChange={(e) => setVenue(e.target.value)} />
          </Field>
          <div style={{ display: "flex", gap: 10 }}>
            <Field label="Start date" icon={Calendar}>
              <input type="date" style={s.input} value={start} onChange={(e) => setStart(e.target.value)} />
            </Field>
            <Field label="End date" icon={Calendar}>
              <input type="date" style={s.input} value={end} onChange={(e) => setEnd(e.target.value)} />
            </Field>
            <Field label="Doors" icon={Clock}>
              <input type="time" style={s.input} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </Field>
          </div>

          <Field label="Attendance (total crowd — powers forecasting)">
            <input type="number" min={0} style={s.input} placeholder="e.g. 450" value={attendance} onChange={(e) => setAttendance(e.target.value)} />
          </Field>

          <div style={s.divider} />

          <Field label="Poster image URL" icon={ImageIcon}>
            <input style={s.input} placeholder="https://… (paste an image or Drive link)" value={poster} onChange={(e) => setPoster(e.target.value)} />
          </Field>
          {poster && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={poster} alt="poster" style={s.posterPreview} onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
          )}
          <Field label="Description / blurb">
            <textarea style={{ ...s.input, resize: "vertical", minHeight: 60 }} rows={3} placeholder="Short description for promo & proposals…" value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>

          <div style={s.divider} />

          <Field label="Ticket link" icon={Link2}>
            <input style={s.input} placeholder="https://…" value={ticket} onChange={(e) => setTicket(e.target.value)} />
          </Field>
          <Field label="Google Drive folder" icon={Link2}>
            <input style={s.input} placeholder="https://drive.google.com/…" value={drive} onChange={(e) => setDrive(e.target.value)} />
          </Field>
          <Field label="Facebook event" icon={Link2}>
            <input style={s.input} placeholder="https://facebook.com/events/…" value={fb} onChange={(e) => setFb(e.target.value)} />
          </Field>

          {error && <div style={s.error}>{error}</div>}
        </div>

        <div style={s.foot}>
          {!isNew && canDelete ? (
            <button style={s.deleteBtn} onClick={remove} disabled={busy} type="button">
              <Trash2 size={14} strokeWidth={2} /> Delete
            </button>
          ) : <span />}
          <div style={{ display: "flex", gap: 8 }}>
            <button style={s.cancelBtn} onClick={onClose} type="button">Cancel</button>
            <button style={s.saveBtn} onClick={save} disabled={busy} type="button">{busy ? "Saving…" : isNew ? "Create event" : "Save changes"}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, icon: Icon, children }: { label: string; icon?: React.ElementType; children: React.ReactNode }) {
  return (
    <label style={s.field}>
      <span style={s.fieldLabel}>{Icon && <Icon size={12} strokeWidth={2} style={{ color: "var(--muted)" }} />}{label}</span>
      {children}
    </label>
  )
}

const s: Record<string, React.CSSProperties> = {
  overlay: { position: "fixed", inset: 0, background: "rgba(28,27,23,0.32)", backdropFilter: "blur(2px)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", zIndex: 100, overflowY: "auto" },
  modal: { background: "var(--card)", borderRadius: 18, width: "100%", maxWidth: 460, boxShadow: "var(--shadow-lg)", animation: "lk-fade-up 0.2s ease both", border: "1px solid var(--border)" },
  head: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px", borderBottom: "1px solid var(--border)" },
  title: { fontFamily: "var(--font-fraunces), serif", fontSize: 18, fontWeight: 600, color: "var(--text)", margin: 0 },
  closeBtn: { width: 30, height: 30, borderRadius: 8, background: "var(--inset)", border: "none", color: "var(--text-2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  body: { padding: "18px 20px", display: "flex", flexDirection: "column", gap: 13 },
  importCard: { background: "var(--accent-tint)", borderRadius: 12, padding: "12px 13px" },
  importTop: { display: "flex", alignItems: "center", gap: 7, marginBottom: 9 },
  importTitle: { fontSize: 13, fontWeight: 600, color: "var(--text)" },
  importRow: { display: "flex", gap: 7 },
  importInput: { flex: 1, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 9, color: "var(--text)", fontSize: 13.5, padding: "9px 11px", outline: "none" },
  importBtn: { display: "flex", alignItems: "center", gap: 6, background: "var(--accent)", color: "#fff", border: "none", borderRadius: 9, padding: "9px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0 },
  importMsg: { fontSize: 12, color: "var(--text-2)", marginTop: 8, lineHeight: 1.45 },
  field: { display: "flex", flexDirection: "column", gap: 5, flex: 1 },
  fieldLabel: { display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "var(--text-2)" },
  input: { background: "var(--inset)", border: "1px solid var(--border)", borderRadius: 9, color: "var(--text)", fontSize: 13.5, padding: "10px 12px", outline: "none", fontFamily: "inherit", width: "100%" },
  posterPreview: { width: "100%", maxHeight: 160, objectFit: "cover", borderRadius: 10, border: "1px solid var(--border)" },
  divider: { height: 1, background: "var(--border)", margin: "2px 0" },
  error: { fontSize: 12.5, color: "var(--red)", background: "var(--red-tint)", borderRadius: 8, padding: "9px 11px" },
  foot: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderTop: "1px solid var(--border)" },
  deleteBtn: { display: "flex", alignItems: "center", gap: 5, background: "transparent", border: "none", color: "var(--red)", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  cancelBtn: { background: "var(--inset)", border: "1px solid var(--border)", color: "var(--text-2)", borderRadius: 9, padding: "10px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer" },
  saveBtn: { background: "var(--accent)", color: "#fff", border: "none", borderRadius: 9, padding: "10px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" },
}
