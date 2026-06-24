"use client"

import { useState, useEffect, useCallback } from "react"
import { Wand2, Loader, Link2, Check, ChevronDown, ChevronRight, Send, CircleCheck, X, RotateCcw } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import {
  EVENT_CATEGORIES, ARTIST_CATEGORIES, categoryDef,
  type FieldDef, type AdvanceRecipient, type AdvanceRequest, type AdvanceStatus,
} from "@/lib/advancing/schema"
import type { EventRow, LineupEntry } from "@/lib/types"

function newToken(): string {
  const r = () => crypto.randomUUID().replace(/-/g, "")
  return r() + r()
}
function prefillEvent(key: string, ev: EventRow | null): Record<string, unknown> {
  if (key === "stage_room") return { capacity: ev?.attendance ?? "", stage_name: ev?.stages?.[0] ?? "" }
  return {}
}
function prefillArtist(key: string, entry: LineupEntry): Record<string, unknown> {
  if (key === "timetable") return { set_time: entry.start_time && entry.end_time ? `${entry.start_time}–${entry.end_time}` : "" }
  return {}
}
function inputType(t: FieldDef["type"]): string {
  return t === "textarea" || t === "bool" ? "text" : t
}

export default function AdvancingTab({ eventId, refreshKey }: { eventId: string; refreshKey: number }) {
  const [requests, setRequests] = useState<AdvanceRequest[]>([])
  const [recipients, setRecipients] = useState<AdvanceRecipient[]>([])
  const [artists, setArtists] = useState<{ id: string; name: string }[]>([])
  const [forms, setForms] = useState<Record<string, Record<string, unknown>>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [openGroup, setOpenGroup] = useState<string | null>("event")
  const db = createClient()

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: reqs }, { data: recs }, { data: lineup }] = await Promise.all([
      db.from("advance_requests").select("*").eq("event_id", eventId).order("sort_order"),
      db.from("advance_recipients").select("*").eq("event_id", eventId),
      db.from("lineup_entries").select("id, name").eq("event_id", eventId).eq("kind", "music").order("sort_order"),
    ])
    setRequests(reqs ?? [])
    setRecipients(recs ?? [])
    setArtists((lineup ?? []).map((l) => ({ id: l.id, name: l.name })))
    const f: Record<string, Record<string, unknown>> = {}
    ;(reqs ?? []).forEach((r) => { f[r.id] = { ...(r.data ?? {}) } })
    setForms(f)
    setLoading(false)
  }, [eventId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (eventId) load() }, [eventId, refreshKey, load])

  // Create any missing sections (team-owned: recipient_id stays null). Idempotent.
  async function setup() {
    setBusy(true)
    try {
      const [{ data: ev }, { data: lineup }, { data: existing }] = await Promise.all([
        db.from("events").select("*").eq("id", eventId).single(),
        db.from("lineup_entries").select("*").eq("event_id", eventId).eq("kind", "music").order("sort_order"),
        db.from("advance_requests").select("lineup_entry_id, category").eq("event_id", eventId),
      ])
      const rows: Record<string, unknown>[] = []
      const haveEvent = new Set((existing ?? []).filter((r) => !r.lineup_entry_id).map((r) => r.category))
      EVENT_CATEGORIES.forEach((c, i) => {
        if (!haveEvent.has(c.key)) rows.push({ event_id: eventId, lineup_entry_id: null, category: c.key, title: c.title, status: "open", sort_order: i, data: prefillEvent(c.key, ev) })
      })
      for (const entry of (lineup ?? []) as LineupEntry[]) {
        const have = new Set((existing ?? []).filter((r) => r.lineup_entry_id === entry.id).map((r) => r.category))
        ARTIST_CATEGORIES.forEach((c, i) => {
          if (!have.has(c.key)) rows.push({ event_id: eventId, lineup_entry_id: entry.id, category: c.key, title: c.title, status: "open", sort_order: 10 + i, data: prefillArtist(c.key, entry) })
        })
      }
      if (rows.length) await db.from("advance_requests").insert(rows)
      await load()
    } finally {
      setBusy(false)
    }
  }

  function setField(reqId: string, key: string, value: unknown) {
    setForms((f) => ({ ...f, [reqId]: { ...(f[reqId] ?? {}), [key]: value } }))
  }
  async function saveReq(reqId: string) {
    await db.from("advance_requests").update({ data: forms[reqId] ?? {}, updated_at: new Date().toISOString() }).eq("id", reqId)
  }
  async function setStatus(reqId: string, status: AdvanceStatus) {
    setRequests((prev) => prev.map((r) => (r.id === reqId ? { ...r, status } : r)))
    await db.from("advance_requests").update({ status }).eq("id", reqId)
  }
  async function sendOut(req: AdvanceRequest, name: string, email: string) {
    const token = newToken()
    const { data: rec } = await db.from("advance_recipients")
      .insert({ event_id: eventId, lineup_entry_id: req.lineup_entry_id, name: name || "Contact", email: email || null, token, scope: req.lineup_entry_id ? "artist" : "event" })
      .select().single()
    if (rec) {
      await db.from("advance_requests").update({ recipient_id: rec.id }).eq("id", req.id)
      setRecipients((prev) => [...prev, rec])
      setRequests((prev) => prev.map((r) => (r.id === req.id ? { ...r, recipient_id: rec.id } : r)))
    }
  }
  async function revoke(req: AdvanceRequest) {
    setRequests((prev) => prev.map((r) => (r.id === req.id ? { ...r, recipient_id: null } : r)))
    await db.from("advance_requests").update({ recipient_id: null }).eq("id", req.id)
  }

  const recById = (id: string | null) => (id ? recipients.find((r) => r.id === id) ?? null : null)
  const eventReqs = requests.filter((r) => !r.lineup_entry_id)
  const artistOrder = artists.length ? artists : Array.from(new Set(requests.filter((r) => r.lineup_entry_id).map((r) => r.lineup_entry_id!))).map((id) => ({ id, name: "Artist" }))

  if (loading) return <div style={s.skeleton} />

  const total = requests.length
  const done = requests.filter((r) => r.status === "approved").length

  return (
    <div>
      <div style={s.brain}>
        <div style={s.brainIcon}><Wand2 size={16} strokeWidth={2} /></div>
        <div style={{ flex: 1 }}>
          <div style={s.brainTitle}>Advancing</div>
          <div style={s.brainSub}>
            Fill in the show details here — yours and the hosp manager&apos;s to enter. Send any single section out to an artist, driver or hotel only when you actually need their input.
          </div>
        </div>
        <button style={s.brainBtn} onClick={setup} disabled={busy} type="button">
          {busy ? <Loader size={15} style={{ animation: "lk-spin 0.8s linear infinite" }} /> : <Wand2 size={15} strokeWidth={2.2} />}
          {busy ? "Setting up…" : total ? "Add missing" : "Set up advancing"}
        </button>
      </div>

      {total === 0 ? (
        <div style={s.empty}>
          <div style={s.emptyTitle}>No advancing set up yet</div>
          <div style={s.emptySub}>Set up to create the event sections plus a set for each artist in the lineup. You fill them in here.</div>
        </div>
      ) : (
        <>
          <div style={s.progress}>{done}/{total} sections approved</div>

          <Group label="Event" count={eventReqs.length} open={openGroup === "event"} onToggle={() => setOpenGroup((g) => (g === "event" ? null : "event"))}>
            {eventReqs.map((req) => (
              <SectionEditor key={req.id} req={req} form={forms[req.id] ?? {}} recipient={recById(req.recipient_id)} origin={typeof window !== "undefined" ? window.location.origin : ""}
                onField={setField} onBlur={saveReq} onStatus={setStatus} onSendOut={sendOut} onRevoke={revoke} />
            ))}
          </Group>

          {artistOrder.map((a) => {
            const reqs = requests.filter((r) => r.lineup_entry_id === a.id)
            if (!reqs.length) return null
            const aDone = reqs.filter((r) => r.status === "approved").length
            return (
              <Group key={a.id} label={a.name} count={reqs.length} sub={`${aDone}/${reqs.length}`} open={openGroup === a.id} onToggle={() => setOpenGroup((g) => (g === a.id ? null : a.id))}>
                {reqs.map((req) => (
                  <SectionEditor key={req.id} req={req} form={forms[req.id] ?? {}} recipient={recById(req.recipient_id)} origin={typeof window !== "undefined" ? window.location.origin : ""}
                    onField={setField} onBlur={saveReq} onStatus={setStatus} onSendOut={sendOut} onRevoke={revoke} />
                ))}
              </Group>
            )
          })}
        </>
      )}
    </div>
  )
}

function Group({ label, count, sub, open, onToggle, children }: { label: string; count: number; sub?: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div style={s.group}>
      <button style={s.groupHead} onClick={onToggle} type="button">
        {open ? <ChevronDown size={16} strokeWidth={2} style={{ color: "var(--muted)" }} /> : <ChevronRight size={16} strokeWidth={2} style={{ color: "var(--muted)" }} />}
        <span style={s.groupName}>{label}</span>
        <span style={s.groupCount}>{sub ?? count}</span>
      </button>
      {open && <div style={s.groupBody}>{children}</div>}
    </div>
  )
}

function SectionEditor({ req, form, recipient, origin, onField, onBlur, onStatus, onSendOut, onRevoke }: {
  req: AdvanceRequest
  form: Record<string, unknown>
  recipient: AdvanceRecipient | null
  origin: string
  onField: (reqId: string, key: string, value: unknown) => void
  onBlur: (reqId: string) => void
  onStatus: (reqId: string, status: AdvanceStatus) => void
  onSendOut: (req: AdvanceRequest, name: string, email: string) => void
  onRevoke: (req: AdvanceRequest) => void
}) {
  const def = categoryDef(req.category)
  const [sharing, setSharing] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [copied, setCopied] = useState(false)

  const link = recipient ? `${origin}/advance/${recipient.token}` : ""
  function copy() { navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500) }

  return (
    <section style={s.sec}>
      <div style={s.secHead}>
        <span style={s.secTitle}>{def?.title ?? req.category}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <StatusPill status={req.status} />
          {req.status === "approved"
            ? <button style={s.iconAction} title="Reopen" onClick={() => onStatus(req.id, "open")} type="button"><RotateCcw size={13} strokeWidth={2} /></button>
            : <button style={s.approveBtn} onClick={() => onStatus(req.id, "approved")} type="button"><CircleCheck size={13} strokeWidth={2.2} /> Approve</button>}
        </div>
      </div>

      <div style={s.fields}>
        {(def?.fields ?? []).map((field) => (
          <Field key={field.key} field={field} value={form[field.key]} onChange={(v) => onField(req.id, field.key, v)} onBlur={() => onBlur(req.id)} />
        ))}
      </div>

      <div style={s.secFoot}>
        {recipient ? (
          <div style={s.sharedRow}>
            <span style={s.sharedChip}>Sent to {recipient.name}</span>
            <button style={s.linkBtn} onClick={copy} type="button">{copied ? <><Check size={12} strokeWidth={2.6} /> Copied</> : <><Link2 size={12} strokeWidth={2} /> Copy link</>}</button>
            <button style={s.revokeBtn} onClick={() => onRevoke(req)} type="button"><X size={12} strokeWidth={2} /> Revoke</button>
          </div>
        ) : sharing ? (
          <div style={s.shareForm}>
            <input style={s.shareInput} placeholder="Name (artist, driver, hotel…)" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            <input style={s.shareInput} placeholder="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button style={s.shareGo} onClick={() => { onSendOut(req, name, email); setSharing(false) }} type="button">Create link</button>
            <button style={s.shareCancel} onClick={() => setSharing(false)} type="button"><X size={14} strokeWidth={2} /></button>
          </div>
        ) : (
          <button style={s.sendBtn} onClick={() => setSharing(true)} type="button"><Send size={12} strokeWidth={2} /> Send to external</button>
        )}
      </div>
    </section>
  )
}

function Field({ field, value, onChange, onBlur }: { field: FieldDef; value: unknown; onChange: (v: unknown) => void; onBlur: () => void }) {
  if (field.type === "bool") {
    return (
      <label style={{ ...s.field, flexDirection: "row", alignItems: "center", gap: 9, cursor: "pointer" }}>
        <input type="checkbox" checked={!!value} onChange={(e) => { onChange(e.target.checked); setTimeout(onBlur, 0) }} style={{ width: 16, height: 16, accentColor: "var(--accent)" }} />
        <span style={s.fieldLabel}>{field.label}</span>
      </label>
    )
  }
  const common = {
    value: (value as string) ?? "",
    placeholder: field.placeholder,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value),
    onBlur,
    style: s.input,
  }
  return (
    <label style={s.field}>
      <span style={s.fieldLabel}>{field.label}</span>
      {field.type === "textarea"
        ? <textarea rows={2} {...common} style={{ ...s.input, resize: "vertical", minHeight: 52, lineHeight: 1.5 }} />
        : <input type={inputType(field.type)} {...common} />}
    </label>
  )
}

function StatusPill({ status }: { status: AdvanceStatus }) {
  const map: Record<AdvanceStatus, { label: string; bg: string; color: string }> = {
    open: { label: "To do", bg: "var(--bg-2)", color: "var(--text-2)" },
    submitted: { label: "Submitted", bg: "var(--accent-tint)", color: "var(--accent)" },
    approved: { label: "Approved", bg: "var(--green-tint)", color: "var(--green)" },
  }
  const m = map[status]
  return <span style={{ ...s.pill, background: m.bg, color: m.color }}>{m.label}</span>
}

const s: Record<string, React.CSSProperties> = {
  skeleton: { height: 400, background: "var(--inset)", borderRadius: "var(--radius)" },
  brain: { display: "flex", alignItems: "center", gap: 12, background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "14px 16px", marginBottom: 14, boxShadow: "var(--shadow-sm)" },
  brainIcon: { width: 34, height: 34, borderRadius: 9, flexShrink: 0, background: "var(--accent-tint)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" },
  brainTitle: { fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 2 },
  brainSub: { fontSize: 12, color: "var(--text-2)", lineHeight: 1.5 },
  brainBtn: { display: "flex", alignItems: "center", gap: 7, background: "var(--accent)", color: "#fff", border: "none", borderRadius: 9, padding: "10px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" },
  empty: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6, textAlign: "center", padding: "44px 24px", background: "var(--card)", border: "1px dashed var(--border-strong)", borderRadius: "var(--radius)", color: "var(--text-2)" },
  emptyTitle: { fontFamily: "var(--font-fraunces), serif", fontSize: 16, fontWeight: 600, color: "var(--text)" },
  emptySub: { fontSize: 13, color: "var(--text-2)", maxWidth: 380, lineHeight: 1.5 },
  progress: { fontSize: 12, color: "var(--muted)", fontWeight: 500, margin: "2px 2px 12px" },
  group: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 13, marginBottom: 10, boxShadow: "var(--shadow-sm)", overflow: "hidden" },
  groupHead: { display: "flex", alignItems: "center", gap: 9, width: "100%", background: "transparent", border: "none", cursor: "pointer", padding: "12px 14px", textAlign: "left" },
  groupName: { flex: 1, fontSize: 14, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  groupCount: { fontSize: 11.5, fontWeight: 600, color: "var(--muted)", background: "var(--bg-2)", borderRadius: 999, padding: "2px 9px" },
  groupBody: { borderTop: "1px solid var(--border)", padding: "8px 14px 14px", display: "flex", flexDirection: "column", gap: 10 },
  sec: { background: "var(--bg-2)", borderRadius: 11, padding: "12px 13px", marginTop: 8 },
  secHead: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 4 },
  secTitle: { fontSize: 13.5, fontWeight: 600, color: "var(--text)" },
  fields: { display: "flex", flexDirection: "column", gap: 10, marginTop: 8 },
  field: { display: "flex", flexDirection: "column", gap: 5 },
  fieldLabel: { fontSize: 12, fontWeight: 600, color: "var(--text-2)" },
  input: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontSize: 13.5, padding: "9px 11px", outline: "none", fontFamily: "inherit", width: "100%" },
  secFoot: { marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border)" },
  sendBtn: { display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: "var(--accent)", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0 },
  shareForm: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" },
  shareInput: { flex: "1 1 120px", minWidth: 100, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontSize: 12.5, padding: "7px 9px", outline: "none" },
  shareGo: { background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
  shareCancel: { width: 30, height: 30, borderRadius: 8, background: "var(--inset)", border: "1px solid var(--border)", color: "var(--text-2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  sharedRow: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  sharedChip: { fontSize: 11.5, fontWeight: 600, color: "var(--accent)", background: "var(--accent-tint)", borderRadius: 7, padding: "4px 9px" },
  linkBtn: { display: "flex", alignItems: "center", gap: 5, background: "var(--inset)", border: "1px solid var(--border)", color: "var(--text-2)", borderRadius: 7, padding: "5px 10px", fontSize: 11.5, fontWeight: 600, cursor: "pointer" },
  revokeBtn: { display: "flex", alignItems: "center", gap: 4, background: "transparent", border: "none", color: "var(--muted)", fontSize: 11.5, fontWeight: 500, cursor: "pointer" },
  approveBtn: { display: "flex", alignItems: "center", gap: 5, background: "var(--green-tint)", color: "var(--green)", border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  iconAction: { width: 26, height: 26, borderRadius: 7, background: "var(--inset)", border: "1px solid var(--border)", color: "var(--text-2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  pill: { fontSize: 10.5, fontWeight: 600, borderRadius: 999, padding: "2px 9px", whiteSpace: "nowrap" },
}
