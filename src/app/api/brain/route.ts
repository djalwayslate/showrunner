import Anthropic from "@anthropic-ai/sdk"
import { NextRequest } from "next/server"

const client = new Anthropic()

export async function POST(request: NextRequest) {
  try {
    const { question, image, imageMime, fileText, context, playbook, history } = await request.json()

    const system = `You are the operations brain for Latino Kings, a baile funk / Latin electronic event series in Vilnius.
You do two things in one: ANSWER questions about the current event, and INGEST data the user gives you (screenshots, pasted files, or typed lists) by extracting structured rows.

Ground answers only in the EVENT DATA + PLAYBOOK provided — never invent numbers.

When the user shares or types roster / lineup / budget / guest list data, extract it into rows and return a proposal so they can add it with one tap. Decide the target:
- "hosp" rows: { name, count (int), days (array of day-of-month ints for the event dates), room ("Single"|"Double"|"Room"), role (""|"Org"|"Crew"|"Headliner") }
- "lineup" rows: { name, role ("Headliner"|"Support"|"Crew"|"Org"), start_time ("HH:MM"|null), end_time, fee (number), status ("Pending"|"Sent"|"Signed"|"Paid"), stage (string), day_date ("YYYY-MM-DD"|null) }
- "budget" rows: { type ("revenue"|"cost"), label, planned (number), actual (number) }
- "guests" rows: { name, ticket_type ("Free"|"Paper"|"Box"|"Paid"|"VIP"), plus_ones (int, default 0), added_by (string, default "") }

ALWAYS respond as a single JSON object, nothing else:
{ "answer": "short natural-language reply to the user", "proposal": { "target": "hosp"|"lineup"|"budget"|"guests", "summary": "what you'll add", "rows": [ ... ] } | null }
If it's just a question (no data to add), set proposal to null and put your reply in answer.`

    const content: Anthropic.MessageParam["content"] = []
    if (image && imageMime) {
      content.push({ type: "image", source: { type: "base64", media_type: imageMime, data: image } })
    }
    if (fileText) content.push({ type: "text", text: `Attached file content:\n${String(fileText).slice(0, 12000)}` })
    content.push({ type: "text", text: question || "Here's a file — pull anything useful into the system." })

    const msgs: Anthropic.MessageParam[] = [
      ...((history ?? []) as { role: "user" | "assistant"; content: string }[]).slice(-4).map((m) => ({
        role: m.role, content: m.content,
      })),
      { role: "user" as const, content },
    ]

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: `${system}\n\n=== EVENT DATA ===\n${JSON.stringify(context ?? {}, null, 2)}\n\n=== PLAYBOOK ===\n${JSON.stringify(playbook ?? [], null, 2)}`,
      messages: msgs,
    })

    const text = response.content.find((c) => c.type === "text")?.text ?? "{}"
    const match = text.match(/\{[\s\S]*\}/)
    let parsed: { answer?: string; proposal?: unknown } = {}
    try { parsed = match ? JSON.parse(match[0]) : { answer: text } } catch { parsed = { answer: text } }
    return Response.json({ answer: parsed.answer ?? "Done.", proposal: parsed.proposal ?? null })
  } catch (err: unknown) {
    console.error("brain error", err)
    return Response.json({ error: err instanceof Error ? err.message : "Brain failed" }, { status: 500 })
  }
}
