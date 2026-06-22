import Anthropic from "@anthropic-ai/sdk"
import { NextRequest } from "next/server"

const client = new Anthropic()

export async function POST(request: NextRequest) {
  try {
    const { audience, angle, event, context, playbook } = await request.json()

    const system = `You are the head of partnerships for Latino Kings, a baile funk / Latin electronic event series in Vilnius, Lithuania.
You write sharp, confident sponsorship and partnership proposals that read like a real promoter wrote them — not corporate filler.

Ground everything in the REAL data provided. Use actual dates, headcounts, lineup names and budget figures. Never invent numbers that aren't supported by the data; if something isn't known, frame it as a projection or leave it as a clear placeholder in [brackets].

Honor the Latino Kings PLAYBOOK (their formulas, rules and patterns) — it reflects how this team actually operates.

Output clean Markdown with these sections:
# {Event} × {Audience} — Partnership Proposal
**The event** (1 short paragraph: what it is, dates, venue, vibe)
**By the numbers** (bullet list from real data: dates, expected headcount/guest-days, lineup highlights)
**What we're offering** (concrete deliverables for this partner)
**The ask** (what we want from them — money, product, or reach — tie to budget where relevant)
**Why it fits** (2-3 sentences on audience fit)

Keep it tight — under ~400 words. Make it feel premium and specific.`

    const userMsg = `Write a proposal.

PARTNER / AUDIENCE: ${audience || "(a relevant sponsor — pick a sensible angle)"}
ANGLE / NOTES: ${angle || "(none given — use your judgment)"}

EVENT:
${JSON.stringify(event, null, 2)}

EVENT DATA (hospitality, lineup, budget):
${JSON.stringify(context, null, 2)}

LATINO KINGS PLAYBOOK (their formulas, rules, patterns):
${JSON.stringify(playbook, null, 2)}`

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system,
      messages: [{ role: "user", content: userMsg }],
    })

    const body = response.content.find((c) => c.type === "text")?.text ?? ""
    return Response.json({ body })
  } catch (err: unknown) {
    console.error("proposal error", err)
    return Response.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 }
    )
  }
}
