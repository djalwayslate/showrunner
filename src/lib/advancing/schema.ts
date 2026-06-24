// Field schemas for the advancing portal. One source of truth, read by the
// external fill-in form, the dashboard AdvancingTab, and the PDF report — so
// every ABOSS-style category is rendered generically, no bespoke component each.

export type FieldType = "text" | "textarea" | "email" | "tel" | "date" | "time" | "number" | "bool" | "url"

export type FieldDef = { key: string; label: string; type: FieldType; placeholder?: string }

export type CategoryDef = {
  key: string
  title: string
  scope: "event" | "artist"
  help?: string
  fields: FieldDef[]
}

const contactFields: FieldDef[] = [
  { key: "name", label: "Name", type: "text" },
  { key: "company", label: "Company", type: "text" },
  { key: "email", label: "Email", type: "email" },
  { key: "phone", label: "Phone number", type: "tel", placeholder: "+370 …" },
]

const groundFields: FieldDef[] = [
  { key: "pickup_date", label: "Pickup date", type: "date" },
  { key: "pickup_time", label: "Pickup time", type: "time" },
  { key: "arrival_date", label: "Arrival date", type: "date" },
  { key: "arrival_time", label: "Arrival time", type: "time" },
  { key: "driver_name", label: "Driver name", type: "text" },
  { key: "car_type", label: "Car type", type: "text" },
  { key: "driver_phone", label: "Driver phone number", type: "tel" },
  { key: "signage", label: "Pickup signage", type: "text" },
  { key: "notes", label: "Notes", type: "textarea" },
]

// Ordered. `scope: "event"` categories are created once per event; `scope: "artist"`
// categories are created per lineup entry during bulk generation.
export const CATEGORIES: CategoryDef[] = [
  { key: "promoter", title: "Promoter", scope: "event", help: "Include country area code with the phone number. Please have at least 2 contacts available.", fields: contactFields },
  { key: "artist_care", title: "Artist Care", scope: "event", help: "Who looks after the artist on the day.", fields: contactFields },
  { key: "sound_technician", title: "Sound Technician", scope: "event", fields: contactFields },
  { key: "stage_room", title: "Stage / Room Capacity", scope: "event", fields: [
    { key: "capacity", label: "Capacity", type: "number" },
    { key: "stage_name", label: "Stage / room name", type: "text" },
    { key: "notes", label: "Notes", type: "textarea" },
  ] },
  { key: "technical", title: "Technical Information", scope: "event", help: "DJ setup, monitors, anything per the rider.", fields: [
    { key: "info", label: "Technical setup", type: "textarea", placeholder: "e.g. 2x Technics 1210 + Allen & Heath Xone:96" },
  ] },
  { key: "guest_list", title: "Guest List Info / Comments", scope: "event", fields: [
    { key: "info", label: "Guest list & comments", type: "textarea" },
  ] },
  { key: "soundcheck", title: "Soundcheck", scope: "artist", help: "If the artist needs a soundcheck, give the time.", fields: [
    { key: "needed", label: "Soundcheck needed", type: "bool" },
    { key: "time", label: "Soundcheck time", type: "time" },
    { key: "notes", label: "Notes", type: "textarea" },
  ] },
  { key: "timetable", title: "Set Time", scope: "artist", help: "The artist's slot and full running order.", fields: [
    { key: "set_time", label: "Set time", type: "text", placeholder: "e.g. 03:00–05:30" },
    { key: "running_order", label: "Full running order", type: "textarea" },
  ] },
  { key: "ground", title: "Ground: Hotel to Venue Transfer", scope: "artist", help: "Enter a specific pickup time — do not leave as TBA. Driver name + phone are mandatory.", fields: groundFields },
  { key: "hotel", title: "Hotel", scope: "artist", fields: [
    { key: "hotel_name", label: "Hotel name", type: "text" },
    { key: "checkin", label: "Check-in", type: "date" },
    { key: "checkout", label: "Check-out", type: "date" },
    { key: "reservation", label: "Reservation number", type: "text" },
    { key: "nights", label: "Nights", type: "number" },
    { key: "rooms", label: "Rooms", type: "number" },
    { key: "room_type", label: "Room type", type: "text" },
    { key: "phone", label: "Hotel phone", type: "tel" },
    { key: "website", label: "Website", type: "url" },
  ] },
]

export const CATEGORY_MAP: Record<string, CategoryDef> = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]))

export const EVENT_CATEGORIES = CATEGORIES.filter((c) => c.scope === "event")
export const ARTIST_CATEGORIES = CATEGORIES.filter((c) => c.scope === "artist")

export function categoryDef(key: string): CategoryDef | undefined {
  return CATEGORY_MAP[key]
}

// Shared row types (mirror scripts/advancing.sql).
export type AdvanceStatus = "open" | "submitted" | "approved"

export type AdvanceRecipient = {
  id: string
  event_id: string
  lineup_entry_id: string | null
  name: string
  email: string | null
  token: string
  scope: "artist" | "event"
  invited_at: string | null
  last_seen_at: string | null
  created_at: string
}

export type AdvanceRequest = {
  id: string
  event_id: string
  recipient_id: string | null
  lineup_entry_id: string | null
  category: string
  title: string
  data: Record<string, unknown>
  status: AdvanceStatus
  sort_order: number
  updated_at: string
  created_at: string
}
