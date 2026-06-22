"use client"

import { useState, useRef, useEffect } from "react"
import { ChevronDown, Plus, Check, Pencil, DownloadCloud } from "lucide-react"
import type { EventRow } from "@/lib/types"

export default function EventSwitcher({
  events,
  selectedId,
  onSelect,
  onNew,
  onEdit,
  onBulkImport,
  canManage,
}: {
  events: EventRow[]
  selectedId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onEdit: (e: EventRow) => void
  onBulkImport: () => void
  canManage: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  const selected = events.find((e) => e.id === selectedId)
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = events
    .filter((e) => e.end_date >= today)
    .sort((a, b) => a.start_date.localeCompare(b.start_date)) // soonest first
  const past = events
    .filter((e) => e.end_date < today)
    .sort((a, b) => b.start_date.localeCompare(a.start_date)) // most recent first

  function fmtRange(e: EventRow) {
    const sd = new Date(e.start_date + "T00:00:00")
    const en = new Date(e.end_date + "T00:00:00")
    const mo = (d: Date) => d.toLocaleString("en-US", { month: "short" })
    if (sd.getMonth() === en.getMonth() && sd.getFullYear() === en.getFullYear())
      return `${mo(sd)} ${sd.getDate()}–${en.getDate()}, ${sd.getFullYear()}`
    return `${mo(sd)} ${sd.getDate()} – ${mo(en)} ${en.getDate()}, ${en.getFullYear()}`
  }

  return (
    <div style={{ position: "relative" }} ref={ref}>
      <button style={s.trigger} onClick={() => setOpen((o) => !o)} type="button">
        <span style={s.triggerName}>{selected ? selected.name : "Select event"}</span>
        {selected && <span style={s.triggerMeta}>{fmtRange(selected)}</span>}
        <ChevronDown size={15} strokeWidth={2.2} style={{ color: "var(--muted)", marginLeft: 2 }} />
      </button>

      {open && (
        <div style={s.menu}>
          {events.length === 0 && <div style={s.emptyNote}>No events yet.</div>}
          {[
            { label: "Upcoming", list: upcoming },
            { label: "History", list: past },
          ].map(({ label, list }) =>
            list.length === 0 ? null : (
              <div key={label}>
                <div style={s.menuLabel}>{label}</div>
                {list.map((e) => {
                  const active = e.id === selectedId
                  return (
                    <div key={e.id} style={{ ...s.item, ...(active ? s.itemActive : {}) }}>
                      <button style={s.itemMain} onClick={() => { onSelect(e.id); setOpen(false) }} type="button">
                        <div style={{ display: "flex", flexDirection: "column", gap: 2, textAlign: "left", minWidth: 0 }}>
                          <span style={s.itemName}>{e.name}</span>
                          <span style={s.itemMeta}>{fmtRange(e)}{e.venue ? ` · ${e.venue}` : ""}</span>
                        </div>
                      </button>
                      {active && <Check size={15} strokeWidth={2.4} style={{ color: "var(--accent)", flexShrink: 0 }} />}
                      {canManage && (
                        <button style={s.editBtn} onClick={() => { onEdit(e); setOpen(false) }} title="Edit event" type="button">
                          <Pencil size={13} strokeWidth={2} />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          )}

          {canManage && (
            <div style={{ borderTop: "1px solid var(--border)", marginTop: 4, paddingTop: 4 }}>
              <button style={s.newBtn} onClick={() => { onNew(); setOpen(false) }} type="button">
                <Plus size={15} strokeWidth={2.2} /> New event
              </button>
              <button style={s.bulkBtn} onClick={() => { onBulkImport(); setOpen(false) }} type="button">
                <DownloadCloud size={15} strokeWidth={2} /> Import past events from links
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  trigger: { display: "flex", alignItems: "center", gap: 9, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 11, padding: "9px 13px", cursor: "pointer", boxShadow: "var(--shadow-sm)", maxWidth: "100%" },
  triggerName: { fontFamily: "var(--font-fraunces), serif", fontSize: 15, fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap" },
  triggerMeta: { fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap", paddingLeft: 9, borderLeft: "1px solid var(--border)" },
  menu: { position: "absolute", top: "calc(100% + 8px)", left: 0, minWidth: 320, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: 7, zIndex: 50, boxShadow: "var(--shadow-lg)", animation: "lk-fade-up 0.16s ease both" },
  menuLabel: { fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)", padding: "6px 8px 8px" },
  emptyNote: { fontSize: 12.5, color: "var(--muted)", padding: "8px", textAlign: "center" },
  item: { display: "flex", alignItems: "center", gap: 6, borderRadius: 9, padding: "2px 6px 2px 0" },
  itemActive: { background: "var(--inset)" },
  itemMain: { display: "flex", alignItems: "center", flex: 1, background: "transparent", border: "none", borderRadius: 9, padding: "9px 10px", cursor: "pointer", minWidth: 0 },
  itemName: { fontSize: 13.5, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  itemMeta: { fontSize: 11.5, color: "var(--muted)" },
  editBtn: { width: 28, height: 28, borderRadius: 7, background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  newBtn: { display: "flex", alignItems: "center", gap: 7, width: "100%", background: "transparent", border: "none", color: "var(--accent)", fontSize: 13, fontWeight: 600, borderRadius: 9, padding: "9px 10px", cursor: "pointer", justifyContent: "center" },
  bulkBtn: { display: "flex", alignItems: "center", gap: 7, width: "100%", background: "transparent", border: "none", color: "var(--text-2)", fontSize: 12.5, fontWeight: 500, borderRadius: 9, padding: "7px 10px", cursor: "pointer", justifyContent: "center" },
}
