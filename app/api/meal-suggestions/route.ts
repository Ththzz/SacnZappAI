import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { jsonError } from "@/lib/http"

type MealSuggestion = {
  id: string
  name: string
  caloriesDelta: number
  protein: number
  reason: string
}

const defaultQwenModel = "qwen/qwen3.7-plus"
const apiBaseUrl = process.env.AI_BASE_URL?.trim() || "https://ai.psu.blue/v1"

function extractJson(content: string) {
  const codeBlock = content.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlock) return codeBlock[1].trim()
  const arrayMatch = content.match(/\[[\s\S]*\]/)
  return arrayMatch ? arrayMatch[0] : content
}

function normalizeSuggestions(value: unknown): MealSuggestion[] {
  if (!Array.isArray(value)) return []

  return value.slice(0, 3).flatMap((item, index) => {
    if (!item || typeof item !== "object") return []
    const record = item as Record<string, unknown>
    const name = typeof record.name === "string" ? record.name.trim() : ""
    if (!name) return []

    return [{
      id: typeof record.id === "string" && record.id.trim() ? record.id.trim() : `ai-${index + 1}`,
      name,
      caloriesDelta: Number.isFinite(Number(record.caloriesDelta)) ? Math.round(Number(record.caloriesDelta)) : 0,
      protein: Number.isFinite(Number(record.protein)) ? Math.round(Number(record.protein)) : 0,
      reason: typeof record.reason === "string" ? record.reason.trim() : "",
    }]
  })
}

export async function GET() {
  try {
    const user = await requireUser()
    const apiKey = process.env.QWEN_API_KEY
    const model = process.env.QWEN_MODEL?.trim() || defaultQwenModel

    const meals = await prisma.meal.findMany({
      where: { userId: user.id },
      orderBy: [{ date: "desc" }, { time: "desc" }],
      take: 14,
    })

    if (meals.length === 0) {
      return NextResponse.json({ suggestions: [], source: "empty" })
    }

    if (!apiKey) {
      return NextResponse.json({ suggestions: [], source: "missing-api-key" })
    }

    const mealSummary = meals
      .map((meal) => `${meal.date} ${meal.time}: ${meal.name}, ${meal.calories} kcal, protein ${meal.protein}g, carbs ${meal.carbs}g, fat ${meal.fat}g`)
      .join("\n")

    const response = await fetch(`${apiBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          {
            role: "system",
            content: "You are ScanZapp AI nutrition assistant. Suggest practical next meals in Thai from the user's real logged meals only. Return ONLY valid JSON array.",
          },
          {
            role: "user",
            content: `จากประวัติมื้ออาหารจริงด้านล่าง แนะนำมื้อถัดไป 3 รายการให้บาลานซ์แคลอรี่และโปรตีน ตอบเป็น JSON array เท่านั้น รูปแบบ [{"id":"string","name":"string","caloriesDelta":number,"protein":number,"reason":"string"}]\n\n${mealSummary}`,
          },
        ],
      }),
    })

    const payload = await response.json().catch(() => null) as { choices?: { message?: { content?: string } }[]; error?: { message?: string } } | null
    if (!response.ok) {
      return NextResponse.json({ suggestions: [], source: "ai-error", error: payload?.error?.message }, { status: 200 })
    }

    const content = payload?.choices?.[0]?.message?.content ?? ""
    const parsed = JSON.parse(extractJson(content)) as unknown
    return NextResponse.json({ suggestions: normalizeSuggestions(parsed), source: "ai" })
  } catch (error) {
    return jsonError(error)
  }
}
