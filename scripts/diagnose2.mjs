import { createClient } from "@supabase/supabase-js"
const URL = "https://csjltossxfzyynqhspzb.supabase.co"
const admin = createClient(URL, process.env.SR, { auth: { persistSession: false } })

const { data: evs } = await admin.from("events").select("id,name")
console.log("EVENTS:")
evs.forEach((e) => console.log(`  ${e.id}  ${e.name}`))

const { data: tks } = await admin.from("tasks").select("event_id,title,phase")
console.log(`\nTASKS (${tks.length}):`)
const byEvent = {}
tks.forEach((t) => { byEvent[t.event_id] = (byEvent[t.event_id] || 0) + 1 })
Object.entries(byEvent).forEach(([eid, n]) => {
  const ev = evs.find((e) => e.id === eid)
  console.log(`  ${n} tasks -> event ${eid} (${ev?.name ?? "UNKNOWN/orphaned"})`)
})

const { data: prof } = await admin.from("profiles").select("id,role,display_name")
console.log("\nPROFILES:", JSON.stringify(prof))

// Probe is_core_plus / is_admin existence by calling rpc (will error if missing)
for (const fn of ["is_core_plus", "is_admin"]) {
  const { error } = await admin.rpc(fn)
  console.log(`fn ${fn}: ${error ? "ERR " + error.message : "exists"}`)
}
