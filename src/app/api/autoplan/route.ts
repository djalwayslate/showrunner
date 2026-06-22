import Anthropic from "@anthropic-ai/sdk"
import { NextRequest } from "next/server"

const client = new Anthropic()

export async function POST(request: NextRequest) {
  try {
    const { event, playbook, existingTasks } = await request.json()

    const system = `You are the operations brain for Latino Kings, a baile funk / Latin electronic event series in Vilnius.
Given an event's basic info and the team's PLAYBOOK, generate a concrete production plan: the tasks that need doing, organized by phase, each with how many days BEFORE the event start it should be done.

Use the Playbook's rules and patterns (e.g. "send contracts within 48h of yes", booking standards, marketing timing) to decide tasks and timing. Be specific to a music event: bookings & contracts, hospitality/rooming, production & technical, marketing & content, ticketing, day-of run sheet, and post-event settle/debrief.

Also suggest the stage/area names this kind of event likely needs (their venues are things like club rooms, beach bars, side rooms).

Return ONLY valid JSON, no prose:
{
  "stages": ["Main Stage", "..."],
  "tasks": [
    { "title": "Confirm headliner contracts", "phase": "prep", "days_before": 42, "owner": "" }
  ]
}
phase is one of: "prep" (pre-production), "week" (week of), "day" (day of), "post" (post-event).
Generate 12–20 tasks. Keep titles short and actionable. days_before is 0 for day-of, negative for post-event (e.g. -3).`

    const userMsg = `EVENT:
${JSON.stringify(event, null, 2)}

PLAYBOOK (rules, patterns, formulas):
${JSON.stringify(playbook, null, 2)}

${existingTasks?.length ? `Already-existing task titles (don't duplicate): ${JSON.stringify(existingTasks)}` : ""}`

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1800,
      system,
      messages: [{ role: "user", content: userMsg }],
    })

    const text = response.content.find((c) => c.type === "text")?.text ?? "{}"
    const match = text.match(/\{[\s\S]*\}/)
    const parsed = match ? JSON.parse(match[0]) : { stages: [], tasks: [] }
    return Response.json({ stages: parsed.stages ?? [], tasks: parsed.tasks ?? [] })
  } catch (err: unknown) {
    console.error("autoplan error", err)
    return Response.json({ error: err instanceof Error ? err.message : "Auto-plan failed" }, { status: 500 })
  }
}
