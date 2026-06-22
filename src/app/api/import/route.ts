import Anthropic from "@anthropic-ai/sdk"
import { NextRequest } from "next/server"

const client = new Anthropic()

const SYSTEM: Record<string, string> = {
  hosp: `You extract hospitality roster rows from images or CSVs.
Return a JSON array called "rows". Each row: { name, count (int), days (array of ints 13-19), room ("Single"|"Double"|"Room"), role (""|"Org"|"Crew"|"Headliner") }.
If a field is unclear, use a sensible default. Only return the JSON object, no prose.`,

  lineup: `You extract lineup/set schedule rows from images or CSVs.
Return a JSON array called "rows". Each row: { name, role ("Headliner"|"Support"|"Crew"|"Org"), start_time (HH:MM or null), end_time (HH:MM or null), fee (number, default 0), status ("Pending"|"Sent"|"Signed"|"Paid", default "Pending") }.
Only return the JSON object, no prose.`,

  budget: `You extract budget line items from images or CSVs.
Return a JSON array called "rows". Each row: { type ("revenue"|"cost"), label (string), planned (number), actual (number) }.
Only return the JSON object, no prose.`,
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData()
    const file = form.get("file") as File | null
    const target = (form.get("target") as string) || "hosp"

    if (!file) return Response.json({ error: "No file provided" }, { status: 400 })

    const system = SYSTEM[target] ?? SYSTEM.hosp
    const bytes = await file.arrayBuffer()
    const b64 = Buffer.from(bytes).toString("base64")
    const mime = file.type || "image/png"

    let content: Anthropic.MessageParam["content"]

    if (mime.startsWith("image/")) {
      content = [
        {
          type: "image",
          source: { type: "base64", media_type: mime as "image/png" | "image/jpeg" | "image/gif" | "image/webp", data: b64 },
        },
        { type: "text", text: `Extract all rows from this image. Return only the JSON object with a "rows" array.` },
      ]
    } else {
      // CSV / TSV — decode as text
      const text = Buffer.from(bytes).toString("utf-8")
      content = [
        {
          type: "text",
          text: `Here is the CSV/TSV data:\n\n${text}\n\nExtract all rows. Return only the JSON object with a "rows" array.`,
        },
      ]
    }

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      system,
      messages: [{ role: "user", content }],
    })

    const text = response.content.find((c) => c.type === "text")?.text ?? "{}"
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return Response.json({ rows: [] })

    const parsed = JSON.parse(match[0])
    return Response.json({ rows: parsed.rows ?? [] })
  } catch (err: unknown) {
    console.error("import error", err)
    return Response.json(
      { error: err instanceof Error ? err.message : "Extraction failed" },
      { status: 500 }
    )
  }
}
