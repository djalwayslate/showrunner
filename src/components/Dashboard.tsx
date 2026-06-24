"use client"

import { useState, useEffect, useCallback } from "react"
import { Home, Bed, Mic2, Wallet, RefreshCw, Upload, LogOut, CalendarPlus, ListChecks, FileText, BookOpen, Pencil, Ticket, FolderOpen, ExternalLink, BarChart3, Megaphone, Users, Settings, DoorOpen, Boxes, Send } from "lucide-react"
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

const NAV_GROUPS: { label?: string; items: { key: TabKey; icon: React.ElementType; label: string }[] }[] = [
  { items: [{ key: "home", icon: Home, label: "Home" }] },
  {
    label: "People",
    items: [
      { key: "lineup", icon: Mic2, label: "Lineup" },
      { key: "hosp", icon: Bed, label: "Hospitality" },
      { key: "guests", icon: DoorOpen, label: "Guests" },
    ],
  },
  {
    label: "Finance",
    items: [
      { key: "budget", icon: Wallet, label: "Budget" },
      { key: "marketing", icon: Megaphone, label: "Marketing" },
    ],
  },
  {
    label: "Operations",
    items: [
      { key: "logistics", icon: Boxes, label: "Logistics" },
      { key: "advance", icon: Send, label: "Advancing" },
      { key: "planner", icon: ListChecks, label: "Planner" },
    ],
  },
  {
    label: "Growth",
    items: [
      { key: "proposal", icon: FileText, label: "Pitch" },
      { key: "insights", icon: BarChart3, label: "Insights" },
      { key: "import", icon: Upload, label: "Import" },
    ],
  },
]

const HQ_TABS: { key: "overview" | "team" | "playbook" | "settings"; icon: React.ElementType; label: string }[] = [
  { key: "overview", icon: Home, label: "Overview" },
  { key: "team", icon: Users, label: "Team" },
  { key: "playbook", icon: BookOpen, label: "Playbook" },
  { key: "settings", icon: Settings, label: "Settings" },
]

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

  useEffect(() => {
    if (!eventId) return
    const supabase = createClient()
    const tables = ["hosp_people", "lineup_entries", "budget_items", "tasks", "guests", "inventory_items", "crew_contacts", "marketing_spend"]
    const ch = supabase.channel(`lk-${eventId}`)
    tables.forEach((table) => {
      ch.on("postgres_changes" as Parameters<typeof ch.on>[0], { event: "*", schema: "public", table, filter: `event_id=eq.${eventId}` }, () => refresh())
    })
    ch.subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [eventId, refresh])

  let countdown: { label: string; tone: "soon" | "live" | "done" } | null = null
  if (selectedEvent) {
    const start = new Date(selectedEvent.start_date + "T00:00:00")
    const end = new Date(selectedEvent.end_date + "T23:59:59")
    const daysOut = Math.ceil((start.getTime() - now.getTime()) / 86400000)
    if (now > end) countdown = { label: "Wrapped", tone: "done" }
    else if (now >= start) countdown = { label: "Live now", tone: "live" }
    else countdown = { label: `${daysOut} ${daysOut === 1 ? "day" : "days"} out`, tone: "soon" }
  }

  const initial = userEmail.charAt(0).toUpperCase()

  return (
    <div style={s.page}>
      {/* Sidebar */}
      <aside style={s.sidebar}>
        <div style={s.sideTop}>
          <button style={s.brandBtn} onClick={() => setScope(scope === "hq" ? "events" : "hq")} type="button">
            <div style={s.mark}>{brandName.slice(0, 2).toUpperCase()}</div>
            <div style={{ textAlign: "left" }}>
              <div style={s.brand}>{brandName}</div>
              <div style={s.brandSub}>{scope === "hq" ? "Brand HQ" : "Operations"}</div>
            </div>
          </button>

          {scope !== "hq" && (
            <div style={s.sideEvent}>
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
          )}
        </div>

        <nav style={s.sideNav}>
          {scope === "hq"
            ? HQ_TABS.filter((t) => t.key !== "team" || role === "admin").map(({ key, icon: Icon, label }) => (
                <button
                  key={key}
                  style={{ ...s.navItem, ...(hqTab === key ? s.navItemOn : {}) }}
                  onClick={() => setHqTab(key)}
                  type="button"
                >
                  <Icon size={16} strokeWidth={2} />
                  <span>{label}</span>
                </button>
              ))
            : NAV_GROUPS.map((group) => (
                <div key={group.label ?? "_"} style={s.navGroup}>
                  {group.label && <div style={s.navGroupLabel}>{group.label}</div>}
                  {group.items.map(({ key, icon: Icon, label }) => (
                    <button
                      key={key}
                      style={{ ...s.navItem, ...(tab === key ? s.navItemOn : {}) }}
                      onClick={() => setTab(key)}
                      type="button"
                    >
                      <Icon size={16} strokeWidth={2} />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              ))}
        </nav>

        <div style={s.sideBottom}>
          <div style={s.sideUser}>
            <div style={s.avatar}>{initial}</div>
            <div style={{ minWidth: 0 }}>
              <div style={s.userEmail}>{userEmail}</div>
              <span style={s.roleBadge}>{role}</span>
            </div>
          </div>
          <div style={s.sideActions}>
            <button style={s.iconBtn} onClick={refresh} title="Refresh" type="button">
              <RefreshCw size={14} strokeWidth={2} style={refreshing ? { animation: "lk-spin 0.6s linear infinite" } : {}} />
            </button>
            <button style={s.iconBtn} onClick={signOut} title="Sign out" type="button">
              <LogOut size={14} strokeWidth={2} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div style={s.main}>
        {scope === "hq" ? (
          <main style={s.content}>
            {hqTab === "overview" && <GlobalOverview onOpenEvent={(id) => { selectEvent(id); setScope("events"); setTab("home") }} />}
            {hqTab === "team" && role === "admin" && <TeamTab currentUserId={profile?.id ?? ""} isAdmin={true} />}
            {hqTab === "playbook" && <PlaybookTab eventId="" refreshKey={refreshKey} />}
            {hqTab === "settings" && <SettingsHQ isAdmin={role === "admin"} />}
          </main>
        ) : !selectedEvent ? (
          <div style={s.empty}>
            <div style={s.emptyIcon}><CalendarPlus size={24} strokeWidth={1.6} /></div>
            <div style={s.emptyTitle}>No event selected</div>
            <div style={s.emptySub}>
              {eventList.length === 0
                ? canManageEvents
                  ? "Create your first event from the sidebar to start planning."
                  : "No events yet. Ask an admin to create one."
                : "Choose an event from the sidebar to start planning."}
            </div>
          </div>
        ) : (
          <>
            <div style={s.eventHeader}>
              <div style={s.eventHeaderMain}>
                {selectedEvent.poster_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedEvent.poster_url} alt="" style={s.posterThumb} onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
                )}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={s.eventName}>{selectedEvent.name}</div>
                  {selectedEvent.venue && <div style={s.eventVenue}>{selectedEvent.venue}</div>}
                  <div style={s.linkRow}>
                    {selectedEvent.ticket_url && <LinkChip href={selectedEvent.ticket_url} icon={Ticket}>Tickets</LinkChip>}
                    {selectedEvent.drive_url && <LinkChip href={selectedEvent.drive_url} icon={FolderOpen}>Drive</LinkChip>}
                    {selectedEvent.fb_url && <LinkChip href={selectedEvent.fb_url} icon={ExternalLink}>Facebook</LinkChip>}
                  </div>
                </div>
              </div>
              {canManageEvents && (
                <button style={s.editEventBtn} onClick={() => setEditing(selectedEvent)} type="button">
                  <Pencil size={13} strokeWidth={2} /> Edit
                </button>
              )}
            </div>

            <main key={`${tab}-${eventId}`} style={s.content}>
              {tab === "home" && <HomeTab event={selectedEvent} eventId={eventId} refreshKey={refreshKey} onGoTo={setTab} />}
              {tab === "hosp" && <HospTab event={selectedEvent} eventId={eventId} refreshKey={refreshKey} onGoTo={setTab} />}
              {tab === "lineup" && <LineupTab eventId={eventId} refreshKey={refreshKey} />}
              {tab === "budget" && <BudgetTab eventId={eventId} refreshKey={refreshKey} canEdit={canEditBudget} />}
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
    display: "flex",
    minHeight: "100vh",
    background: "var(--bg)",
  },
  sidebar: {
    width: 220,
    flexShrink: 0,
    height: "100vh",
    position: "sticky",
    top: 0,
    background: "var(--bg-2)",
    borderRight: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    padding: "18px 10px",
    overflowY: "auto",
  },
  sideTop: {
    marginBottom: 4,
  },
  brandBtn: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "transparent",
    border: "none",
    padding: "6px 8px",
    borderRadius: 10,
    cursor: "pointer",
    width: "100%",
    marginBottom: 14,
    transition: "background 0.15s",
    textAlign: "left",
  },
  sideEvent: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    paddingBottom: 14,
    borderBottom: "1px solid var(--border)",
    marginBottom: 6,
  },
  mark: {
    width: 34,
    height: 34,
    borderRadius: 9,
    background: "var(--accent)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "var(--font-fraunces), serif",
    fontWeight: 600,
    fontSize: 13,
    flexShrink: 0,
  },
  brand: {
    fontFamily: "var(--font-fraunces), serif",
    fontSize: 14,
    fontWeight: 600,
    color: "var(--text)",
    lineHeight: 1.2,
  },
  brandSub: {
    fontSize: 11,
    color: "var(--muted)",
    letterSpacing: "0.02em",
  },
  sideNav: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 1,
    overflowY: "auto",
  },
  navGroup: {
    marginBottom: 4,
  },
  navGroupLabel: {
    fontSize: 10.5,
    fontWeight: 600,
    color: "var(--muted)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    padding: "8px 10px 3px",
  },
  navItem: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    width: "100%",
    padding: "7px 10px",
    borderRadius: 9,
    border: "none",
    background: "transparent",
    color: "var(--text-2)",
    fontSize: 13.5,
    fontWeight: 500,
    cursor: "pointer",
    textAlign: "left",
    transition: "background 0.12s, color 0.12s",
  },
  navItemOn: {
    background: "var(--card)",
    color: "var(--text)",
    fontWeight: 600,
    boxShadow: "var(--shadow-sm)",
  },
  sideBottom: {
    borderTop: "1px solid var(--border)",
    paddingTop: 14,
    marginTop: 8,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  sideUser: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    padding: "0 4px",
    minWidth: 0,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: "50%",
    background: "var(--text)",
    color: "var(--bg)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 600,
    flexShrink: 0,
  },
  userEmail: {
    fontSize: 11.5,
    color: "var(--text-2)",
    fontWeight: 500,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: 130,
  },
  roleBadge: {
    fontSize: 10,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "var(--accent)",
    background: "var(--accent-tint)",
    padding: "2px 6px",
    borderRadius: 5,
  },
  sideActions: {
    display: "flex",
    gap: 6,
    padding: "0 4px",
  },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    background: "transparent",
    border: "1px solid var(--border)",
    color: "var(--text-2)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "background 0.15s",
  },
  main: {
    flex: 1,
    minWidth: 0,
    padding: "32px 40px 64px",
  },
  eventHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 28,
    paddingBottom: 20,
    borderBottom: "1px solid var(--border)",
  },
  eventHeaderMain: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    minWidth: 0,
    flex: 1,
  },
  posterThumb: {
    width: 52,
    height: 52,
    borderRadius: 11,
    objectFit: "cover",
    border: "1px solid var(--border)",
    flexShrink: 0,
  },
  eventName: {
    fontFamily: "var(--font-fraunces), serif",
    fontSize: 22,
    fontWeight: 600,
    color: "var(--text)",
    lineHeight: 1.2,
    marginBottom: 2,
  },
  eventVenue: {
    fontSize: 13,
    color: "var(--text-2)",
    marginBottom: 6,
    lineHeight: 1.4,
  },
  linkRow: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
  },
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
    background: "var(--card)",
    border: "1px solid var(--border)",
    color: "var(--text-2)",
    fontSize: 12.5,
    fontWeight: 600,
    borderRadius: 9,
    padding: "8px 13px",
    cursor: "pointer",
    flexShrink: 0,
    boxShadow: "var(--shadow-sm)",
  },
  countdown: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    fontWeight: 600,
    padding: "5px 10px",
    borderRadius: 999,
    border: "1px solid transparent",
    whiteSpace: "nowrap",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    display: "inline-block",
    flexShrink: 0,
  },
  content: {
    animation: "lk-fade-up 0.22s ease both",
  },
  empty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    padding: "80px 24px",
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
    fontSize: 20,
    fontWeight: 600,
    color: "var(--text)",
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13.5,
    color: "var(--text-2)",
    maxWidth: 340,
    lineHeight: 1.55,
  },
}
