import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"

import { requestAiChat } from "@/lib/ai/provider"
import { requireUser } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { jsonError } from "@/lib/http"

type MealSuggestion = {
  id: string
  name: string
  calories: number
  protein: number
  carbs: number
  fat: number
  reason: string
}

type MealMacroTotals = {
  calories: number
  protein: number
  carbs: number
  fat: number
}

type GeneratedSuggestionResult = {
  suggestions: MealSuggestion[]
  generatedAt: Date
}

export const maxDuration = 60
const defaultMealSuggestionModel = "qwen/qwen3.6-flash"

const bangkokTimeZone = "Asia/Bangkok"
const dayMs = 24 * 60 * 60 * 1000
const globalSuggestionJobs = globalThis as typeof globalThis & {
  mealSuggestionJobs?: Map<string, Promise<GeneratedSuggestionResult>>
}
const suggestionJobs = globalSuggestionJobs.mealSuggestionJobs ?? new Map<string, Promise<GeneratedSuggestionResult>>()
globalSuggestionJobs.mealSuggestionJobs = suggestionJobs

function extractJson(content: string) {
  const codeBlock = content.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlock) return codeBlock[1].trim()
  const arrayMatch = content.match(/\[[\s\S]*\]/)
  return arrayMatch ? arrayMatch[0] : content
}

function normalizeSuggestions(value: unknown): MealSuggestion[] {
  if (!Array.isArray(value)) return []

  return value.slice(0, 3).flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const record = item as Record<string, unknown>
    const name = typeof record.name === "string" ? record.name.trim() : ""
    if (!name) return []

    return [{
      id: typeof record.id === "string" && record.id.trim() ? record.id.trim() : randomUUID(),
      name,
      calories: Math.max(0, Math.round(Number(record.calories) || 0)),
      protein: Math.max(0, Math.round(Number(record.protein) || 0)),
      carbs: Math.max(0, Math.round(Number(record.carbs) || 0)),
      fat: Math.max(0, Math.round(Number(record.fat) || 0)),
      reason: typeof record.reason === "string" ? record.reason.trim() : "",
    }]
  })
}

function getBangkokDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: bangkokTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value)
  return { year: read("year"), month: read("month"), day: read("day") }
}

function getBangkokSevenDayKeys(date = new Date()) {
  const { year, month, day } = getBangkokDateParts(date)
  const todayUtc = Date.UTC(year, month - 1, day)
  return Array.from({ length: 7 }, (_, index) => {
    const target = new Date(todayUtc - (6 - index) * dayMs)
    return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, "0")}-${String(target.getUTCDate()).padStart(2, "0")}`
  })
}

function isSameBangkokDay(first: Date, second: Date) {
  return getBangkokSevenDayKeys(first)[6] === getBangkokSevenDayKeys(second)[6]
}

function parseCachedSuggestions(raw: string | undefined) {
  if (!raw) return []
  try {
    return normalizeSuggestions(JSON.parse(raw))
  } catch {
    return []
  }
}

function readDailyCalories(settingsJson: string | undefined) {
  try {
    const settings = settingsJson
      ? JSON.parse(settingsJson) as { healthGoal?: { dailyCalories?: number } }
      : null
    const value = Number(settings?.healthGoal?.dailyCalories)
    return Number.isFinite(value) && value > 0 ? Math.round(value) : null
  } catch {
    return null
  }
}

function summarizeTotals(meals: Awaited<ReturnType<typeof loadRecentMeals>>): MealMacroTotals {
  return meals.reduce(
    (sum, meal) => ({
      calories: sum.calories + meal.calories,
      protein: sum.protein + meal.protein,
      carbs: sum.carbs + meal.carbs,
      fat: sum.fat + meal.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  )
}

async function createSuggestions(
  meals: Awaited<ReturnType<typeof loadRecentMeals>>,
  dailyCalories: number | null,
) {
  const apiKey = process.env.QWEN_API_KEY
  const model =
    process.env.MEAL_SUGGESTION_MODEL?.trim() ||
    defaultMealSuggestionModel
  if (!apiKey) throw new Error("QWEN_API_KEY_MISSING")

  const totals = summarizeTotals(meals)
  const mealSummary = meals
    .map((meal) => `${meal.date} ${meal.time}: ${meal.name}, ${meal.calories} kcal, protein ${meal.protein}g, carbs ${meal.carbs}g, fat ${meal.fat}g`)
    .join("\n")

  const completion = await requestAiChat({
    apiKey,
    model,
    timeoutMs: 12_000,
    maxTokens: 320,
    enableThinking: false,
    messages: [
      {
        role: "system",
        content:
          "You are ScanZapp AI nutrition assistant. Suggest 3 practical Thai next meals from the user's real seven-day meal history. Estimate nutrition conservatively per serving. Return ONLY a valid JSON array with short reasons.",
      },
      {
        role: "user",
        content:
          `แนะนำมื้อถัดไป 3 รายการให้สมดุลกับข้อมูลย้อนหลัง 7 วัน ตอบเป็น JSON array เท่านั้น รูปแบบ [{"name":"string","calories":number,"protein":number,"carbs":number,"fat":number,"reason":"string"}]\n` +
          `เป้าหมายต่อวัน: ${dailyCalories ? `${dailyCalories} kcal` : "ยังไม่ตั้งค่า"}\n` +
          `ยอดรวม 7 วัน: ${Math.round(totals.calories)} kcal, protein ${Math.round(totals.protein)}g, carbs ${Math.round(totals.carbs)}g, fat ${Math.round(totals.fat)}g\n\n${mealSummary}`,
      },
    ],
  })

  const suggestions = normalizeSuggestions(JSON.parse(extractJson(completion.text)))
  if (suggestions.length === 0) throw new Error("AI_SUGGESTIONS_EMPTY")
  return suggestions
}

async function createAndCacheSuggestionsOnce(
  userId: string,
  meals: Awaited<ReturnType<typeof loadRecentMeals>>,
  dailyCalories: number | null,
) {
  const running = suggestionJobs.get(userId)
  if (running) return running

  const job = (async () => {
    const suggestions = await createSuggestions(meals, dailyCalories)
    const generatedAt = new Date()
    await prisma.mealSuggestionCache.upsert({
      where: { userId },
      create: {
        userId,
        suggestionsJson: JSON.stringify(suggestions),
        generatedAt,
      },
      update: {
        suggestionsJson: JSON.stringify(suggestions),
        generatedAt,
      },
    })
    return { suggestions, generatedAt }
  })().finally(() => {
    if (suggestionJobs.get(userId) === job) suggestionJobs.delete(userId)
  })
  suggestionJobs.set(userId, job)
  return job
}

async function loadRecentMeals(userId: string) {
  const dateKeys = getBangkokSevenDayKeys()
  return prisma.meal.findMany({
    where: { userId, date: { gte: dateKeys[0], lte: dateKeys[6] } },
    orderBy: [{ date: "desc" }, { time: "desc" }],
  })
}

export async function GET() {
  try {
    const user = await requireUser()
    const cache = await prisma.mealSuggestionCache.findUnique({ where: { userId: user.id } })
    const cachedSuggestions = parseCachedSuggestions(cache?.suggestionsJson)
    const cacheIsStale = Boolean(cache && !isSameBangkokDay(cache.generatedAt, new Date()))

    return NextResponse.json({
      suggestions: cachedSuggestions,
      source: cachedSuggestions.length > 0 ? (cacheIsStale ? "cache-stale" : "cache") : "empty",
      generatedAt: cache?.generatedAt.toISOString() ?? null,
      isStale: cachedSuggestions.length > 0 && cacheIsStale,
      refreshing: false,
    })
  } catch (error) {
    return jsonError(error)
  }
}

export async function POST() {
  try {
    const user = await requireUser()
    const [meals, settingsRow] = await Promise.all([
      loadRecentMeals(user.id),
      prisma.userSettings.findUnique({ where: { userId: user.id }, select: { settingsJson: true } }),
    ])

    if (meals.length === 0) {
      return NextResponse.json(
        { error: "ต้องมีข้อมูลมื้ออาหารในช่วง 7 วันก่อนสร้างคำแนะนำ" },
        { status: 422 },
      )
    }

    if (!process.env.QWEN_API_KEY) {
      return NextResponse.json(
        { error: "ยังไม่ได้ตั้งค่า QWEN_API_KEY สำหรับสร้างคำแนะนำ" },
        { status: 503 },
      )
    }

    const result = await createAndCacheSuggestionsOnce(
      user.id,
      meals,
      readDailyCalories(settingsRow?.settingsJson),
    )

    return NextResponse.json({
      suggestions: result.suggestions,
      source: "generated",
      generatedAt: result.generatedAt.toISOString(),
      isStale: false,
      refreshing: false,
    })
  } catch (error) {
    if (error instanceof Response) return error
    console.error("Meal suggestion generation failed", error)
    return NextResponse.json(
      { error: "สร้างคำแนะนำใหม่ไม่สำเร็จ กรุณาลองอีกครั้ง" },
      { status: 502 },
    )
  }
}
