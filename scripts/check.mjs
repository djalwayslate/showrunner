import { readFileSync } from "fs"
import pg from "pg"
const url = readFileSync(".env.local","utf8").split("\n").find(l=>l.startsWith("DATABASE_URL=")).slice("DATABASE_URL=".length).trim()
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
await c.connect()
console.log("Supabase connection: OK\n--- requested tables (live row counts) ---")
for (const t of ["events","lineup_entries","budget_items","hosp_settings","hosp_people","hosp_person_days","guests"]) {
  try { const r = await c.query(`select count(*) n from ${t}`); console.log(`  ✅ ${t.padEnd(18)} ${r.rows[0].n} rows`) }
  catch(e){ console.log(`  ❌ ${t}: ${e.message}`) }
}
console.log("\n--- all RLS policies present? ---")
const p = await c.query("select count(*) n from pg_policies where schemaname='public'")
console.log("  policies:", p.rows[0].n)
await c.end()
