import Anthropic from "@anthropic-ai/sdk"
import { NextRequest } from "next/server"

const client = new Anthropic()

export async function POST(request: NextRequest) {
  try {
    const { artistName, image, imageMime, pdf, fileText } = await request.json()

    const system = `You read artist riders (tour/hospitality/technical riders) and extract their requirements as a clean checklist.
Separate items into categories:
- "hospitality" — food, drinks, towels, backstage, green room, transport, accommodation, catering
- "technical" — DJ gear (CDJs, mixer model, turntables), monitors, microphones, stage/booth setup, cables, power
- "other" — anything that doesn't fit

Return ONLY valid JSON: { "items": [ { "category": "hospitality"|"technical"|"other", "item": "short name", "qty": "amount or empty string" } ] }
Keep item names short and specific (e.g. "Pioneer CDJ-3000", "Still water", "Towels"). Use qty for counts ("4", "2 bottles"). Don't invent items not in the rider. If you can't read it, return an empty items array.`

    const content: Anthropic.MessageParam["content"] = []
    if (pdf) {
      content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf } })
    }
    if (image && imageMime) {
      content.push({ type: "image", source: { type: "base64", media_type: imageMime, data: image } })
    }
    if (fileText) content.push({ type: "text", text: `Rider text:\n${String(fileText).slice(0, 14000)}` })
    content.push({ type: "text", text: `Extract the rider requirements${artistName ? ` for ${artistName}` : ""}. Return only the JSON.` })

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system,
      messages: [{ role: "user", content }],
    })

    const text = response.content.find((c) => c.type === "text")?.text ?? "{}"
    const match = text.match(/\{[\s\S]*\}/)
    const parsed = match ? JSON.parse(match[0]) : { items: [] }
    return Response.json({ items: parsed.items ?? [] })
  } catch (err: unknown) {
    console.error("rider error", err)
    return Response.json({ error: err instanceof Error ? err.message : "Couldn't read the rider" }, { status: 500 })
  }
}
