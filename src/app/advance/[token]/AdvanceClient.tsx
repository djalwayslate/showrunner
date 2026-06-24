"use client"

import { useEffect, useState, useCallback } from "react"
import { Loader, Check, Send, CircleAlert, Lock } from "lucide-react"
import { categoryDef, type FieldDef, type AdvanceRequest, type AdvanceStatus } from "@/lib/advancing/schema"

type EventInfo = { name: string; venue: string | null; start_date: string; end_date: string; start_time: string | null; poster_url: string | null }
type State = { recipient: { id: string; name: string; scope: string }; event: EventInfo | null; requests: AdvanceRequest[] }

export default function AdvanceClient({ token }: { token: string }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [state, setState] = useState<State | null>(null)
  const [forms, setForms] = useState<Record<string, Record<string, unknown>>>({})
  const [saving, setSaving] = useState<Record<string, "saving" | "saved" | undefined>>({})

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/advance/state?token=${encodeURIComponent(token)}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Couldn't load this link.")
      setState(json)
      const f: Record<string, Record<string, unknown>> = {}
      ;(json.requests as AdvanceRequest[]).forEach((r) => { f[r.id] = { ...(r.data ?? {}) } })
      setForms(f)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    }
    setLoading(false)
  }, [token])

  useEffect(() => { load() }, [load])

  async function save(reqId: string) {
    setSaving((s) => ({ ...s, [reqId]: "saving" }))
    const res = await fetch("/api/advance/save", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, requestId: reqId, data: forms[reqId] ?? {} }),
    })
    setSaving((s) => ({ ...s, [reqId]: res.ok ? "saved" : undefined }))
    if (res.ok) setTimeout(() => setSaving((s) => ({ ...s, [reqId]: undefined })), 1500)
  }

  async function submit(reqId: string) {
    await save(reqId)
    const res = await fetch("/api/advance/submit", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, requestId: reqId }),
    })
    if (res.ok) {
      setState((st) => st ? { ...st, requests: st.requests.map((r) => r.id === reqId ? { ...r, status: "submitted" as AdvanceStatus } : r) } : st)
    }
  }

  if (loading) return <Centered><Loader size={22} style={{ animation: "lk-spin 0.8s linear infinite", color: "var(--muted)" }} /></Centered>
  if (error || !state) return (
    <Centered>
      <CircleAlert size={26} strokeWidth={1.8} style={{ color: "var(--muted)" }} />
      <div style={s.errTitle}>Can&apos;t open this link</div>
      <div style={s.errSub}>{error ?? "Unknown error"}</div>
    </Centered>
  )

  const { event, recipient, requests } = state
  const open = requests.filter((r) => r.status !== "approved")
  const approved = requests.filter((r) => r.status === "approved")

  return (
    <div style={s.page}>
      <div style={s.wrap}>
        <header style={s.header}>
          <div style={s.brandMark}>LK</div>
          <div>
            <div style={s.eventName}>{event?.name ?? "Event"}</div>
            <div style={s.eventMeta}>
              {event?.venue ? `${event.venue} · ` : ""}{event ? fmtRange(event.start_date, event.end_date) : ""}
            </div>
          </div>
        </header>

        <div style={s.hello}>
          Hi{recipient.name ? ` ${recipient.name}` : ""} — please fill in the details below and submit each section. The team is notified when you submit.
        </div>

        {open.map((r) => <RequestCard key={r.id} req={r} form={forms[r.id] ?? {}} saving={saving[r.id]}
          onChange={(k, v) => setForms((f) => ({ ...f, [r.id]: { ...(f[r.id] ?? {}), [k]: v } }))}
          onBlur={() => save(r.id)} onSubmit={() => submit(r.id)} />)}

        {approved.length > 0 && <div style={s.approvedLabel}>Approved</div>}
        {approved.map((r) => <RequestCard key={r.id} req={r} form={forms[r.id] ?? {}} saving={undefined}
          onChange={() => {}} onBlur={() => {}} onSubmit={() => {}} locked />)}

        <footer style={s.footer}>Latino Kings · Operations</footer>
      </div>
    </div>
  )
}

function RequestCard({ req, form, saving, onChange, onBlur, onSubmit, locked }: {
  req: AdvanceRequest
  form: Record<string, unknown>
  saving: "saving" | "saved" | undefined
  onChange: (key: string, value: unknown) => void
  onBlur: () => void
  onSubmit: () => void
  locked?: boolean
}) {
  const def = categoryDef(req.category)
  const title = req.title || def?.title || req.category
  return (
    <section style={s.card}>
      <div style={s.cardHead}>
        <h2 style={s.cardTitle}>{title}</h2>
        <StatusBadge status={req.status} />
      </div>
      {def?.help && <div style={s.help}>{def.help}</div>}
      <div style={s.fields}>
        {(def?.fields ?? []).map((field) => (
          <FieldInput key={field.key} field={field} value={form[field.key]} disabled={!!locked}
            onChange={(v) => onChange(field.key, v)} onBlur={onBlur} />
        ))}
      </div>
      {!locked && (
        <div style={s.cardFoot}>
          <span style={s.savingNote}>
            {saving === "saving" ? "Saving…" : saving === "saved" ? <><Check size={13} strokeWidth={2.4} style={{ color: "var(--green)" }} /> Saved</> : ""}
          </span>
          <button style={s.submitBtn} onClick={onSubmit} type="button">
            <Send size={14} strokeWidth={2.2} /> {req.status === "submitted" ? "Re-submit" : "Submit"}
          </button>
        </div>
      )}
      {locked && <div style={s.lockedNote}><Lock size={12} strokeWidth={2} /> Approved by the team</div>}
    </section>
  )
}

function FieldInput({ field, value, disabled, onChange, onBlur }: {
  field: FieldDef
  value: unknown
  disabled: boolean
  onChange: (v: unknown) => void
  onBlur: () => void
}) {
  if (field.type === "bool") {
    return (
      <label style={{ ...s.field, flexDirection: "row", alignItems: "center", gap: 9, cursor: disabled ? "default" : "pointer" }}>
        <input type="checkbox" checked={!!value} disabled={disabled}
          onChange={(e) => { onChange(e.target.checked); setTimeout(onBlur, 0) }} style={{ width: 16, height: 16, accentColor: "var(--accent)" }} />
        <span style={s.fieldLabel}>{field.label}</span>
      </label>
    )
  }
  const common = {
    value: (value as string) ?? "",
    disabled,
    placeholder: field.placeholder,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value),
    onBlur,
    style: s.input,
  }
  return (
    <label style={s.field}>
      <span style={s.fieldLabel}>{field.label}</span>
      {field.type === "textarea"
        ? <textarea rows={3} {...common} style={{ ...s.input, resize: "vertical", minHeight: 64, lineHeight: 1.5 }} />
        : <input type={inputType(field.type)} {...common} />}
    </label>
  )
}

function StatusBadge({ status }: { status: AdvanceStatus }) {
  const map: Record<AdvanceStatus, { label: string; bg: string; color: string }> = {
    open: { label: "To do", bg: "var(--bg-2)", color: "var(--text-2)" },
    submitted: { label: "Submitted", bg: "var(--accent-tint)", color: "var(--accent)" },
    approved: { label: "Approved", bg: "var(--green-tint)", color: "var(--green)" },
  }
  const m = map[status]
  return <span style={{ ...s.badge, background: m.bg, color: m.color }}>{m.label}</span>
}

function inputType(t: FieldDef["type"]): string {
  if (t === "textarea" || t === "bool") return "text"
  return t
}

function fmtRange(start: string, end: string): string {
  const sd = new Date(start + "T00:00:00"), en = new Date(end + "T00:00:00")
  const mo = (d: Date) => d.toLocaleString("en-US", { month: "short" })
  if (start === end) return `${mo(sd)} ${sd.getDate()}, ${sd.getFullYear()}`
  if (sd.getMonth() === en.getMonth()) return `${mo(sd)} ${sd.getDate()}–${en.getDate()}, ${sd.getFullYear()}`
  return `${mo(sd)} ${sd.getDate()} – ${mo(en)} ${en.getDate()}, ${en.getFullYear()}`
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div style={{ ...s.page, display: "flex" }}><div style={s.centered}>{children}</div></div>
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "var(--bg)", padding: "0 0 40px" },
  wrap: { maxWidth: 640, margin: "0 auto", padding: "0 18px" },
  centered: { margin: "auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center", padding: 40 },
  errTitle: { fontFamily: "var(--font-fraunces), serif", fontSize: 19, fontWeight: 600, color: "var(--text)" },
  errSub: { fontSize: 13.5, color: "var(--text-2)", maxWidth: 320, lineHeight: 1.5 },
  header: { display: "flex", alignItems: "center", gap: 12, padding: "26px 0 18px" },
  brandMark: { width: 40, height: 40, borderRadius: 11, background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-fraunces), serif", fontWeight: 600, fontSize: 16, flexShrink: 0 },
  eventName: { fontFamily: "var(--font-fraunces), serif", fontSize: 21, fontWeight: 600, color: "var(--text)", lineHeight: 1.15 },
  eventMeta: { fontSize: 13, color: "var(--muted)", marginTop: 2 },
  hello: { fontSize: 13.5, color: "var(--text-2)", lineHeight: 1.55, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "13px 15px", marginBottom: 16, boxShadow: "var(--shadow-sm)" },
  approvedLabel: { fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "22px 0 10px 2px" },
  card: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 17px", marginBottom: 12, boxShadow: "var(--shadow-sm)" },
  cardHead: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 4 },
  cardTitle: { fontFamily: "var(--font-fraunces), serif", fontSize: 16.5, fontWeight: 600, color: "var(--text)", margin: 0 },
  help: { fontSize: 12, color: "var(--muted)", lineHeight: 1.5, marginBottom: 12 },
  fields: { display: "flex", flexDirection: "column", gap: 12, marginTop: 8 },
  field: { display: "flex", flexDirection: "column", gap: 5 },
  fieldLabel: { fontSize: 12, fontWeight: 600, color: "var(--text-2)" },
  input: { background: "var(--inset)", border: "1px solid var(--border)", borderRadius: 9, color: "var(--text)", fontSize: 14, padding: "10px 12px", outline: "none", fontFamily: "inherit", width: "100%" },
  cardFoot: { display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12, marginTop: 14 },
  savingNote: { fontSize: 12, color: "var(--muted)", display: "flex", alignItems: "center", gap: 5 },
  submitBtn: { display: "flex", alignItems: "center", gap: 7, background: "var(--accent)", color: "#fff", border: "none", borderRadius: 9, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  lockedNote: { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)", marginTop: 12 },
  badge: { fontSize: 11, fontWeight: 600, borderRadius: 999, padding: "3px 10px", whiteSpace: "nowrap" },
  footer: { textAlign: "center", fontSize: 11.5, color: "var(--muted)", marginTop: 30, letterSpacing: "0.02em" },
}
