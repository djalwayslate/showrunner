export type Profile = {
  id: string
  display_name: string | null
  role: "admin" | "core" | "sponsor" | "artist"
}

export type EventRow = {
  id: string
  name: string
  venue: string | null
  start_date: string
  end_date: string
  start_time?: string | null
  attendance?: number | null
  poster_url?: string | null
  description?: string | null
  ticket_url?: string | null
  drive_url?: string | null
  fb_url?: string | null
  stages?: string[] | null
  excluded_days?: string[] | null
}

export type HospSettings = {
  id: string
  event_id: string
  drinks_per_person: number
  food_per_person: number
}

export type HospPerson = {
  id: string
  event_id: string
  name: string
  count: number
  room: "Single" | "Double" | "Room"
  role: "" | "Org" | "Crew" | "Headliner"
  sort_order: number
  days: number[]
}

export type RiderItem = {
  id: string
  category: "hospitality" | "technical" | "other"
  item: string
  qty: string
  fulfilled: boolean
}

export type LineupEntry = {
  id: string
  event_id: string
  name: string
  role: "Headliner" | "Support" | "Crew" | "Org"
  start_time: string | null
  end_time: string | null
  fee: number
  status: "Pending" | "Sent" | "Signed" | "Paid"
  sort_order: number
  stage: string
  day_date: string | null
  kind: "music" | "activity"
  rider: RiderItem[]
}

export type BudgetSubItem = {
  id: string
  label: string
  fee: number
  rider: number
  payment: "cash" | "invoice"
  tax_rate: number
}

export type BudgetItem = {
  id: string
  event_id: string
  type: "revenue" | "cost"
  label: string
  planned: number
  actual: number
  sort_order: number
  breakdown: BudgetSubItem[]
}

export type PlaybookEntry = {
  id: string
  category: "formula" | "rule" | "pattern" | "vendor" | "note"
  title: string
  body: string
  sort_order: number
}

export type Task = {
  id: string
  event_id: string
  title: string
  phase: "prep" | "week" | "day" | "post"
  owner: string
  due_date: string | null
  status: "todo" | "doing" | "done"
  sort_order: number
}

export type InventoryItem = {
  id: string
  event_id: string
  item: string
  qty: string
  source: string
  got: boolean
  notes: string
  sort_order: number
}

export type CrewContact = {
  id: string
  event_id: string
  name: string
  role: string
  phone: string
  email: string
  notes: string
  sort_order: number
}

export type Guest = {
  id: string
  event_id: string
  name: string
  added_by: string
  status: "Pending" | "Accepted" | "Declined"
  ticket_type: string
  plus_ones: number
  attended: boolean
  notes: string
  sort_order: number
}

export type MarketingSpend = {
  id: string
  event_id: string
  channel: string
  amount: number
  reach: number
  conversions: number
  notes: string
  sort_order: number
}

export type Proposal = {
  id: string
  event_id: string
  title: string
  audience: string
  body: string
  created_at: string
}

export type TabKey =
  | "home"
  | "hosp"
  | "lineup"
  | "budget"
  | "guests"
  | "logistics"
  | "planner"
  | "proposal"
  | "playbook"
  | "insights"
  | "marketing"
  | "import"
  | "ask"
