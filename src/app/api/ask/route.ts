import Anthropic from "@anthropic-ai/sdk"
import { NextRequest } from "next/server"

const client = new Anthropic()

export async function POST(request: NextRequest) {
  try {
    const { question, context, history, playbook } = await request.json()

    const contextStr = JSON.stringify(context, null, 2)
    const playbookStr = playbook ? JSON.stringify(playbook, null, 2) : "(none yet)"

    const systemPrompt = `You are the operations brain for Latino Kings, a baile funk / Latin electronic event production team in Vilnius.
You answer questions about the currently selected event using ONLY the data provided. Do not invent numbers or names not present in the data. Be concise, direct, and specific — lead with the number or answer.

You also have the team's PLAYBOOK: their formulas, rules and patterns. When a question calls for a calculation or judgment (break-even, how many drink tickets, whether something follows their standards), apply the Playbook's formulas and rules rather than generic assumptions. If the Playbook and the data disagree, surface that.

If you genuinely can't answer from the data, say so plainly.

=== EVENT DATA ===
${contextStr}

=== PLAYBOOK (formulas, rules, patterns) ===
${playbookStr}`

    const msgs: Anthropic.MessageParam[] = [
      ...((history ?? []) as { role: "user" | "assistant"; content: string }[]).slice(-6).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: question },
    ]

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      system: systemPrompt,
      messages: msgs,
    })

    const answer = response.content.find((c) => c.type === "text")?.text ?? "No response"
    return Response.json({ answer })
  } catch (err: unknown) {
    console.error("ask error", err)
    return Response.json(
      { error: err instanceof Error ? err.message : "Ask failed" },
      { status: 500 }
    )
  }
}
