"use client"

import { useState, useEffect, useCallback } from "react"
import { Wand2, Loader, Link2, Check, ChevronDown, ChevronRight, Users, ExternalLink, CircleCheck } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import {
  EVENT_CATEGORIES, ARTIST_CATEGORIES, categoryDef,
  type AdvanceRecipient, type AdvanceRequest, type AdvanceStatus,
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
  if (key === "timetable") {
    const set = entry.start_time && entry.end_time ? `${entry.start_time}–${entry.end_time}` : ""
    return { set_time: set }
  }
  return {}
}

export default function AdvancingTab({ eventId, refreshKey }: { eventId: string; refreshKey: number }) {
  const [recipients, setRecipients] = useState<AdvanceRecipient[]>([])
  const [requests, setRequests] = useState<AdvanceRequest[]>([])
  const [lineupCount, setLineupCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const db = createClient()

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: recs }, { data: reqs }, { count }] = await Promise.all([
      db.from("advance_recipients").select("*").eq("event_id", eventId).order("created_at"),
      db.from("advance_requests").select("*").eq("event_id", eventId).order("sort_order"),
      db.from("lineup_entries").select("id", { count: "exact", head: true }).eq("event_id", eventId).eq("kind", "music"),
    ])
    setRecipients(recs ?? [])
    setRequests(reqs ?? [])
    setLineupCount(count ?? 0)
    setLoading(false)
  }, [eventId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (eventId) load() }, [eventId, refreshKey, load])

  async function generate() {
    setBusy(true)
    try {
      const [{ data: ev }, { data: lineup }, { data: existing }] = await Promise.all([
        db.from("events").select("*").eq("id", eventId).single(),
        db.from("lineup_entries").select("*").eq("event_id", eventId).eq("kind", "music").order("sort_order"),
        db.from("advance_recipients").select("*").eq("event_id", eventId),
      ])

      // Event-level contact (once)
      if (!(existing ?? []).some((r) => r.scope === "event")) {
        const { data: rec } = await db.from("advance_recipients")
          .insert({ event_id: eventId, scope: "event", name: "Promoter / Venue", token: newToken() })
          .select().single()
        if (rec) {
          await db.from("advance_requests").insert(EVENT_CATEGORIES.map((c, i) => ({
            event_id: eventId, recipient_id: rec.id, category: c.key, title: c.title,
            status: "open", sort_order: i, data: prefillEvent(c.key, ev),
          })))
        }
      }

      // Per-artist (skip artists already generated)
      const done = new Set((existing ?? []).map((r) => r.lineup_entry_id).filter(Boolean))
      for (const entry of (lineup ?? []) as LineupEntry[]) {
        if (done.has(entry.id)) continue
        const { data: rec } = await db.from("advance_recipients")
          .insert({ event_id: eventId, scope: "artist", lineup_entry_id: entry.id, name: entry.name || "Artist", token: newToken() })
          .select().single()
        if (rec) {
          await db.from("advance_requests").insert(ARTIST_CATEGORIES.map((c, i) => ({
            event_id: eventId, recipient_id: rec.id, lineup_entry_id: entry.id, category: c.key, title: c.title,
            status: "open", sort_order: i, data: prefillArtist(c.key, entry),
          })))
        }
      }
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function approve(reqId: string) {
    setRequests((prev) => prev.map((r) => (r.id === reqId ? { ...r, status: "approved" } : r)))
    await db.from("advance_requests").update({ status: "approved" }).eq("id", reqId)
  }
  async function reopen(reqId: string) {
    setRequests((prev) => prev.map((r) => (r.id === reqId ? { ...r, status: "open" } : r)))
    await db.from("advance_requests").update({ status: "open" }).eq("id", reqId)
  }

  function copyLink(token: string) {
    const url = `${window.location.origin}/advance/${token}`
    navigator.clipboard?.writeText(url)
    setCopied(token)
    setTimeout(() => setCopied((c) => (c === token ? null : c)), 1600)
  }

  const reqsFor = (recId: string) => requests.filter((r) => r.recipient_id === recId)
  const eventRecs = recipients.filter((r) => r.scope === "event")
  const artistRecs = recipients.filter((r) => r.scope === "artist")

  if (loading) return <div style={s.skeleton} />

  return (
    <div>
      <div style={s.brain}>
        <div style={s.brainIcon}><Wand2 size={16} strokeWidth={2} /></div>
        <div style={{ flex: 1 }}>
          <div style={s.brainTitle}>External advancing</div>
          <div style={s.brainSub}>
            Generate a fill-in link for the promoter/venue and one for every artist in the lineup. Share the link or invite by email; they complete their sections and submit for your approval.
          </div>
        </div>
        <button style={s.brainBtn} onClick={generate} disabled={busy} type="button">
          {busy ? <Loader size={15} style={{ animation: "lk-spin 0.8s linear infinite" }} /> : <Wand2 size={15} strokeWidth={2.2} />}
          {busy ? "Generating…" : recipients.length ? "Generate missing" : "Generate links"}
        </button>
      </div>

      {recipients.length === 0 ? (
        <div style={s.empty}>
          <Users size={20} strokeWidth={1.6} style={{ color: "var(--muted)" }} />
          <div style={s.emptyTitle}>No advancing links yet</div>
          <div style={s.emptySub}>
            {lineupCount === 0
              ? "Add acts to the Lineup first, then generate — you'll get a link per artist plus one for the promoter/venue."
              : `Generate to create a promoter/venue link and ${lineupCount} artist ${lineupCount === 1 ? "link" : "links"} in one go.`}
          </div>
        </div>
      ) : (
        <>
          {eventRecs.length > 0 && <div style={s.groupLabel}>Promoter / Venue</div>}
          {eventRecs.map((rec) => (
            <RecipientCard key={rec.id} rec={rec} requests={reqsFor(rec.id)} expanded={expanded === rec.id} copied={copied === rec.token}
              onToggle={() => setExpanded((e) => (e === rec.id ? null : rec.id))} onCopy={() => copyLink(rec.token)} onApprove={approve} onReopen={reopen} />
          ))}
          {artistRecs.length > 0 && <div style={s.groupLabel}>Artists · {artistRecs.length}</div>}
          {artistRecs.map((rec) => (
            <RecipientCard key={rec.id} rec={rec} requests={reqsFor(rec.id)} expanded={expanded === rec.id} copied={copied === rec.token}
              onToggle={() => setExpanded((e) => (e === rec.id ? null : rec.id))} onCopy={() => copyLink(rec.token)} onApprove={approve} onReopen={reopen} />
          ))}
        </>
      )}
    </div>
  )
}

function RecipientCard({ rec, requests, expanded, copied, onToggle, onCopy, onApprove, onReopen }: {
  rec: AdvanceRecipient
  requests: AdvanceRequest[]
  expanded: boolean
  copied: boolean
  onToggle: () => void
  onCopy: () => void
  onApprove: (id: string) => void
  onReopen: (id: string) => void
}) {
  const submitted = requests.filter((r) => r.status === "submitted").length
  const approved = requests.filter((r) => r.status === "approved").length
  const total = requests.length

  return (
    <div style={s.card}>
      <div style={s.cardTop}>
        <button style={s.cardMain} onClick={onToggle} type="button">
          {expanded ? <ChevronDown size={16} strokeWidth={2} style={{ color: "var(--muted)" }} /> : <ChevronRight size={16} strokeWidth={2} style={{ color: "var(--muted)" }} />}
          <span style={s.recName}>{rec.name}</span>
          <span style={s.recMeta}>
            {approved === total && total > 0 ? <span style={{ color: "var(--green)", fontWeight: 600 }}>All approved</span>
              : submitted > 0 ? <span style={{ color: "var(--accent)", fontWeight: 600 }}>{submitted} to review</span>
              : `${approved}/${total} approved`}
          </span>
        </button>
        <div style={s.cardActions}>
          <a href={`/advance/${rec.token}`} target="_blank" rel="noopener noreferrer" style={s.openBtn} title="Open the external page">
            <ExternalLink size={13} strokeWidth={2} />
          </a>
          <button style={s.copyBtn} onClick={onCopy} type="button">
            {copied ? <><Check size={13} strokeWidth={2.6} /> Copied</> : <><Link2 size={13} strokeWidth={2} /> Copy link</>}
          </button>
        </div>
      </div>

      {expanded && (
        <div style={s.reqList}>
          {requests.map((req) => {
            const def = categoryDef(req.category)
            const filled = def?.fields.map((f) => ({ label: f.label, value: req.data?.[f.key] }))
              .filter((x) => x.value !== undefined && x.value !== "" && x.value !== false) ?? []
            return (
              <div key={req.id} style={s.req}>
                <div style={s.reqHead}>
                  <span style={s.reqTitle}>{def?.title ?? req.category}</span>
                  <StatusPill status={req.status} />
                </div>
                {filled.length > 0 ? (
                  <div style={s.reqData}>
                    {filled.map((x, i) => (
                      <div key={i} style={s.reqRow}><span style={s.reqKey}>{x.label}</span><span style={s.reqVal}>{String(x.value === true ? "Yes" : x.value)}</span></div>
                    ))}
                  </div>
                ) : <div style={s.reqEmpty}>Not filled in yet.</div>}
                <div style={s.reqFoot}>
                  {req.status === "approved"
                    ? <button style={s.reopenBtn} onClick={() => onReopen(req.id)} type="button">Reopen</button>
                    : <button style={s.approveBtn} onClick={() => onApprove(req.id)} type="button"><CircleCheck size={13} strokeWidth={2.2} /> Approve</button>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
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
  brain: { display: "flex", alignItems: "center", gap: 12, background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "14px 16px", marginBottom: 16, boxShadow: "var(--shadow-sm)" },
  brainIcon: { width: 34, height: 34, borderRadius: 9, flexShrink: 0, background: "var(--accent-tint)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" },
  brainTitle: { fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 2 },
  brainSub: { fontSize: 12, color: "var(--text-2)", lineHeight: 1.5 },
  brainBtn: { display: "flex", alignItems: "center", gap: 7, background: "var(--accent)", color: "#fff", border: "none", borderRadius: 9, padding: "10px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" },
  empty: { display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center", padding: "44px 24px", background: "var(--card)", border: "1px dashed var(--border-strong)", borderRadius: "var(--radius)", color: "var(--text-2)" },
  emptyTitle: { fontFamily: "var(--font-fraunces), serif", fontSize: 16, fontWeight: 600, color: "var(--text)" },
  emptySub: { fontSize: 13, color: "var(--text-2)", maxWidth: 360, lineHeight: 1.5 },
  groupLabel: { fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "18px 0 9px 2px" },
  card: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 13, marginBottom: 9, boxShadow: "var(--shadow-sm)", overflow: "hidden" },
  cardTop: { display: "flex", alignItems: "center", gap: 8, padding: "11px 13px" },
  cardMain: { display: "flex", alignItems: "center", gap: 9, flex: 1, background: "transparent", border: "none", cursor: "pointer", padding: 0, minWidth: 0, textAlign: "left" },
  recName: { fontSize: 14, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  recMeta: { fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" },
  cardActions: { display: "flex", alignItems: "center", gap: 6, flexShrink: 0 },
  openBtn: { width: 30, height: 30, borderRadius: 8, background: "var(--inset)", border: "1px solid var(--border)", color: "var(--text-2)", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" },
  copyBtn: { display: "flex", alignItems: "center", gap: 5, background: "var(--inset)", border: "1px solid var(--border)", color: "var(--text-2)", borderRadius: 8, padding: "7px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
  reqList: { borderTop: "1px solid var(--border)", padding: "6px 13px 13px", display: "flex", flexDirection: "column", gap: 8 },
  req: { background: "var(--bg-2)", borderRadius: 10, padding: "11px 12px", marginTop: 7 },
  reqHead: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 },
  reqTitle: { fontSize: 13, fontWeight: 600, color: "var(--text)" },
  reqData: { display: "flex", flexDirection: "column", gap: 4, marginTop: 8 },
  reqRow: { display: "flex", gap: 10, fontSize: 12.5 },
  reqKey: { color: "var(--muted)", minWidth: 120, flexShrink: 0 },
  reqVal: { color: "var(--text)", fontWeight: 500, wordBreak: "break-word" },
  reqEmpty: { fontSize: 12, color: "var(--muted)", marginTop: 7, fontStyle: "italic" },
  reqFoot: { display: "flex", justifyContent: "flex-end", marginTop: 10 },
  approveBtn: { display: "flex", alignItems: "center", gap: 5, background: "var(--green-tint)", color: "var(--green)", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  reopenBtn: { background: "var(--inset)", color: "var(--text-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer" },
  pill: { fontSize: 10.5, fontWeight: 600, borderRadius: 999, padding: "2px 9px", whiteSpace: "nowrap" },
}
