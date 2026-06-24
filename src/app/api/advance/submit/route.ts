import { NextRequest } from "next/server"
import { authRecipient } from "@/lib/advancing/server"

// Public: an external recipient submits one of THEIR requests for team approval.
export async function POST(request: NextRequest) {
  try {
    const { token, requestId } = await request.json()
    const auth = await authRecipient(token)
    if (!auth) return Response.json({ error: "This link is invalid or has expired." }, { status: 404 })
    const { admin, recipient } = auth

    const { data: req } = await admin
      .from("advance_requests")
      .select("id, recipient_id, status")
      .eq("id", requestId)
      .single()
    if (!req || req.recipient_id !== recipient.id) {
      return Response.json({ error: "Not allowed." }, { status: 403 })
    }
    if (req.status === "approved") {
      return Response.json({ error: "Already approved." }, { status: 409 })
    }

    const { error } = await admin
      .from("advance_requests")
      .update({ status: "submitted", updated_at: new Date().toISOString() })
      .eq("id", requestId)
    if (error) throw error

    return Response.json({ ok: true })
  } catch (err: unknown) {
    console.error("advance/submit error", err)
    return Response.json({ error: err instanceof Error ? err.message : "Failed to submit" }, { status: 500 })
  }
}
