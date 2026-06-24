"use client"

import { useState, useEffect, useCallback } from "react"
import { Home, Bed, Mic2, Wallet, RefreshCw, Upload, LogOut, CalendarPlus, ListChecks, FileText, BookOpen, Pencil, Ticket, FolderOpen, ExternalLink, BarChart3, Megaphone, Users, Settings, ChevronLeft, DoorOpen, Boxes, Send } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { Profile, TabKey, EventRow } from "@/lib/types"
import EventSwitcher from "./EventSwitcher"
import EventEditor from "./EventEditor"
import EventBuilder from "./EventBuilder"
import BulkImportModal from "./BulkImportModal"
import HomeTab from "./HomeTab"
import HospTab from "./HospTab"
import LineupTab from "./LineupTab"
import BudgetTab from "./BudgetTab"
import PlannerTab from "./PlannerTab"
import ProposalTab from "./ProposalTab"
import PlaybookTab from "./PlaybookTab"
import InsightsTab from "./InsightsTab"
import MarketingTab from "./MarketingTab"
import GuestsTab from "./GuestsTab"
import LogisticsTab from "./LogisticsTab"
import AdvancingTab from "./AdvancingTab"
import TeamTab from "./TeamTab"
import SettingsHQ from "./SettingsHQ"
import GlobalOverview from "./GlobalOverview"
import ImportTab from "./ImportTab"

type Props = {
  profile: Profile | null
  events: EventRow[]
  userEmail: string
  brandName?: string
}

export default function Dashboard({ profile, events, userEmail, brandName = "Latino Kings" }: Props) {
  const [tab, setTab] = useState<TabKey>("home")
  const [now, setNow] = useState(new Date())
  const [refreshKey, setRefreshKey] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [eventList, setEventList] = useState<EventRow[]>(events)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [editing, setEditing] = useState<EventRow | "new" | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [buildOpen, setBuildOpen] = useState(false)
  const [scope, setScope] = useState<"events" | "hq">("events")
  const [hqTab, setHqTab] = useState<"overview" | "team" | "playbook" | "settings">("overview")

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("lk-event") : null
    if (saved && eventList.some((e) => e.id === saved)) setSelectedEventId(saved)
    else if (eventList.length > 0) setSelectedEventId(eventList[0].id)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function selectEvent(id: string) {
    setSelectedEventId(id)
    localStorage.setItem("lk-event", id)
    setRefreshKey((k) => k + 1)
  }

  function onEventSaved(e: EventRow, isNew: boolean) {
    setEventList((prev) => (isNew ? [...prev, e] : prev.map((x) => (x.id === e.id ? e : x))))
    selectEvent(e.id)
    setEditing(null)
  }

  function onEventDeleted(id: string) {
    setEventList((prev) => {
      const next = prev.filter((x) => x.id !== id)
      if (selectedEventId === id) {
        const fallback = next[0]?.id ?? null
        setSelectedEventId(fallback)
        if (fallback) localStorage.setItem("lk-event", fallback)
        else localStorage.removeItem("lk-event")
      }
      return next
    })
    setEditing(null)
  }

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  const refresh = useCallback(() => {
    setRefreshing(true)
    setRefreshKey((k) => k + 1)
    setTimeout(() => setRefreshing(false), 500)
  }, [])

  useEffect(() => {
    const onFocus = () => refresh()
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [refresh])

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = "/auth"
  }

  const role = profile?.role ?? "core"
  const canEditBudget = role === "admin"
  const canManageEvents = role === "admin" || role === "core"
  const selectedEvent = eventList.find((e) => e.id === selectedEventId) ?? null
  const eventId = selectedEvent?.id ?? ""

  let countdown: { label: string; tone: "soon" | "live" | "done" } | null = null
  if (selectedEvent) {
    const start = new Date(selectedEvent.start_date + "T00:00:00")
    const end = new Date(selectedEvent.end_date + "T23:59:59")
    const daysOut = Math.ceil((start.getTime() - now.getTime()) / 86400000)
    if (now > end) countdown = { label: "Wrapped", tone: "done" }
    else if (now >= start) countdown = { label: "Live now", tone: "live" }
    else countdown = { label: `${daysOut} ${daysOut === 1 ? "day" : "days"} out`, tone: "soon" }
  }

  const tabs: { key: TabKey; icon: React.ElementType; label: string }[] = [
    { key: "home", icon: Home, label: "Home" },
    { key: "lineup", icon: Mic2, label: "Lineup" },
    { key: "budget", icon: Wallet, label: "Budget" },
    { key: "hosp", icon: Bed, label: "Hosp" },
    { key: "guests", icon: DoorOpen, label: "Guests" },
    { key: "logistics", icon: Boxes, label: "Logistics" },
    { key: "advance", icon: Send, label: "Advancing" },
    { key: "planner", icon: ListChecks, label: "Planner" },
    { key: "proposal", icon: FileText, label: "Pitch" },
    { key: "insights", icon: BarChart3, label: "Insights" },
    { key: "marketing", icon: Megaphone, label: "Marketing" },
    { key: "import", icon: Upload, label: "Import" },
  ]

  const initial = userEmail.charAt(0).toUpperCase()

  return (
    <div style={s.page}>
      <div style={s.shell}>
        {/* Top bar */}
        <header style={s.topbar}>
          <button style={s.brandWrap} onClick={() => setScope("hq")} title="Brand HQ" type="button">
            <div style={s.mark}>{brandName.slice(0, 2).toUpperCase()}</div>
            <div style={{ textAlign: "left" }}>
              <div style={s.brand}>{brandName}</div>
              <div style={s.brandSub}>{scope === "hq" ? "Brand HQ" : "Operations"}</div>
            </div>
          </button>
          <div style={s.topActions}>
            <button
              style={s.iconBtn}
              onClick={refresh}
              title="Refresh data"
            >
              <RefreshCw
                size={15}
                strokeWidth={2}
                style={refreshing ? { animation: "lk-spin 0.6s linear infinite" } : {}}
              />
            </button>
            <button style={s.iconBtn} onClick={signOut} title={`Sign out (${userEmail})`}>
              <LogOut size={15} strokeWidth={2} />
            </button>
            <div style={s.avatar} title={`${userEmail} · ${role}`}>{initial}</div>
          </div>
        </header>

        {scope === "hq" ? (
          <HqView
            role={role}
            userId={profile?.id ?? ""}
            hqTab={hqTab}
            setHqTab={setHqTab}
            onBack={() => setScope("events")}
            onOpenEvent={(id) => { selectEvent(id); setScope("events"); setTab("home") }}
            refreshKey={refreshKey}
          />
        ) : (
        <>
        {/* Event row */}
        <div style={s.eventRow}>
          <EventSwitcher
            events={eventList}
            selectedId={selectedEventId}
            onSelect={selectEvent}
            onNew={() => setEditing("new")}
            onBuild={() => setBuildOpen(true)}
            onEdit={(e) => setEditing(e)}
            onBulkImport={() => setBulkOpen(true)}
            canManage={canManageEvents}
          />
          {selectedEvent && countdown && (
            <div style={{ ...s.countdown, ...countdownTone(countdown.tone) }}>
              <span style={{ ...s.dot, background: countdownDot(countdown.tone) }} />
              {countdown.label}
            </div>
          )}
        </div>

        {/* Event info bar */}
        {selectedEvent && (
          <div style={s.infoBar}>
            {selectedEvent.poster_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selectedEvent.poster_url} alt="" style={s.posterThumb} onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              {selectedEvent.venue && <div style={s.infoVenue}>{selectedEvent.venue}</div>}
              {selectedEvent.description && <div style={s.infoDesc}>{selectedEvent.description}</div>}
              <div style={s.linkRow}>
                {selectedEvent.ticket_url && <LinkChip href={selectedEvent.ticket_url} icon={Ticket}>Tickets</LinkChip>}
                {selectedEvent.drive_url && <LinkChip href={selectedEvent.drive_url} icon={FolderOpen}>Drive</LinkChip>}
                {selectedEvent.fb_url && <LinkChip href={selectedEvent.fb_url} icon={ExternalLink}>Facebook</LinkChip>}
              </div>
            </div>
            {canManageEvents && (
              <button style={s.editEventBtn} onClick={() => setEditing(selectedEvent)} type="button">
                <Pencil size={13} strokeWidth={2} /> Edit
              </button>
            )}
          </div>
        )}

        {!selectedEvent ? (
          <div style={s.empty}>
            <div style={s.emptyIcon}>
              <CalendarPlus size={24} strokeWidth={1.6} />
            </div>
            <div style={s.emptyTitle}>No event selected</div>
            <div style={s.emptySub}>
              {eventList.length === 0
                ? canManageEvents
                  ? "Create your first event from the selector above to start planning."
                  : "No events exist yet. Ask an admin to create one."
                : "Choose an event above to start planning."}
            </div>
          </div>
        ) : (
          <>
            {/* Segmented tabs */}
            <nav style={s.tabs}>
              {tabs.map(({ key, icon: Icon, label }) => {
                const active = tab === key
                return (
                  <button
                    key={key}
                    style={{ ...s.tab, ...(active ? s.tabOn : {}) }}
                    onClick={() => setTab(key)}
                    type="button"
                  >
                    <Icon size={15} strokeWidth={2} style={{ opacity: active ? 1 : 0.7 }} />
                    <span>{label}</span>
                  </button>
                )
              })}
            </nav>

            <main key={`${tab}-${eventId}`} style={s.content}>
              {tab === "home" && <HomeTab event={selectedEvent} eventId={eventId} refreshKey={refreshKey} onGoTo={setTab} />}
              {tab === "hosp" && <HospTab eventId={eventId} refreshKey={refreshKey} onGoTo={setTab} />}
              {tab === "lineup" && <LineupTab eventId={eventId} refreshKey={refreshKey} />}
              {tab === "budget" && (
                <BudgetTab eventId={eventId} refreshKey={refreshKey} canEdit={canEditBudget} />
              )}
              {tab === "guests" && <GuestsTab eventId={eventId} refreshKey={refreshKey} />}
              {tab === "logistics" && <LogisticsTab eventId={eventId} refreshKey={refreshKey} />}
              {tab === "advance" && <AdvancingTab eventId={eventId} refreshKey={refreshKey} />}
              {tab === "planner" && <PlannerTab eventId={eventId} refreshKey={refreshKey} />}
              {tab === "proposal" && <ProposalTab eventId={eventId} />}
              {tab === "insights" && <InsightsTab />}
              {tab === "marketing" && <MarketingTab eventId={eventId} refreshKey={refreshKey} />}
              {tab === "import" && <ImportTab eventId={eventId} activeTab={tab} onImported={refresh} />}
            </main>
          </>
        )}
        </>
        )}

        <footer style={s.footer}>
          <span>
            Signed in as <strong style={{ color: "var(--text-2)", fontWeight: 600 }}>{userEmail}</strong>
          </span>
          <span style={s.roleBadge}>{role}</span>
          {role !== "admin" && <span style={{ color: "var(--muted)" }}>Budget is read-only</span>}
        </footer>
      </div>

      {editing && (
        <EventEditor
          event={editing === "new" ? null : editing}
          canDelete={role === "admin"}
          onSaved={onEventSaved}
          onDeleted={onEventDeleted}
          onClose={() => setEditing(null)}
        />
      )}

      {bulkOpen && (
        <BulkImportModal
          onClose={() => setBulkOpen(false)}
          onCreated={(e) => setEventList((prev) => [...prev, e])}
        />
      )}

      {buildOpen && (
        <EventBuilder
          onCreated={(e) => { onEventSaved(e, true); setBuildOpen(false) }}
          onClose={() => setBuildOpen(false)}
        />
      )}
    </div>
  )
}

function HqView({
  role, userId, hqTab, setHqTab, onBack, onOpenEvent, refreshKey,
}: {
  role: string
  userId: string
  hqTab: "overview" | "team" | "playbook" | "settings"
  setHqTab: (t: "overview" | "team" | "playbook" | "settings") => void
  onBack: () => void
  onOpenEvent: (id: string) => void
  refreshKey: number
}) {
  const isAdmin = role === "admin"
  const hqTabs: { key: "overview" | "team" | "playbook" | "settings"; icon: React.ElementType; label: string }[] = [
    { key: "overview", icon: Home, label: "Overview" },
    ...(isAdmin ? [{ key: "team" as const, icon: Users, label: "Team" }] : []),
    { key: "playbook" as const, icon: BookOpen, label: "Playbook" },
    { key: "settings" as const, icon: Settings, label: "Settings" },
  ]
  const active = !isAdmin && hqTab === "team" ? "overview" : hqTab

  return (
    <>
      <div style={s.hqHead}>
        <button style={s.backBtn} onClick={onBack} type="button"><ChevronLeft size={16} strokeWidth={2.2} /> Events</button>
        <span style={s.hqTitle}>Brand HQ</span>
      </div>
      <nav style={s.tabs}>
        {hqTabs.map(({ key, icon: Icon, label }) => (
          <button key={key} style={{ ...s.tab, ...(active === key ? s.tabOn : {}) }} onClick={() => setHqTab(key)} type="button">
            <Icon size={15} strokeWidth={2} style={{ opacity: active === key ? 1 : 0.7 }} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <main key={active} style={s.content}>
        {active === "overview" && <GlobalOverview onOpenEvent={onOpenEvent} />}
        {active === "team" && isAdmin && <TeamTab currentUserId={userId} isAdmin={isAdmin} />}
        {active === "playbook" && <PlaybookTab eventId="" refreshKey={refreshKey} />}
        {active === "settings" && <SettingsHQ isAdmin={isAdmin} />}
      </main>
    </>
  )
}

function LinkChip({ href, icon: Icon, children }: { href: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={s.linkChip}>
      <Icon size={12} strokeWidth={2} />
      {children}
    </a>
  )
}

function countdownTone(tone: "soon" | "live" | "done"): React.CSSProperties {
  if (tone === "live") return { background: "var(--green-tint)", color: "var(--green)", borderColor: "transparent" }
  if (tone === "done") return { background: "var(--bg-2)", color: "var(--muted)", borderColor: "transparent" }
  return { background: "var(--accent-tint)", color: "var(--accent)", borderColor: "transparent" }
}
function countdownDot(tone: "soon" | "live" | "done"): string {
  if (tone === "live") return "var(--green)"
  if (tone === "done") return "var(--muted)"
  return "var(--accent)"
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "var(--bg)",
  },
  shell: {
    maxWidth: 880,
    margin: "0 auto",
    padding: "22px 22px 56px",
  },
  topbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 22,
  },
  brandWrap: { display: "flex", alignItems: "center", gap: 11, background: "transparent", border: "none", padding: 0, cursor: "pointer" },
  hqHead: { display: "flex", alignItems: "center", gap: 10, marginBottom: 18 },
  backBtn: { display: "flex", alignItems: "center", gap: 4, background: "var(--card)", border: "1px solid var(--border)", color: "var(--text-2)", fontSize: 13, fontWeight: 600, borderRadius: 9, padding: "7px 12px 7px 8px", cursor: "pointer", boxShadow: "var(--shadow-sm)" },
  hqTitle: { fontFamily: "var(--font-fraunces), serif", fontSize: 20, fontWeight: 600, color: "var(--text)" },
  mark: {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: "var(--accent)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "var(--font-fraunces), serif",
    fontWeight: 600,
    fontSize: 15,
  },
  brand: {
    fontFamily: "var(--font-fraunces), serif",
    fontSize: 16.5,
    fontWeight: 600,
    color: "var(--text)",
    lineHeight: 1.1,
  },
  brandSub: { fontSize: 11.5, color: "var(--muted)", letterSpacing: "0.02em" },
  topActions: { display: "flex", alignItems: "center", gap: 8 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    background: "var(--card)",
    border: "1px solid var(--border)",
    color: "var(--text-2)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    boxShadow: "var(--shadow-sm)",
    transition: "background 0.15s",
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: "50%",
    background: "var(--text)",
    color: "var(--bg)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    fontWeight: 600,
  },
  eventRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  infoBar: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: "10px 12px",
    marginBottom: 18,
    boxShadow: "var(--shadow-sm)",
  },
  posterThumb: {
    width: 48,
    height: 48,
    borderRadius: 9,
    objectFit: "cover",
    border: "1px solid var(--border)",
    flexShrink: 0,
  },
  infoVenue: { fontSize: 12.5, fontWeight: 600, color: "var(--text)" },
  infoDesc: {
    fontSize: 12,
    color: "var(--text-2)",
    lineHeight: 1.45,
    marginTop: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
  },
  linkRow: { display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 },
  linkChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    fontSize: 11.5,
    fontWeight: 600,
    color: "var(--accent)",
    background: "var(--accent-tint)",
    borderRadius: 7,
    padding: "4px 9px",
    textDecoration: "none",
  },
  editEventBtn: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    background: "var(--inset)",
    border: "1px solid var(--border)",
    color: "var(--text-2)",
    fontSize: 12.5,
    fontWeight: 600,
    borderRadius: 8,
    padding: "8px 12px",
    cursor: "pointer",
    flexShrink: 0,
    alignSelf: "flex-start",
  },
  countdown: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    fontSize: 12.5,
    fontWeight: 600,
    padding: "7px 12px",
    borderRadius: 999,
    border: "1px solid transparent",
    whiteSpace: "nowrap",
  },
  dot: { width: 6, height: 6, borderRadius: "50%", display: "inline-block" },
  tabs: {
    display: "flex",
    gap: 3,
    padding: 4,
    background: "var(--bg-2)",
    borderRadius: 12,
    marginBottom: 22,
    overflowX: "auto",
  },
  tab: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    flex: 1,
    minWidth: "fit-content",
    background: "transparent",
    border: "none",
    borderRadius: 9,
    padding: "8px 12px",
    fontSize: 13,
    fontWeight: 500,
    color: "var(--text-2)",
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "background 0.18s, color 0.18s, box-shadow 0.18s",
  },
  tabOn: {
    background: "var(--card)",
    color: "var(--text)",
    fontWeight: 600,
    boxShadow: "var(--shadow-sm)",
  },
  content: {
    animation: "lk-fade-up 0.28s ease both",
  },
  empty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    padding: "64px 24px",
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    boxShadow: "var(--shadow-sm)",
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    background: "var(--accent-tint)",
    color: "var(--accent)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    fontFamily: "var(--font-fraunces), serif",
    fontSize: 18,
    fontWeight: 600,
    color: "var(--text)",
    marginBottom: 6,
  },
  emptySub: { fontSize: 13.5, color: "var(--text-2)", maxWidth: 340, lineHeight: 1.55 },
  footer: {
    marginTop: 32,
    paddingTop: 16,
    borderTop: "1px solid var(--border)",
    fontSize: 12,
    color: "var(--muted)",
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  roleBadge: {
    fontSize: 10.5,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "var(--accent)",
    background: "var(--accent-tint)",
    padding: "2px 8px",
    borderRadius: 6,
  },
}
