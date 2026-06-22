import Anthropic from "@anthropic-ai/sdk"
import { NextRequest } from "next/server"

const client = new Anthropic()

export async function POST(request: NextRequest) {
  try {
    const { event, spend, budget, history, playbook } = await request.json()

    const system = `You are the marketing brain for Latino Kings, a baile funk / Latin electronic event series in Vilnius.
You advise on ad spend with a promoter's instinct, grounded only in the data given. Never invent numbers.

Given this event's ad spend by channel, its budget, and past events, give tight, practical advice:
1. Which channels are working / wasting money (cost per ticket, reach efficiency) — only from the data.
2. A recommended ad budget for this event, reasoned from history and the Playbook's break-even logic.
3. The "spend-to-earn" read: roughly how much to spend to hit a healthy net, and the risk if they under/over-spend.
4. One or two concrete moves.

If data is thin, say so and keep advice directional. Under ~250 words, plain Markdown, short bold labels.`

    const userMsg = `EVENT: ${JSON.stringify(event)}
AD SPEND (this event): ${JSON.stringify(spend, null, 2)}
BUDGET: ${JSON.stringify(budget, null, 2)}
PAST EVENTS: ${JSON.stringify(history, null, 2)}
PLAYBOOK: ${JSON.stringify(playbook, null, 2)}`

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system,
      messages: [{ role: "user", content: userMsg }],
    })

    const tips = response.content.find((c) => c.type === "text")?.text ?? ""
    return Response.json({ tips })
  } catch (err: unknown) {
    console.error("marketing error", err)
    return Response.json({ error: err instanceof Error ? err.message : "Marketing analysis failed" }, { status: 500 })
  }
}
