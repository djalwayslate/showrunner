import { createClient } from "@supabase/supabase-js"

const URL = "https://csjltossxfzyynqhspzb.supabase.co"
const SERVICE_ROLE = process.env.SR
const admin = createClient(URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const people = [
  { name: "christ_png", count: 1, days: [15, 16, 17, 18, 19], room: "Single", role: "Org" },
  { name: "jaax", count: 1, days: [15, 16, 17, 18, 19], room: "Single", role: "Org" },
  { name: "dj alwayslate", count: 1, days: [16], room: "Single", role: "Org" },
  { name: "Proflame", count: 1, days: [16], room: "Room", role: "Headliner" },
  { name: "Soft Corps", count: 1, days: [16, 17], room: "Double", role: "" },
  { name: "Mikutelis", count: 1, days: [16, 17, 18, 19], room: "Single", role: "Crew" },
  { name: "Tres Sticky", count: 1, days: [16, 17, 18, 19], room: "Single", role: "" },
  { name: "Candy shop", count: 1, days: [16, 17, 18, 19], room: "Double", role: "" },
  { name: "cport system", count: 1, days: [17, 18], room: "Single", role: "" },
  { name: "Nikita Shurmin", count: 1, days: [17, 18, 19], room: "Single", role: "" },
  { name: "Free finga", count: 1, days: [17], room: "Room", role: "Headliner" },
  { name: "Soul food (Patrikas ir Kostas)", count: 2, days: [17], room: "Single", role: "" },
  { name: "Karlonas", count: 1, days: [17], room: "Single", role: "Crew" },
  { name: "Kysas", count: 1, days: [17], room: "Single", role: "Crew" },
  { name: "Guzas", count: 2, days: [17], room: "Double", role: "" },
  { name: "Art Cue", count: 1, days: [18], room: "Single", role: "" },
  { name: "Vanilla", count: 1, days: [18], room: "Single", role: "" },
  { name: "Mario Moretti", count: 2, days: [18], room: "Double", role: "" },
  { name: "Ani", count: 1, days: [18], room: "Single", role: "" },
  { name: "Jpsc", count: 1, days: [18, 19], room: "Single", role: "" },
  { name: "Vaiperis", count: 1, days: [18, 19], room: "Single", role: "" },
  { name: "Glommy", count: 1, days: [19], room: "Single", role: "" },
  { name: "Aurėja", count: 1, days: [19], room: "Single", role: "" },
  { name: "Edvis", count: 1, days: [19], room: "Single", role: "Org" },
]

const { data: ev } = await admin.from("events").select("id").eq("name", "Raze Carnaval 2026").single()
if (!ev) { console.error("event not found"); process.exit(1) }

// Skip if already seeded
const { count } = await admin.from("hosp_people").select("*", { count: "exact", head: true }).eq("event_id", ev.id)
if (count && count > 0) { console.log("Roster already has", count, "people — skipping seed."); process.exit(0) }

let order = 0
for (const p of people) {
  const { data: row, error } = await admin
    .from("hosp_people")
    .insert({ event_id: ev.id, name: p.name, count: p.count, room: p.room, role: p.role, sort_order: order++ })
    .select()
    .single()
  if (error) { console.error("insert error for", p.name, error.message); continue }
  if (p.days.length) {
    await admin.from("hosp_person_days").insert(p.days.map((d) => ({ person_id: row.id, day: d })))
  }
}
console.log("Seeded", people.length, "people into Raze Carnaval 2026.")
