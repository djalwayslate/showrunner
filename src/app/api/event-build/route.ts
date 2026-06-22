import Anthropic from "@anthropic-ai/sdk"
import { NextRequest } from "next/server"

const client = new Anthropic()

export async function POST(request: NextRequest) {
  try {
    const { context, startDate, endDate, playbook, orgDefaults, history } = await request.json()

    const system = `You are the operations brain for Latino Kings, a baile funk / Latin electronic event series in Vilnius.
From a short description of a NEW event, produce a COMPLETE production blueprint the Latino Kings way: event details, stages, a phased task plan, a budget skeleton, a hospitality roster, and a draft timetable. Ground everything in the team's PLAYBOOK and the HISTORY of past events.

HARD RULES:
- Never invent specific numbers. Base attendance and budget "planned" figures on HISTORY (similar past events) or leave them 0. If history is empty, use 0 / null.
- Never invent real artist names. In the timetable use placeholder slot labels like "Headliner slot", "Support — TBA", "B2B slot".
- Use ORG DEFAULTS for stages when the description doesn't specify them.
- days_before is counted back from the event start: a positive number is that many days before, 0 is the day of, a negative number is post-event (e.g. -3 = 3 days after).
- day_offset is the event day index: 0 = first day, 1 = second day, etc.
- Keep task titles short and actionable. Cover bookings & contracts, hospitality/rooming, production/technical, marketing & content, ticketing, day-of run sheet, and post-event settle/debrief.

Return ONLY valid JSON, no prose:
{
  "event": {
    "name": string,
    "venue": string|null,
    "start_date": "YYYY-MM-DD"|null,
    "end_date": "YYYY-MM-DD"|null,
    "start_time": "HH:MM"|null,
    "attendance": number|null,
    "description": string,
    "stages": ["Main Stage", "..."]
  },
  "tasks":  [ { "title": string, "phase": "prep"|"week"|"day"|"post", "days_before": number, "owner": "" } ],
  "budget": [ { "type": "revenue"|"cost", "label": string, "planned": number } ],
  "hosp":   [ { "name": string, "count": number, "room": "Single"|"Double"|"Room", "role": ""|"Org"|"Crew"|"Headliner", "day_offsets": number[] } ],
  "lineup": [ { "name": string, "role": "Headliner"|"Support"|"Crew"|"Org", "stage": string, "day_offset": number, "start_time": "HH:MM"|null, "end_time": "HH:MM"|null, "kind": "music"|"activity" } ]
}
Generate 12–20 tasks across phases, 6–10 budget lines (both revenue and cost), 3–8 hospitality rows (headliner / crew / org placeholders), and 6–14 lineup slots spread across the stages and days.
start_date/end_date: only fill if the description clearly implies a date; otherwise null (the user will set them).`

    const userMsg = `NEW EVENT DESCRIPTION:
${context}

${startDate ? `Confirmed start date: ${startDate}` : "Start date: not given — infer only if the description clearly implies one, else leave null."}
${endDate ? `Confirmed end date: ${endDate}` : ""}

ORG DEFAULTS (stages, hospitality multipliers):
${JSON.stringify(orgDefaults ?? {}, null, 2)}

PLAYBOOK (rules, patterns, formulas):
${JSON.stringify(playbook ?? [], null, 2)}

HISTORY (past events — for grounding attendance & budget, never copy verbatim):
${JSON.stringify(history ?? [], null, 2)}`

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      system,
      messages: [{ role: "user", content: userMsg }],
    })

    const text = response.content.find((c) => c.type === "text")?.text ?? "{}"
    const match = text.match(/\{[\s\S]*\}/)
    const parsed = match ? JSON.parse(match[0]) : {}
    return Response.json({
      event: parsed.event ?? null,
      tasks: parsed.tasks ?? [],
      budget: parsed.budget ?? [],
      hosp: parsed.hosp ?? [],
      lineup: parsed.lineup ?? [],
    })
  } catch (err: unknown) {
    console.error("event-build error", err)
    return Response.json({ error: err instanceof Error ? err.message : "Event build failed" }, { status: 500 })
  }
}
