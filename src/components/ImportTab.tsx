"use client"

import { useState, useRef } from "react"
import { Upload, Check, X, Loader, FileText, Sparkles } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

type ExtractedRow = { _checked: boolean; [key: string]: unknown }
type ImportTarget = "hosp" | "lineup" | "budget"

const TARGET_LABEL: Record<ImportTarget, string> = { hosp: "Hospitality", lineup: "Lineup", budget: "Budget" }

export default function ImportTab({
  eventId, onImported,
}: { eventId: string; activeTab: string; onImported: () => void }) {
  const [target, setTarget] = useState<ImportTarget>("hosp")
  const [rows, setRows] = useState<ExtractedRow[]>([])
  const [status, setStatus] = useState<"idle" | "extracting" | "review" | "saving" | "done" | "error">("idle")
  const [message, setMessage] = useState("")
  const [fileName, setFileName] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)
  const db = createClient()

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setStatus("extracting"); setMessage(""); setRows([]); setFileName(file.name)

    const form = new FormData()
    form.append("file", file)
    form.append("target", target)

    try {
      const res = await fetch("/api/import", { method: "POST", body: form })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Extraction failed")
      setRows((json.rows ?? []).map((r: Record<string, unknown>) => ({ ...r, _checked: true })))
      setStatus("review")
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Unknown error")
      setStatus("error")
    }
    if (fileRef.current) fileRef.current.value = ""
  }

  function toggle(i: number) {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, _checked: !r._checked } : r)))
  }

  async function saveSelected() {
    const selected = rows.filter((r) => r._checked).map(({ _checked: _c, ...rest }) => rest)
    if (!selected.length) return
    setStatus("saving")
    try {
      if (target === "hosp") {
        for (const r of selected) {
          const { data: person } = await db
            .from("hosp_people")
            .insert({ event_id: eventId, name: r.name ?? "Unknown", count: Number(r.count) || 1, room: r.room ?? "Single", role: r.role ?? "", sort_order: 999 })
            .select().single()
          if (person && Array.isArray(r.days) && r.days.length) {
            await db.from("hosp_person_days").insert((r.days as number[]).map((d) => ({ person_id: person.id, day: d })))
          }
        }
      } else if (target === "lineup") {
        await db.from("lineup_entries").insert(selected.map((r, i) => ({
          event_id: eventId, name: r.name ?? "Unknown", role: r.role ?? "Support",
          start_time: r.start_time ?? null, end_time: r.end_time ?? null,
          fee: Number(r.fee) || 0, status: r.status ?? "Pending", sort_order: 999 + i,
        })))
      } else {
        await db.from("budget_items").insert(selected.map((r, i) => ({
          event_id: eventId, type: r.type ?? "cost", label: r.label ?? "Item",
          planned: Number(r.planned) || 0, actual: Number(r.actual) || 0, sort_order: 999 + i,
        })))
      }
      setStatus("done"); setRows([]); onImported()
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Save failed")
      setStatus("error")
    }
  }

  const selectedCount = rows.filter((r) => r._checked).length

  return (
    <div>
      <div style={s.intro}>
        <div style={s.introIcon}><Sparkles size={16} strokeWidth={2} /></div>
        <div>
          <div style={s.introTitle}>Import from a screenshot or CSV</div>
          <div style={s.introSub}>Claude reads the file and proposes rows. You confirm what&apos;s real before anything is saved.</div>
        </div>
      </div>

      {/* Target */}
      <div style={s.segLabel}>Import into</div>
      <div style={s.seg}>
        {(["hosp", "lineup", "budget"] as ImportTarget[]).map((t) => (
          <button key={t} style={{ ...s.segBtn, ...(target === t ? s.segOn : {}) }} onClick={() => setTarget(t)} type="button">
            {TARGET_LABEL[t]}
          </button>
        ))}
      </div>

      {/* Dropzone */}
      {(status === "idle" || status === "extracting" || status === "error" || status === "done") && (
        <div
          style={{ ...s.dropzone, ...(status === "extracting" ? s.dropzoneBusy : {}) }}
          onClick={() => status !== "extracting" && fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            const file = e.dataTransfer.files[0]
            if (file && fileRef.current) {
              const dt = new DataTransfer(); dt.items.add(file)
              fileRef.current.files = dt.files
              fileRef.current.dispatchEvent(new Event("change", { bubbles: true }))
            }
          }}
        >
          <input ref={fileRef} type="file" accept="image/*,.csv,.tsv" style={{ display: "none" }} onChange={handleFile} />
          {status === "extracting" ? (
            <>
              <Loader size={22} style={{ animation: "lk-spin 0.8s linear infinite", color: "var(--accent)" }} />
              <div style={s.dropTitle}>Reading {fileName}…</div>
              <div style={s.dropSub}>Claude is extracting rows</div>
            </>
          ) : (
            <>
              <div style={s.dropIcon}><Upload size={22} strokeWidth={1.8} /></div>
              <div style={s.dropTitle}>Drop a file or click to browse</div>
              <div style={s.dropSub}>PNG, JPG, CSV or TSV</div>
            </>
          )}
        </div>
      )}

      {status === "error" && <div style={s.error}>{message}</div>}
      {status === "done" && (
        <div style={s.done}><Check size={15} strokeWidth={2.4} /> Rows saved. The {TARGET_LABEL[target]} tab is updated.</div>
      )}

      {/* Review */}
      {(status === "review" || status === "saving") && (
        <div style={s.reviewWrap}>
          <div style={s.reviewHead}>
            <FileText size={15} strokeWidth={2} style={{ color: "var(--accent)" }} />
            <span style={{ fontWeight: 600 }}>{rows.length} rows found</span>
            <span style={{ color: "var(--muted)" }}>· uncheck any to skip</span>
          </div>
          <div style={s.reviewList}>
            {rows.map((r, i) => {
              const { _checked, ...display } = r
              return (
                <label key={i} style={{ ...s.reviewRow, ...(!_checked ? s.reviewOff : {}) }}>
                  <input type="checkbox" checked={_checked} onChange={() => toggle(i)} style={{ accentColor: "var(--accent)", width: 16, height: 16, flexShrink: 0 }} />
                  <div style={s.pills}>
                    {Object.entries(display).map(([k, v]) => (
                      <span key={k} style={s.pill}>
                        <span style={{ color: "var(--muted)" }}>{k}</span>{" "}
                        <span style={{ color: "var(--text)", fontWeight: 500 }}>{Array.isArray(v) ? v.join(",") : String(v)}</span>
                      </span>
                    ))}
                  </div>
                </label>
              )
            })}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button style={s.saveBtn} onClick={saveSelected} disabled={status === "saving" || selectedCount === 0} type="button">
              {status === "saving" ? "Saving…" : `Save ${selectedCount} ${selectedCount === 1 ? "row" : "rows"}`}
            </button>
            <button style={s.cancelBtn} onClick={() => { setRows([]); setStatus("idle") }} type="button">
              <X size={14} strokeWidth={2.4} /> Cancel
            </button>
          </div>
        </div>
      )}

      <div style={s.note}>
        Tip: smaller, focused screenshots extract more reliably than one giant sheet. Column names don&apos;t need to match — Claude infers the mapping.
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  intro: {
    display: "flex",
    gap: 12,
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: "14px 16px",
    marginBottom: 18,
    boxShadow: "var(--shadow-sm)",
  },
  introIcon: {
    width: 34, height: 34, borderRadius: 9, flexShrink: 0,
    background: "var(--accent-tint)", color: "var(--accent)",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  introTitle: { fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 3 },
  introSub: { fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.5 },
  segLabel: { fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 },
  seg: { display: "flex", gap: 3, padding: 4, background: "var(--bg-2)", borderRadius: 11, marginBottom: 18 },
  segBtn: {
    flex: 1, background: "transparent", border: "none", borderRadius: 8,
    padding: "8px", fontSize: 13, fontWeight: 500, color: "var(--text-2)", cursor: "pointer",
  },
  segOn: { background: "var(--card)", color: "var(--text)", fontWeight: 600, boxShadow: "var(--shadow-sm)" },
  dropzone: {
    border: "1.5px dashed var(--border-strong)",
    borderRadius: "var(--radius)",
    padding: "40px 20px",
    display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
    cursor: "pointer", background: "var(--card)", textAlign: "center",
    transition: "border-color 0.15s, background 0.15s",
  },
  dropzoneBusy: { cursor: "default", borderColor: "var(--accent)" },
  dropIcon: {
    width: 46, height: 46, borderRadius: 12, marginBottom: 4,
    background: "var(--inset)", color: "var(--accent)",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  dropTitle: { fontSize: 14, fontWeight: 600, color: "var(--text)" },
  dropSub: { fontSize: 12, color: "var(--muted)" },
  error: { background: "var(--red-tint)", borderRadius: 9, padding: "11px 13px", fontSize: 13, color: "var(--red)", marginTop: 14 },
  done: {
    background: "var(--green-tint)", borderRadius: 9, padding: "11px 13px",
    fontSize: 13, color: "var(--green)", marginTop: 14, display: "flex", alignItems: "center", gap: 7, fontWeight: 500,
  },
  reviewWrap: { marginTop: 4 },
  reviewHead: { display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--text-2)", marginBottom: 10 },
  reviewList: {
    display: "flex", flexDirection: "column", gap: 6, maxHeight: 380, overflowY: "auto",
    background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 8,
  },
  reviewRow: {
    display: "flex", alignItems: "flex-start", gap: 10, padding: "9px 10px",
    borderRadius: 9, cursor: "pointer", background: "var(--inset)",
  },
  reviewOff: { opacity: 0.45 },
  pills: { display: "flex", flexWrap: "wrap", gap: 6 },
  pill: { fontSize: 12, padding: "2px 8px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6 },
  saveBtn: {
    flex: 1, background: "var(--accent)", border: "none", color: "#fff",
    fontSize: 13.5, fontWeight: 600, borderRadius: 10, padding: "11px", cursor: "pointer",
  },
  cancelBtn: {
    display: "flex", alignItems: "center", gap: 5, background: "var(--inset)",
    border: "1px solid var(--border)", color: "var(--text-2)", fontSize: 13, fontWeight: 500,
    borderRadius: 10, padding: "11px 16px", cursor: "pointer",
  },
  note: {
    marginTop: 16, fontSize: 12, color: "var(--muted)", lineHeight: 1.55,
    background: "var(--bg-2)", borderRadius: 10, padding: "11px 13px",
  },
}
