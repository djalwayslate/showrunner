"use client"

import { useState, useEffect } from "react"
import { Link2, Check, Copy, Plus, X, Wine, UtensilsCrossed, Globe, AtSign, ExternalLink, MapPin, Users, Banknote, Percent } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

const APP_URL = "https://lk-ops-dusky.vercel.app"
const CURRENCIES = ["EUR", "USD", "GBP", "PLN", "SEK"]

type Org = {
  brand_name: string
  tagline: string
  website_url: string
  instagram_url: string
  facebook_url: string
  default_stages: string[]
  default_venue: string
  default_capacity: number
  default_drinks: number
  default_food: number
  ticket_types: string[]
  default_currency: string
  default_vat_pct: number
}

export default function SettingsHQ({ isAdmin }: { isAdmin: boolean }) {
  const [org, setOrg] = useState<Org | null>(null)
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)
  const db = createClient()

  useEffect(() => {
    db.from("org_settings").select("*").eq("id", 1).single().then(({ data }) => {
      if (data) setOrg({
        brand_name: data.brand_name ?? "Latino Kings",
        tagline: data.tagline ?? "",
        website_url: data.website_url ?? "",
        instagram_url: data.instagram_url ?? "",
        facebook_url: data.facebook_url ?? "",
        default_stages: Array.isArray(data.default_stages) ? data.default_stages : ["Main Stage"],
        default_venue: data.default_venue ?? "",
        default_capacity: data.default_capacity ?? 0,
        default_drinks: data.default_drinks ?? 4,
        default_food: data.default_food ?? 1,
        ticket_types: Array.isArray(data.ticket_types) ? data.ticket_types : ["Free", "Paper", "Box", "Paid", "VIP"],
        default_currency: data.default_currency ?? "EUR",
        default_vat_pct: data.default_vat_pct ?? 21,
      })
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function save(patch: Partial<Org>) {
    if (!org) return
    const next = { ...org, ...patch }
    setOrg(next)
    await db.from("org_settings").update(patch).eq("id", 1)
    setSaved(true); setTimeout(() => setSaved(false), 1200)
  }

  function copy() {
    navigator.clipboard.writeText(APP_URL)
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }

  if (!org) return <div style={s.skeleton} />

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Brand */}
      <div style={s.card}>
        <div style={s.cardHead}>
          <span style={s.cardTitle}>Brand</span>
          {saved && <span style={s.savedTag}><Check size={12} strokeWidth={2.6} /> Saved</span>}
        </div>
        <div style={s.brandRow}>
          <div style={s.mark}>{org.brand_name.slice(0, 2).toUpperCase()}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <input style={s.brandInput} value={org.brand_name} disabled={!isAdmin}
              onChange={(e) => setOrg({ ...org, brand_name: e.target.value })}
              onBlur={() => save({ brand_name: org.brand_name })} />
            <input style={s.taglineInput} value={org.tagline} disabled={!isAdmin} placeholder="Tagline / genre · city"
              onChange={(e) => setOrg({ ...org, tagline: e.target.value })}
              onBlur={() => save({ tagline: org.tagline })} />
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
          <SocialInput icon={Globe} placeholder="Website URL" value={org.website_url} disabled={!isAdmin}
            onChange={(v) => setOrg({ ...org, website_url: v })} onBlur={() => save({ website_url: org.website_url })} />
          <SocialInput icon={AtSign} placeholder="Instagram URL or @handle" value={org.instagram_url} disabled={!isAdmin}
            onChange={(v) => setOrg({ ...org, instagram_url: v })} onBlur={() => save({ instagram_url: org.instagram_url })} />
          <SocialInput icon={ExternalLink} placeholder="Facebook Page URL" value={org.facebook_url} disabled={!isAdmin}
            onChange={(v) => setOrg({ ...org, facebook_url: v })} onBlur={() => save({ facebook_url: org.facebook_url })} />
        </div>
      </div>

      {/* New-event defaults */}
      <div style={s.card}>
        <div style={s.cardTitle}>New-event defaults</div>
        <div style={s.cardSub}>Every new event starts with these — set once, skip repetition.</div>

        <div style={s.fieldLabel}>Stages</div>
        <ListEditor items={org.default_stages} disabled={!isAdmin} placeholder="Stage name"
          onChange={(v) => save({ default_stages: v })} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 12px", marginTop: 14 }}>
          <div>
            <div style={{ ...s.fieldLabel, display: "flex", alignItems: "center", gap: 5 }}>
              <MapPin size={12} strokeWidth={2} style={{ color: "var(--accent)" }} /> Default venue
            </div>
            <input style={s.textInput} value={org.default_venue} disabled={!isAdmin} placeholder="Venue name"
              onChange={(e) => setOrg({ ...org, default_venue: e.target.value })}
              onBlur={() => save({ default_venue: org.default_venue })} />
          </div>
          <div>
            <div style={{ ...s.fieldLabel, display: "flex", alignItems: "center", gap: 5 }}>
              <Users size={12} strokeWidth={2} style={{ color: "var(--accent)" }} /> Default capacity
            </div>
            <input style={s.textInput} value={org.default_capacity || ""} disabled={!isAdmin} placeholder="500" type="number" min={0}
              onChange={(e) => setOrg({ ...org, default_capacity: Number(e.target.value) })}
              onBlur={() => save({ default_capacity: org.default_capacity })} />
          </div>
        </div>
      </div>

      {/* Hospitality defaults */}
      <div style={s.card}>
        <div style={s.cardTitle}>Hospitality defaults</div>
        <div style={s.cardSub}>Per-guest allowances pre-filled in every event&apos;s hosp board.</div>
        <div style={{ display: "flex", gap: 12 }}>
          <Stepper label="Drink tickets / guest / day" icon={Wine} value={org.default_drinks} disabled={!isAdmin} onChange={(v) => save({ default_drinks: v })} />
          <Stepper label="Food coupons / guest / day" icon={UtensilsCrossed} value={org.default_food} disabled={!isAdmin} onChange={(v) => save({ default_food: v })} />
        </div>
      </div>

      {/* Guest ticket types */}
      <div style={s.card}>
        <div style={s.cardTitle}>Guest ticket types</div>
        <div style={s.cardSub}>Used in the Guest list — make them match how you sort your door.</div>
        <ListEditor items={org.ticket_types} disabled={!isAdmin} placeholder="Ticket type"
          onChange={(v) => save({ ticket_types: v })} />
      </div>

      {/* Budget */}
      <div style={s.card}>
        <div style={s.cardTitle}>Budget</div>
        <div style={s.cardSub}>Default currency and VAT rate used across all budget calculations.</div>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ ...s.fieldLabel, display: "flex", alignItems: "center", gap: 5 }}>
              <Banknote size={12} strokeWidth={2} style={{ color: "var(--accent)" }} /> Currency
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {CURRENCIES.map((c) => (
                <button key={c} type="button" disabled={!isAdmin}
                  style={{ ...s.currencyBtn, ...(org.default_currency === c ? s.currencyOn : {}) }}
                  onClick={() => save({ default_currency: c })}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ ...s.fieldLabel, display: "flex", alignItems: "center", gap: 5 }}>
              <Percent size={12} strokeWidth={2} style={{ color: "var(--accent)" }} /> VAT %
            </div>
            <input style={{ ...s.textInput, width: 80 }} value={org.default_vat_pct} disabled={!isAdmin} type="number" min={0} max={100}
              onChange={(e) => setOrg({ ...org, default_vat_pct: Number(e.target.value) })}
              onBlur={() => save({ default_vat_pct: org.default_vat_pct })} />
          </div>
        </div>
      </div>

      {/* Team link */}
      <div style={s.card}>
        <div style={s.cardTitle}>Team invite link</div>
        <div style={s.cardSub}>Share with anyone who needs access. They sign up, then you set their role in Team.</div>
        <div style={s.linkRow}>
          <Link2 size={15} strokeWidth={2} style={{ color: "var(--muted)" }} />
          <span style={s.linkText}>{APP_URL}</span>
          <button style={s.copyBtn} onClick={copy} type="button">
            {copied ? <Check size={14} strokeWidth={2.4} /> : <Copy size={14} strokeWidth={2} />}{copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      {!isAdmin && <div style={s.note}>Only admins can change settings.</div>}
    </div>
  )
}

function SocialInput({ icon: Icon, placeholder, value, disabled, onChange, onBlur }: {
  icon: React.ElementType; placeholder: string; value: string; disabled?: boolean
  onChange: (v: string) => void; onBlur: () => void
}) {
  return (
    <div style={s.socialRow}>
      <Icon size={14} strokeWidth={2} style={{ color: "var(--muted)", flexShrink: 0 }} />
      <input style={s.socialInput} value={value} disabled={disabled} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)} onBlur={onBlur} />
    </div>
  )
}

function ListEditor({ items, onChange, disabled, placeholder }: { items: string[]; onChange: (v: string[]) => void; disabled?: boolean; placeholder?: string }) {
  const [local, setLocal] = useState(items)
  useEffect(() => setLocal(items), [items])
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
      {local.map((it, i) => (
        <div key={i} style={s.chip}>
          <input style={s.chipInput} value={it} disabled={disabled} size={Math.max(4, it.length)}
            onChange={(e) => setLocal(local.map((x, j) => (j === i ? e.target.value : x)))}
            onBlur={() => onChange(local.filter((x) => x.trim()))} />
          {!disabled && <button style={s.chipX} onClick={() => onChange(local.filter((_, j) => j !== i))} type="button"><X size={12} strokeWidth={2.4} /></button>}
        </div>
      ))}
      {!disabled && (
        <button style={s.chipAdd} onClick={() => onChange([...local, "New"])} type="button"><Plus size={13} strokeWidth={2.4} /></button>
      )}
    </div>
  )
}

function Stepper({ label, icon: Icon, value, onChange, disabled }: { label: string; icon: React.ElementType; value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ ...s.fieldLabel, display: "flex", alignItems: "center", gap: 6 }}><Icon size={13} strokeWidth={2} style={{ color: "var(--accent)" }} />{label}</div>
      <div style={s.stepper}>
        <button style={s.stepBtn} disabled={disabled} onClick={() => onChange(Math.max(0, value - 1))} type="button">−</button>
        <span style={s.stepVal} className="tnum">{value}</span>
        <button style={s.stepBtn} disabled={disabled} onClick={() => onChange(value + 1)} type="button">+</button>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  skeleton: { height: 360, background: "var(--inset)", borderRadius: "var(--radius)" },
  card: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "16px", boxShadow: "var(--shadow-sm)" },
  cardHead: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  cardTitle: { fontFamily: "var(--font-fraunces), serif", fontSize: 15, fontWeight: 600, color: "var(--text)", marginBottom: 10 },
  cardSub: { fontSize: 12.5, color: "var(--text-2)", marginBottom: 12, marginTop: -6, lineHeight: 1.5 },
  savedTag: { display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 600, color: "var(--green)" },
  brandRow: { display: "flex", alignItems: "center", gap: 12 },
  mark: { width: 44, height: 44, borderRadius: 12, background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-fraunces), serif", fontWeight: 600, fontSize: 16, flexShrink: 0 },
  brandInput: { width: "100%", background: "transparent", border: "1px solid transparent", borderRadius: 7, fontFamily: "var(--font-fraunces), serif", fontSize: 17, fontWeight: 600, color: "var(--text)", padding: "3px 6px", margin: "-3px -6px", outline: "none" },
  taglineInput: { width: "100%", background: "transparent", border: "1px solid transparent", borderRadius: 7, fontSize: 12.5, color: "var(--muted)", padding: "3px 6px", margin: "2px -6px 0", outline: "none" },
  socialRow: { display: "flex", alignItems: "center", gap: 9, background: "var(--inset)", border: "1px solid var(--border)", borderRadius: 9, padding: "9px 11px" },
  socialInput: { flex: 1, background: "transparent", border: "none", fontSize: 13, color: "var(--text)", outline: "none" },
  fieldLabel: { fontSize: 11.5, fontWeight: 600, color: "var(--text-2)", marginBottom: 8 },
  textInput: { background: "var(--inset)", border: "1px solid var(--border)", borderRadius: 9, padding: "9px 11px", fontSize: 13, color: "var(--text)", outline: "none", width: "100%", boxSizing: "border-box" },
  stepper: { display: "inline-flex", alignItems: "center", background: "var(--inset)", border: "1px solid var(--border)", borderRadius: 9, overflow: "hidden" },
  stepBtn: { width: 32, height: 34, border: "none", background: "transparent", color: "var(--text-2)", fontSize: 16, cursor: "pointer" },
  stepVal: { minWidth: 30, textAlign: "center", fontSize: 14, fontWeight: 600, color: "var(--text)" },
  currencyBtn: { background: "var(--inset)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 12px", fontSize: 12.5, fontWeight: 600, color: "var(--text-2)", cursor: "pointer" },
  currencyOn: { background: "var(--accent-tint)", border: "1px solid var(--accent)", color: "var(--accent)" },
  chip: { display: "flex", alignItems: "center", gap: 2, background: "var(--inset)", border: "1px solid var(--border)", borderRadius: 8, padding: "4px 4px 4px 9px" },
  chipInput: { background: "transparent", border: "none", color: "var(--text)", fontSize: 13, fontWeight: 500, outline: "none", minWidth: 30 },
  chipX: { width: 20, height: 20, borderRadius: 5, background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  chipAdd: { width: 30, height: 30, borderRadius: 8, background: "transparent", border: "1px dashed var(--border-strong)", color: "var(--accent)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  linkRow: { display: "flex", alignItems: "center", gap: 9, background: "var(--inset)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px" },
  linkText: { flex: 1, fontSize: 13, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  copyBtn: { display: "flex", alignItems: "center", gap: 5, background: "var(--card)", border: "1px solid var(--border)", color: "var(--text-2)", fontSize: 12.5, fontWeight: 600, borderRadius: 8, padding: "7px 11px", cursor: "pointer" },
  note: { fontSize: 12, color: "var(--muted)", textAlign: "center" },
}
