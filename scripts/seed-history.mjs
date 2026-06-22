import { createClient } from "@supabase/supabase-js"
const a = createClient("https://csjltossxfzyynqhspzb.supabase.co", process.env.SR, { auth: { persistSession: false } })

const events = [
  { name: "Kaunas · Feb 2026", venue: null, start: "2026-02-14", end: "2026-02-14", attendees: 340, revenue: null, costs: null },
  { name: "Vilnius · May 2026", venue: null, start: "2026-05-08", end: "2026-05-08", attendees: 508, revenue: 5500, costs: 6000 },
  { name: "Kaunas · May 2026", venue: null, start: "2026-05-09", end: "2026-05-09", attendees: 440, revenue: 3850, costs: 1800 },
]

for (const e of events) {
  // skip if an event with this name already exists
  const { data: existing } = await a.from("events").select("id").eq("name", e.name).maybeSingle()
  if (existing) { console.log("• already exists:", e.name); continue }

  const { data: ev, error } = await a.from("events").insert({
    name: e.name, venue: e.venue, start_date: e.start, end_date: e.end,
    description: `~${e.attendees} attendees`,
  }).select().single()
  if (error) { console.log("✗ failed:", e.name, error.message); continue }

  await a.from("hosp_settings").insert({ event_id: ev.id, drinks_per_person: 4, food_per_person: 1 })

  const rows = []
  if (e.revenue != null) rows.push({ event_id: ev.id, type: "revenue", label: "Revenue (total)", planned: e.revenue, actual: e.revenue, sort_order: 1 })
  else rows.push({ event_id: ev.id, type: "revenue", label: "Revenue (total)", planned: 0, actual: 0, sort_order: 1 })
  if (e.costs != null) rows.push({ event_id: ev.id, type: "cost", label: "Costs (total)", planned: e.costs, actual: e.costs, sort_order: 1 })
  else rows.push({ event_id: ev.id, type: "cost", label: "Costs (total)", planned: 0, actual: 0, sort_order: 1 })
  await a.from("budget_items").insert(rows)

  const net = e.revenue != null ? e.revenue - e.costs : null
  console.log(`✓ ${e.name}  |  ${e.attendees} ppl  |  ${e.revenue != null ? `rev €${e.revenue} · cost €${e.costs} · net €${net}` : "no figures yet"}`)
}
console.log("\nDone — these now live under History (their dates are in the past).")
