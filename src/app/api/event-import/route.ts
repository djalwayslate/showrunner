import Anthropic from "@anthropic-ai/sdk"
import { NextRequest } from "next/server"

const client = new Anthropic()

// Resident Advisor blocks server HTML fetches (403) but exposes a public GraphQL API.
async function importFromRA(eventId: string) {
  const query = {
    query: `query GET_EVENT($id: ID!) { event(id: $id) { id title content startTime endTime flyerFront venue { name address } artists { name } } }`,
    variables: { id: eventId },
  }
  const res = await fetch("https://ra.co/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      Referer: `https://ra.co/events/${eventId}`,
      Origin: "https://ra.co",
      "ra-content-language": "en",
    },
    body: JSON.stringify(query),
  })
  if (!res.ok) return null
  const json = await res.json()
  const e = json?.data?.event
  if (!e) return null

  const datePart = (s: string | null) => (s ? s.slice(0, 10) : null)
  const timePart = (s: string | null) => (s ? s.slice(11, 16) : null)
  // Keep the English half of the bilingual blurb if present, trimmed
  let desc: string | null = e.content ?? null
  if (desc) {
    const parts = desc.split(/-{4,}/).map((p: string) => p.trim()).filter(Boolean)
    desc = (parts[1] || parts[0] || "").slice(0, 320)
  }
  return {
    name: e.title ?? null,
    venue: e.venue?.name ?? null,
    start_date: datePart(e.startTime),
    end_date: datePart(e.endTime) ?? datePart(e.startTime),
    start_time: timePart(e.startTime),
    description: desc,
    poster_url: e.flyerFront ?? null,
    lineup: (e.artists ?? []).map((a: { name: string }) => a.name).filter(Boolean),
  }
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()
    if (!url || !/^https?:\/\//.test(url)) {
      return Response.json({ error: "Paste a full link starting with https://" }, { status: 400 })
    }

    // Resident Advisor — use their API
    const raMatch = url.match(/ra\.co\/events\/(\d+)/i)
    if (raMatch) {
      const data = await importFromRA(raMatch[1])
      if (data) return Response.json({ data })
      return Response.json({ error: "RA wouldn't return that event. Check the link or fill it manually." }, { status: 502 })
    }

    // Generic page — fetch HTML and read its metadata
    let html = ""
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
          Accept: "text/html",
        },
        redirect: "follow",
      })
      if (res.status === 403 || res.status === 401) {
        return Response.json({ error: "That site blocks automated reads (Facebook and some others do this). Use the RA or ticket link, or fill it manually." }, { status: 502 })
      }
      html = await res.text()
    } catch {
      return Response.json({ error: "Couldn't open that link. Try the RA or ticket link instead." }, { status: 502 })
    }

    const head = (html.match(/<head[\s\S]*?<\/head>/i)?.[0] ?? html).slice(0, 16000)
    const jsonld = (html.match(/<script[^>]*application\/ld\+json[^>]*>[\s\S]*?<\/script>/gi) ?? []).join("\n").slice(0, 8000)

    const system = `You extract event details from a web page's HTML metadata (Open Graph tags, JSON-LD, title).
Return ONLY valid JSON: { "name": string|null, "venue": string|null, "start_date": "YYYY-MM-DD"|null, "end_date": "YYYY-MM-DD"|null, "start_time": "HH:MM"|null, "description": string|null, "poster_url": string|null }
Use og:image for poster_url. Use JSON-LD startDate/endDate/location when present. Keep description under 280 chars. null for anything unknown.`

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      system,
      messages: [{ role: "user", content: `URL: ${url}\n\nHEAD:\n${head}\n\nJSON-LD:\n${jsonld}` }],
    })
    const text = response.content.find((c) => c.type === "text")?.text ?? "{}"
    const match = text.match(/\{[\s\S]*\}/)
    return Response.json({ data: match ? JSON.parse(match[0]) : {} })
  } catch (err: unknown) {
    console.error("event-import error", err)
    return Response.json({ error: err instanceof Error ? err.message : "Import failed" }, { status: 500 })
  }
}
