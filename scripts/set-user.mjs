import { createClient } from "@supabase/supabase-js"

const URL = "https://csjltossxfzyynqhspzb.supabase.co"
const SERVICE_ROLE = process.env.SR
const EMAIL = "m.galdikas07@gmail.com"
const PASSWORD = "latinokings2026"

const admin = createClient(URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Find existing user by email
const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
if (listErr) {
  console.error("listUsers error:", listErr.message)
  process.exit(1)
}

const existing = list.users.find((u) => u.email?.toLowerCase() === EMAIL.toLowerCase())

if (existing) {
  const { error } = await admin.auth.admin.updateUserById(existing.id, {
    password: PASSWORD,
    email_confirm: true,
  })
  if (error) {
    console.error("update error:", error.message)
    process.exit(1)
  }
  console.log("UPDATED existing user:", existing.id, "->", EMAIL, "/ password set / confirmed")
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  })
  if (error) {
    console.error("create error:", error.message)
    process.exit(1)
  }
  console.log("CREATED user:", data.user.id, "->", EMAIL, "/ password set / confirmed")
}

// Promote to admin in profiles
const { data: list2 } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
const u = list2.users.find((x) => x.email?.toLowerCase() === EMAIL.toLowerCase())
if (u) {
  const { error: profErr } = await admin
    .from("profiles")
    .upsert({ id: u.id, role: "admin", display_name: "Mantas" }, { onConflict: "id" })
  if (profErr) console.error("profile update warning:", profErr.message)
  else console.log("PROFILE set to admin for", u.id)
}
