"use client"

import { useState, useRef } from "react"
import { X, Upload, Loader, Plus, Trash2, Check, Wine, Settings2, Package } from "lucide-react"
import type { LineupEntry, RiderItem } from "@/lib/types"

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
const CATS: { key: RiderItem["category"]; label: string; icon: React.ElementType }[] = [
  { key: "hospitality", label: "Hospitality", icon: Wine },
  { key: "technical", label: "Technical", icon: Settings2 },
  { key: "other", label: "Other", icon: Package },
]

export default function RiderModal({
  entry, onSave, onClose,
}: { entry: LineupEntry; onSave: (rider: RiderItem[]) => void; onClose: () => void }) {
  const [rider, setRider] = useState<RiderItem[]>(entry.rider ?? [])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function commit(next: RiderItem[]) {
    setRider(next)
    onSave(next)
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true); setMsg(null)
    try {
      const body: Record<string, unknown> = { artistName: entry.name }
      if (file.type === "application/pdf") {
        const buf = await file.arrayBuffer()
        body.pdf = btoa(Array.from(new Uint8Array(buf)).map((b) => String.fromCharCode(b)).join(""))
      } else if (file.type.startsWith("image/")) {
        const buf = await file.arrayBuffer()
        body.image = btoa(Array.from(new Uint8Array(buf)).map((b) => String.fromCharCode(b)).join(""))
        body.imageMime = file.type
      } else {
        body.fileText = await file.text()
      }
      const res = await fetch("/api/rider", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Couldn't read the rider")
      const newItems: RiderItem[] = (json.items ?? []).map((it: { category?: string; item?: string; qty?: string }) => ({
        id: uid(),
        category: (it.category === "technical" || it.category === "other" ? it.category : "hospitality") as RiderItem["category"],
        item: it.item ?? "Item", qty: it.qty ?? "", fulfilled: false,
      }))
      if (!newItems.length) { setMsg("Couldn't pull items from that file — add them manually below."); setBusy(false); return }
      commit([...rider, ...newItems])
      setMsg(`Added ${newItems.length} items — check them off as you fulfil them.`)
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : "Failed")
    }
    setBusy(false)
    if (fileRef.current) fileRef.current.value = ""
  }

  function patch(id: string, p: Partial<RiderItem>) { commit(rider.map((r) => (r.id === id ? { ...r, ...p } : r))) }
  function remove(id: string) { commit(rider.filter((r) => r.id !== id)) }
  function addItem(category: RiderItem["category"]) { commit([...rider, { id: uid(), category, item: "", qty: "", fulfilled: false }]) }

  const done = rider.filter((r) => r.fulfilled).length

  return (
    <div style={s.overlay} onMouseDown={onClose}>
      <div style={s.modal} onMouseDown={(e) => e.stopPropagation()}>
        <div style={s.head}>
          <div>
            <div style={s.title}>{entry.name || "Artist"} · Rider</div>
            <div style={s.sub}>{rider.length ? `${done}/${rider.length} fulfilled` : "Upload the rider or add items"}</div>
          </div>
          <button style={s.closeBtn} onClick={onClose} type="button"><X size={17} strokeWidth={2} /></button>
        </div>

        <div style={s.body}>
          <div style={s.drop} onClick={() => !busy && fileRef.current?.click()}>
            <input ref={fileRef} type="file" accept="application/pdf,image/*,.txt,.csv" style={{ display: "none" }} onChange={handleFile} />
            {busy ? <Loader size={18} style={{ animation: "lk-spin 0.8s linear infinite", color: "var(--accent)" }} /> : <Upload size={18} strokeWidth={1.8} style={{ color: "var(--accent)" }} />}
            <span style={s.dropText}>{busy ? "Reading the rider…" : "Upload rider (PDF or photo)"}</span>
          </div>
          {msg && <div style={s.msg}>{msg}</div>}

          {CATS.map(({ key, label, icon: Icon }) => {
            const items = rider.filter((r) => r.category === key)
            return (
              <div key={key} style={s.cat}>
                <div style={s.catHead}>
                  <Icon size={14} strokeWidth={2} style={{ color: "var(--accent)" }} />
                  <span style={s.catTitle}>{label}</span>
                  <span style={s.catCount}>{items.filter((i) => i.fulfilled).length}/{items.length}</span>
                  <button style={s.catAdd} onClick={() => addItem(key)} type="button"><Plus size={13} strokeWidth={2.4} /></button>
                </div>
                {items.length === 0 ? (
                  <div style={s.catEmpty}>Nothing here.</div>
                ) : items.map((it) => (
                  <div key={it.id} style={s.item}>
                    <button style={{ ...s.check, ...(it.fulfilled ? s.checkOn : {}) }} onClick={() => patch(it.id, { fulfilled: !it.fulfilled })} type="button">
                      {it.fulfilled && <Check size={13} strokeWidth={3} />}
                    </button>
                    <input style={{ ...s.itemName, ...(it.fulfilled ? { textDecoration: "line-through", color: "var(--muted)" } : {}) }} value={it.item} placeholder="Item" onChange={(e) => patch(it.id, { item: e.target.value })} />
                    <input style={s.itemQty} value={it.qty} placeholder="qty" onChange={(e) => patch(it.id, { qty: e.target.value })} />
                    <button style={s.itemTrash} onClick={() => remove(it.id)} type="button"><Trash2 size={13} strokeWidth={2} /></button>
                  </div>
                ))}
              </div>
            )
          })}
        </div>

        <div style={s.foot}>
          <span style={s.footNote}>Changes save automatically</span>
          <button style={s.doneBtn} onClick={onClose} type="button">Done</button>
        </div>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  overlay: { position: "fixed", inset: 0, background: "rgba(28,27,23,0.32)", backdropFilter: "blur(2px)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", zIndex: 100, overflowY: "auto" },
  modal: { background: "var(--card)", borderRadius: 18, width: "100%", maxWidth: 460, boxShadow: "var(--shadow-lg)", border: "1px solid var(--border)", animation: "lk-fade-up 0.2s ease both" },
  head: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border)" },
  title: { fontFamily: "var(--font-fraunces), serif", fontSize: 17, fontWeight: 600, color: "var(--text)" },
  sub: { fontSize: 12, color: "var(--muted)", marginTop: 2 },
  closeBtn: { width: 30, height: 30, borderRadius: 8, background: "var(--inset)", border: "none", color: "var(--text-2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  body: { padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14, maxHeight: "62vh", overflowY: "auto" },
  drop: { display: "flex", alignItems: "center", justifyContent: "center", gap: 9, border: "1.5px dashed var(--border-strong)", borderRadius: 11, padding: "16px", cursor: "pointer", background: "var(--accent-tint)" },
  dropText: { fontSize: 13.5, fontWeight: 600, color: "var(--text)" },
  msg: { fontSize: 12.5, color: "var(--text-2)", background: "var(--inset)", borderRadius: 8, padding: "9px 11px", lineHeight: 1.45 },
  cat: {},
  catHead: { display: "flex", alignItems: "center", gap: 7, marginBottom: 7 },
  catTitle: { fontSize: 13, fontWeight: 600, color: "var(--text)" },
  catCount: { fontSize: 11, fontWeight: 600, color: "var(--muted)", background: "var(--bg-2)", borderRadius: 5, padding: "1px 7px" },
  catAdd: { marginLeft: "auto", width: 24, height: 24, borderRadius: 6, background: "var(--inset)", border: "1px solid var(--border)", color: "var(--accent)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  catEmpty: { fontSize: 12, color: "var(--muted)", padding: "4px 2px 8px" },
  item: { display: "flex", alignItems: "center", gap: 8, padding: "5px 0" },
  check: { width: 22, height: 22, borderRadius: 6, border: "2px solid var(--border-strong)", background: "transparent", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  checkOn: { background: "var(--green)", border: "2px solid var(--green)" },
  itemName: { flex: 1, minWidth: 0, background: "var(--inset)", border: "1px solid var(--border)", borderRadius: 7, color: "var(--text)", fontSize: 13, padding: "6px 9px", outline: "none" },
  itemQty: { width: 56, background: "var(--inset)", border: "1px solid var(--border)", borderRadius: 7, color: "var(--text-2)", fontSize: 12.5, padding: "6px 8px", outline: "none", textAlign: "center" },
  itemTrash: { width: 26, height: 26, borderRadius: 6, background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  foot: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderTop: "1px solid var(--border)" },
  footNote: { fontSize: 11.5, color: "var(--muted)" },
  doneBtn: { background: "var(--accent)", color: "#fff", border: "none", borderRadius: 9, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" },
}
