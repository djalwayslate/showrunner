"use client"

import { useState, useEffect } from "react"
import { Plus, Trash2, Circle, CircleDot, CheckCircle2, Sparkles, Loader, Check, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { Task } from "@/lib/types"

type PlanTask = { title: string; phase: Task["phase"]; days_before: number; owner?: string }

const PHASES: { key: Task["phase"]; label: string; hint: string }[] = [
  { key: "prep", label: "Pre-production", hint: "Everything before the week of" },
  { key: "week", label: "Week of", hint: "Final logistics" },
  { key: "day", label: "Day of", hint: "Show-day run sheet" },
  { key: "post", label: "Post-event", hint: "Settle, pay, debrief" },
]

const STATUS_NEXT: Record<Task["status"], Task["status"]> = { todo: "doing", doing: "done", done: "todo" }

export default function PlannerTab({ eventId, refreshKey }: { eventId: string; refreshKey: number }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [planning, setPlanning] = useState(false)
  const [preview, setPreview] = useState<{ tasks: PlanTask[]; stages: string[] } | null>(null)
  const [applying, setApplying] = useState(false)
  const [planError, setPlanError] = useState<string | null>(null)
  const [eventStart, setEventStart] = useState<string | null>(null)
  const db = createClient()

  async function load() {
    setLoading(true)
    const { data } = await db.from("tasks").select("*").eq("event_id", eventId).order("sort_order")
    if (data) setTasks(data)
    setLoading(false)
  }

  useEffect(() => {
    if (eventId) load()
  }, [eventId, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  function dueFrom(start: string, daysBefore: number): string {
    const d = new Date(start + "T00:00:00")
    d.setDate(d.getDate() - daysBefore)
    return d.toISOString().slice(0, 10)
  }

  async function runAutoPlan() {
    setPlanning(true); setPlanError(null)
    try {
      const [{ data: event }, { data: playbook }] = await Promise.all([
        db.from("events").select("*").eq("id", eventId).single(),
        db.from("playbook_entries").select("category, title, body").order("sort_order"),
      ])
      setEventStart(event?.start_date ?? null)
      const res = await fetch("/api/autoplan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event, playbook, existingTasks: tasks.map((t) => t.title) }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Auto-plan failed")
      setPreview({ tasks: json.tasks ?? [], stages: json.stages ?? [] })
    } catch (err: unknown) {
      setPlanError(err instanceof Error ? err.message : "Something went wrong")
    }
    setPlanning(false)
  }

  async function applyPlan() {
    if (!preview) return
    setApplying(true)
    const start = eventStart
    const rows = preview.tasks.map((t, i) => ({
      event_id: eventId,
      title: t.title,
      phase: t.phase,
      owner: t.owner ?? "",
      due_date: start ? dueFrom(start, t.days_before) : null,
      status: "todo",
      sort_order: tasks.length + i,
    }))
    const { data } = await db.from("tasks").insert(rows).select()
    // apply suggested stages to the event if it has none set
    if (preview.stages.length) {
      const { data: ev } = await db.from("events").select("stages").eq("id", eventId).single()
      if (!ev?.stages || (Array.isArray(ev.stages) && ev.stages.length <= 1)) {
        await db.from("events").update({ stages: preview.stages }).eq("id", eventId)
      }
    }
    if (data) setTasks((prev) => [...prev, ...data])
    setApplying(false)
    setPreview(null)
  }

  async function addTask(phase: Task["phase"]) {
    const { data } = await db
      .from("tasks")
      .insert({ event_id: eventId, title: "New task", phase, owner: "", status: "todo", sort_order: tasks.length })
      .select()
      .single()
    if (data) setTasks((prev) => [...prev, data])
  }

  async function updateTask(id: string, patch: Partial<Task>) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
    await db.from("tasks").update(patch).eq("id", id)
  }

  async function removeTask(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id))
    await db.from("tasks").delete().eq("id", id)
  }

  const done = tasks.filter((t) => t.status === "done").length
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0

  if (loading) return <div style={s.skeleton} />

  return (
    <div>
      {/* Auto-plan master brain */}
      <div style={s.brain}>
        <div style={s.brainIcon}><Sparkles size={16} strokeWidth={2} /></div>
        <div style={{ flex: 1 }}>
          <div style={s.brainTitle}>Auto-plan with the master brain</div>
          <div style={s.brainSub}>Generates the full task list with deadlines counted back from the event date, using your Playbook. You review before anything&apos;s added.</div>
        </div>
        <button style={s.brainBtn} onClick={runAutoPlan} disabled={planning} type="button">
          {planning ? <Loader size={15} style={{ animation: "lk-spin 0.8s linear infinite" }} /> : <Sparkles size={15} strokeWidth={2.2} />}
          {planning ? "Thinking…" : tasks.length ? "Generate more" : "Auto-plan"}
        </button>
      </div>
      {planError && <div style={s.planError}>{planError}</div>}

      {preview && (
        <div style={s.previewOverlay} onMouseDown={() => setPreview(null)}>
          <div style={s.previewModal} onMouseDown={(e) => e.stopPropagation()}>
            <div style={s.previewHead}>
              <div>
                <div style={s.previewTitle}>Proposed plan</div>
                <div style={s.previewSub}>{preview.tasks.length} tasks{preview.stages.length ? ` · stages: ${preview.stages.join(", ")}` : ""}</div>
              </div>
              <button style={s.previewClose} onClick={() => setPreview(null)} type="button"><X size={17} strokeWidth={2} /></button>
            </div>
            <div style={s.previewList}>
              {(["prep", "week", "day", "post"] as Task["phase"][]).map((ph) => {
                const items = preview.tasks.filter((t) => t.phase === ph)
                if (!items.length) return null
                return (
                  <div key={ph} style={{ marginBottom: 12 }}>
                    <div style={s.previewPhase}>{PHASES.find((p) => p.key === ph)?.label}</div>
                    {items.map((t, i) => (
                      <div key={i} style={s.previewRow}>
                        <span style={s.previewDot} />
                        <span style={{ flex: 1 }}>{t.title}</span>
                        <span style={s.previewWhen}>{t.days_before > 0 ? `${t.days_before}d before` : t.days_before === 0 ? "day of" : `${-t.days_before}d after`}</span>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
            <div style={s.previewFoot}>
              <button style={s.previewCancel} onClick={() => setPreview(null)} type="button">Cancel</button>
              <button style={s.previewApply} onClick={applyPlan} disabled={applying} type="button">
                {applying ? "Adding…" : <><Check size={15} strokeWidth={2.4} /> Add all {preview.tasks.length}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={s.progressCard}>
        <div style={s.progressTop}>
          <span style={s.progressLabel}>Progress</span>
          <span style={s.progressNum} className="tnum">{done}/{tasks.length} done · {pct}%</span>
        </div>
        <div style={s.progressTrack}>
          <div style={{ ...s.progressFill, width: `${pct}%` }} />
        </div>
      </div>

      {PHASES.map(({ key, label, hint }) => {
        const items = tasks.filter((t) => t.phase === key)
        return (
          <section key={key} style={s.section}>
            <div style={s.phaseHead}>
              <div>
                <h2 style={s.phaseTitle}>{label}</h2>
                <span style={s.phaseHint}>{hint}</span>
              </div>
              <button style={s.addPhase} onClick={() => addTask(key)} type="button">
                <Plus size={14} strokeWidth={2.4} /> Add
              </button>
            </div>

            {items.length === 0 ? (
              <div style={s.emptyPhase}>No tasks in this phase.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {items.map((t) => (
                  <div key={t.id} style={{ ...s.task, ...(t.status === "done" ? s.taskDone : {}) }}>
                    <button style={s.statusBtn} onClick={() => updateTask(t.id, { status: STATUS_NEXT[t.status] })} type="button" title={t.status}>
                      {t.status === "todo" && <Circle size={18} strokeWidth={2} style={{ color: "var(--muted)" }} />}
                      {t.status === "doing" && <CircleDot size={18} strokeWidth={2} style={{ color: "var(--gold)" }} />}
                      {t.status === "done" && <CheckCircle2 size={18} strokeWidth={2} style={{ color: "var(--green)" }} />}
                    </button>
                    <input
                      style={{ ...s.taskTitle, ...(t.status === "done" ? { textDecoration: "line-through", color: "var(--muted)" } : {}) }}
                      value={t.title}
                      onChange={(e) => setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, title: e.target.value } : x)))}
                      onBlur={() => db.from("tasks").update({ title: t.title }).eq("id", t.id)}
                    />
                    <input
                      style={s.owner}
                      placeholder="Owner"
                      value={t.owner}
                      onChange={(e) => setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, owner: e.target.value } : x)))}
                      onBlur={() => db.from("tasks").update({ owner: t.owner }).eq("id", t.id)}
                    />
                    <input
                      type="date"
                      style={s.due}
                      value={t.due_date ?? ""}
                      onChange={(e) => updateTask(t.id, { due_date: e.target.value || null })}
                    />
                    <button style={s.trashBtn} onClick={() => removeTask(t.id)} title="Remove" type="button">
                      <Trash2 size={14} strokeWidth={2} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  skeleton: { height: 400, background: "var(--inset)", borderRadius: "var(--radius)" },
  brain: { display: "flex", alignItems: "center", gap: 12, background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "14px 16px", marginBottom: 14, boxShadow: "var(--shadow-sm)" },
  brainIcon: { width: 34, height: 34, borderRadius: 9, flexShrink: 0, background: "var(--accent-tint)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" },
  brainTitle: { fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 2 },
  brainSub: { fontSize: 12, color: "var(--text-2)", lineHeight: 1.5 },
  brainBtn: { display: "flex", alignItems: "center", gap: 7, background: "var(--accent)", color: "#fff", border: "none", borderRadius: 9, padding: "10px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0 },
  planError: { fontSize: 12.5, color: "var(--red)", background: "var(--red-tint)", borderRadius: 8, padding: "9px 11px", marginBottom: 14 },
  previewOverlay: { position: "fixed", inset: 0, background: "rgba(28,27,23,0.32)", backdropFilter: "blur(2px)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", zIndex: 100, overflowY: "auto" },
  previewModal: { background: "var(--card)", borderRadius: 18, width: "100%", maxWidth: 480, boxShadow: "var(--shadow-lg)", border: "1px solid var(--border)", animation: "lk-fade-up 0.2s ease both" },
  previewHead: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border)" },
  previewTitle: { fontFamily: "var(--font-fraunces), serif", fontSize: 18, fontWeight: 600, color: "var(--text)" },
  previewSub: { fontSize: 12, color: "var(--muted)", marginTop: 2 },
  previewClose: { width: 30, height: 30, borderRadius: 8, background: "var(--inset)", border: "none", color: "var(--text-2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  previewList: { padding: "14px 20px", maxHeight: "50vh", overflowY: "auto" },
  previewPhase: { fontSize: 11, fontWeight: 600, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 },
  previewRow: { display: "flex", alignItems: "center", gap: 9, fontSize: 13, color: "var(--text)", padding: "5px 0" },
  previewDot: { width: 5, height: 5, borderRadius: "50%", background: "var(--border-strong)", flexShrink: 0 },
  previewWhen: { fontSize: 11, color: "var(--muted)", fontWeight: 500, whiteSpace: "nowrap" },
  previewFoot: { display: "flex", justifyContent: "flex-end", gap: 8, padding: "14px 20px", borderTop: "1px solid var(--border)" },
  previewCancel: { background: "var(--inset)", border: "1px solid var(--border)", color: "var(--text-2)", borderRadius: 9, padding: "10px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer" },
  previewApply: { display: "flex", alignItems: "center", gap: 6, background: "var(--accent)", color: "#fff", border: "none", borderRadius: 9, padding: "10px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  progressCard: {
    background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)",
    padding: "14px 16px", marginBottom: 22, boxShadow: "var(--shadow-sm)",
  },
  progressTop: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 9 },
  progressLabel: { fontSize: 12.5, fontWeight: 600, color: "var(--text)" },
  progressNum: { fontSize: 12.5, color: "var(--text-2)", fontWeight: 500 },
  progressTrack: { height: 7, background: "var(--bg-2)", borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%", background: "var(--accent)", borderRadius: 4, transition: "width 0.4s ease" },
  section: { marginBottom: 22 },
  phaseHead: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 },
  phaseTitle: { fontFamily: "var(--font-fraunces), serif", fontSize: 16, fontWeight: 600, color: "var(--text)", margin: 0 },
  phaseHint: { fontSize: 11.5, color: "var(--muted)" },
  addPhase: {
    display: "flex", alignItems: "center", gap: 5, background: "transparent", border: "none",
    color: "var(--accent)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: "4px 6px",
  },
  emptyPhase: {
    fontSize: 12.5, color: "var(--muted)", padding: "12px", textAlign: "center",
    background: "var(--card)", border: "1px dashed var(--border)", borderRadius: 11,
  },
  task: {
    display: "flex", alignItems: "center", gap: 9,
    background: "var(--card)", border: "1px solid var(--border)", borderRadius: 11,
    padding: "8px 10px", boxShadow: "var(--shadow-sm)",
  },
  taskDone: { background: "var(--bg-2)" },
  statusBtn: {
    background: "transparent", border: "none", cursor: "pointer", padding: 0,
    display: "flex", alignItems: "center", flexShrink: 0,
  },
  taskTitle: {
    flex: 1, minWidth: 0, background: "transparent", border: "1px solid transparent", borderRadius: 7,
    color: "var(--text)", fontSize: 13.5, fontWeight: 500, padding: "5px 7px", margin: "-5px 0", outline: "none",
  },
  owner: {
    width: 86, background: "var(--inset)", border: "1px solid var(--border)", borderRadius: 7,
    color: "var(--text-2)", fontSize: 12, padding: "5px 8px", outline: "none",
  },
  due: {
    width: 124, background: "var(--inset)", border: "1px solid var(--border)", borderRadius: 7,
    color: "var(--text-2)", fontSize: 12, padding: "5px 7px", outline: "none",
  },
  trashBtn: {
    width: 28, height: 28, borderRadius: 7, background: "transparent", border: "none",
    color: "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
}
