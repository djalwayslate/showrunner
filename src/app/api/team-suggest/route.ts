import Anthropic from "@anthropic-ai/sdk"
import { NextRequest, NextResponse } from "next/server"

const ai = new Anthropic()

const DEPARTMENTS = ["Leadership", "Operations", "Booking", "Hospitality", "Technical", "Graphic Design", "Creative", "Communications", "Marketing"]

export async function POST(req: NextRequest) {
  const { name, context, existingMembers } = await req.json()

  const roster = (existingMembers as { name: string; positions: string[]; department: string | null }[])
    .map((m) => `${m.name}: ${(m.positions || []).join(", ")} [${m.department || "General"}]`)
    .join("\n")

  const msg = await ai.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 400,
    messages: [{
      role: "user",
      content: `You are building an org chart for Latino Kings, a baile funk / Latin-electronic event series.

Current team:
${roster || "(empty)"}

New person to place: ${name || "Unknown"}
Context: ${context}

Based on the context, suggest:
1. Up to 3 specific positions/roles that fit this person (short, concrete: "Stage Manager", "Social Media", "Visual Artist", "DJ", "Sound Engineer", "Promoter", "Event Coordinator", "Graphic Design", "Finance", "Booking", "PR", "Security", "Bar Manager", etc.)
2. The best department from: ${DEPARTMENTS.join(", ")}

Return ONLY valid JSON, nothing else:
{"positions": ["Position 1", "Position 2"], "department": "DepartmentName", "reason": "one short sentence why"}`
    }]
  })

  let raw = (msg.content[0] as { type: string; text: string }).text.trim()
  // strip markdown code fences if present
  raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim()
  // fallback: extract first {...} block
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  try {
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw)
    return NextResponse.json(parsed)
  } catch {
    return NextResponse.json({ positions: [], department: "General", reason: "Could not parse suggestion." })
  }
}
