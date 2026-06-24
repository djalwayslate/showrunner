import { NextRequest } from "next/server"
import { authRecipient } from "@/lib/advancing/server"

// Public: an external recipient saves the field values for one of THEIR requests.
export async function POST(request: NextRequest) {
  try {
    const { token, requestId, data } = await request.json()
    const auth = await authRecipient(token)
    if (!auth) return Response.json({ error: "This link is invalid or has expired." }, { status: 404 })
    const { admin, recipient } = auth

    if (!requestId || typeof data !== "object" || data === null) {
      return Response.json({ error: "Missing data." }, { status: 400 })
    }

    // The request must belong to this recipient, and not be locked (approved).
    const { data: req } = await admin
      .from("advance_requests")
      .select("id, recipient_id, status")
      .eq("id", requestId)
      .single()
    if (!req || req.recipient_id !== recipient.id) {
      return Response.json({ error: "Not allowed." }, { status: 403 })
    }
    if (req.status === "approved") {
      return Response.json({ error: "This section is approved and locked. Message the team to change it." }, { status: 409 })
    }

    const { error } = await admin
      .from("advance_requests")
      .update({ data, updated_at: new Date().toISOString() })
      .eq("id", requestId)
    if (error) throw error

    return Response.json({ ok: true })
  } catch (err: unknown) {
    console.error("advance/save error", err)
    return Response.json({ error: err instanceof Error ? err.message : "Failed to save" }, { status: 500 })
  }
}
