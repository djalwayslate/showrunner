import Anthropic from "@anthropic-ai/sdk"
import { NextRequest } from "next/server"

const client = new Anthropic()

export async function POST(request: NextRequest) {
  try {
    const { history, upcoming, playbook } = await request.json()

    const system = `You are the operations brain for Latino Kings, a baile funk / Latin electronic event series in Vilnius.
You analyse the team's PAST events (real revenue, cost, net, attendance) and give sharp, useful, honest insight — like a promoter who knows the numbers, not a consultant.

Ground everything in the data. Don't invent figures. If the sample is small (2-3 events), say so and treat forecasts as directional, not precise.

Cover, briefly:
1. What's working / what's bleeding money (per-event and overall).
2. Patterns you can see (net per head, cost control, city differences) — only what the data supports.
3. A forecast for the next/upcoming event: expected net range and break-even attendance, reasoned from the history averages and the Playbook's formulas.
4. One or two concrete things to do differently next time.

Keep it tight — under ~300 words. Use plain Markdown with short bold labels. No fluff.`

    const userMsg = `PAST EVENTS (the real track record):
${JSON.stringify(history, null, 2)}

UPCOMING EVENTS (to forecast):
${JSON.stringify(upcoming, null, 2)}

PLAYBOOK (formulas, rules, patterns):
${JSON.stringify(playbook, null, 2)}`

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1200,
      system,
      messages: [{ role: "user", content: userMsg }],
    })

    const narrative = response.content.find((c) => c.type === "text")?.text ?? ""
    return Response.json({ narrative })
  } catch (err: unknown) {
    console.error("insights error", err)
    return Response.json({ error: err instanceof Error ? err.message : "Insights failed" }, { status: 500 })
  }
}
