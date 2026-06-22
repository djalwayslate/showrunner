import { readFileSync, existsSync } from "fs"
import pg from "pg"

function envFromFile() {
  if (!existsSync(".env.local")) return undefined
  const line = readFileSync(".env.local", "utf8").split("\n").find((l) => l.startsWith("DATABASE_URL="))
  return line ? line.slice("DATABASE_URL=".length).trim() : undefined
}

// Usage: node scripts/run-migration.mjs [sqlFile] [connString]
//   - if first arg looks like a path, it's the sqlFile; conn comes from .env.local
const args = process.argv.slice(2)
const looksLikeConn = (s) => s && s.startsWith("postgres")
const conn = args.find(looksLikeConn) || process.env.DATABASE_URL || envFromFile()
const sqlFile = args.find((a) => !looksLikeConn(a)) || "scripts/fix.sql"
if (!conn) {
  console.error("Usage: node scripts/run-migration.mjs '<connection-string>' [sqlFile]")
  process.exit(1)
}

const sql = readFileSync(sqlFile, "utf8")
const client = new pg.Client({ connectionString: conn, ssl: { rejectUnauthorized: false } })

try {
  await client.connect()
  await client.query(sql)
  console.log("✅ Migration applied successfully from", sqlFile)
} catch (e) {
  console.error("❌ Migration failed:", e.message)
  process.exit(1)
} finally {
  await client.end()
}
