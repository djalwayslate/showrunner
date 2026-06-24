import { NextRequest } from "next/server"
import { authRecipient } from "@/lib/advancing/server"

// Public: returns everything an external recipient needs to fill in their part.
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token")
    const auth = await authRecipient(token)
    if (!auth) return Response.json({ error: "This link is invalid or has expired." }, { status: 404 })
    const { admin, recipient } = auth

    const [{ data: event }, { data: requests }] = await Promise.all([
      admin.from("events").select("id, name, venue, start_date, end_date, start_time, poster_url").eq("id", recipient.event_id).single(),
      admin.from("advance_requests").select("*").eq("recipient_id", recipient.id).order("sort_order"),
    ])

    await admin.from("advance_recipients").update({ last_seen_at: new Date().toISOString() }).eq("id", recipient.id)

    return Response.json({
      recipient: { id: recipient.id, name: recipient.name, scope: recipient.scope },
      event: event ?? null,
      requests: requests ?? [],
    })
  } catch (err: unknown) {
    console.error("advance/state error", err)
    return Response.json({ error: err instanceof Error ? err.message : "Failed to load" }, { status: 500 })
  }
}
