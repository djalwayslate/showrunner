import { createClient } from "@supabase/supabase-js"
const URL = "https://csjltossxfzyynqhspzb.supabase.co"
const admin = createClient(URL, process.env.SR, { auth: { persistSession: false } })

async function check(table, cols = "*") {
  const { count, error } = await admin.from(table).select(cols, { count: "exact", head: true })
  if (error) console.log(`❌ ${table}: ${error.message}`)
  else console.log(`✅ ${table}: ${count} rows`)
}

console.log("=== TABLES ===")
for (const t of ["events", "profiles", "hosp_people", "lineup_entries", "budget_items", "playbook_entries", "tasks", "proposals"]) {
  await check(t)
}
console.log("=== NEW COLUMNS ===")
const probes = [
  ["events", "poster_url"], ["events", "description"], ["events", "start_time"], ["events", "stages"],
  ["events", "ticket_url"], ["events", "drive_url"], ["events", "fb_url"],
  ["budget_items", "breakdown"], ["lineup_entries", "stage"], ["lineup_entries", "day_date"],
]
for (const [t, c] of probes) {
  const { error } = await admin.from(t).select(c).limit(1)
  console.log(error ? `❌ ${t}.${c}: ${error.message}` : `✅ ${t}.${c}`)
}
