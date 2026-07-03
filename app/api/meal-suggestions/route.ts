import { randomUUID } from "node:crypto"
import { after, NextResponse } from "next/server"

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

export const maxDuration = 60
const defaultMealSuggestionModel = "qwen/qwen3.6-flash"

const bangkokTimeZone = "Asia/Bangkok"
const dayMs = 24 * 60 * 60 * 1000
const globalSuggestionJobs = globalThis as typeof globalThis & {
  mealSuggestionJobs?: Map<string, Promise<void>>
}
const suggestionJobs = globalSuggestionJobs.mealSuggestionJobs ?? new Map<string, Promise<void>>()
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

function buildFallbackSuggestions(input: {
  meals: Awaited<ReturnType<typeof loadRecentMeals>>
  dailyCalories: number | null
}) {
  const totals = summarizeTotals(input.meals)
  const dayCount = Math.max(1, getBangkokSevenDayKeys().length)
  const averageCalories = totals.calories / dayCount
  const averageProtein = totals.protein / dayCount
  const averageCarbs = totals.carbs / dayCount
  const averageFat = totals.fat / dayCount
  const calorieGap = input.dailyCalories ? input.dailyCalories - averageCalories : 0

  const options: MealSuggestion[] = [
    {
      id: randomUUID(),
      name: "ข้าวอกไก่ย่าง + ไข่ต้ม",
      calories: 420,
      protein: 34,
      carbs: 42,
      fat: 10,
      reason: averageProtein < 75 ? "ช่วยเพิ่มโปรตีนจากค่าเฉลี่ยช่วง 7 วันที่ยังค่อนข้างต่ำ" : "เป็นมื้อสมดุล กินต่อได้ง่ายและคุมแคลอรี่ได้ดี",
    },
    {
      id: randomUUID(),
      name: "โยเกิร์ตกรีก + กล้วย + อัลมอนด์",
      calories: 280,
      protein: 18,
      carbs: 30,
      fat: 9,
      reason: calorieGap < 250 ? "เหมาะเป็นมื้อเบาระหว่างวันเมื่อไม่อยากเพิ่มแคลอรี่มากเกินไป" : "เติมพลังงานแบบไม่หนักเกินและช่วยให้อิ่มนานขึ้น",
    },
    {
      id: randomUUID(),
      name: "สลัดทูน่า + มันหวาน",
      calories: 360,
      protein: 28,
      carbs: 32,
      fat: 11,
      reason: averageFat > averageCarbs * 0.6 ? "ช่วยบาลานซ์มื้อถัดไปให้เบาขึ้นและได้ใยอาหารเพิ่ม" : "เป็นตัวเลือกที่สมดุลทั้งโปรตีน คาร์บ และไขมัน",
    },
    {
      id: randomUUID(),
      name: "ข้าวกล้องปลาแซลมอน + ผักลวก",
      calories: 490,
      protein: 32,
      carbs: 44,
      fat: 18,
      reason: calorieGap > 350 ? "เหมาะเมื่อพลังงานเฉลี่ยช่วงนี้ยังต่ำกว่าเป้าหมายค่อนข้างมาก" : "ช่วยเติมพลังงานพร้อมไขมันดีและโปรตีนคุณภาพ",
    },
  ]

  return options
    .sort((first, second) => {
      const firstDiff = Math.abs(first.calories - Math.max(280, calorieGap || first.calories))
      const secondDiff = Math.abs(second.calories - Math.max(280, calorieGap || second.calories))
      return firstDiff - secondDiff
    })
    .slice(0, 3)
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
  })().finally(() => {
    if (suggestionJobs.get(userId) === job) suggestionJobs.delete(userId)
  })
  suggestionJobs.set(userId, job)
  return job
}

function refreshSuggestionsInBackground(
  userId: string,
  meals: Awaited<ReturnType<typeof loadRecentMeals>>,
  dailyCalories: number | null,
) {
  if (suggestionJobs.has(userId)) return

  after(async () => {
    try {
      await createAndCacheSuggestionsOnce(userId, meals, dailyCalories)
    } catch (error) {
      console.error("Background meal suggestion refresh failed", error)
    }
  })
}

async function loadRecentMeals(userId: string) {
  const dateKeys = getBangkokSevenDayKeys()
  return prisma.meal.findMany({
    where: { userId, date: { gte: dateKeys[0], lte: dateKeys[6] } },
    orderBy: [{ date: "desc" }, { time: "desc" }],
  })
}

async function handleSuggestions(forceRefresh: boolean) {
  try {
    const user = await requireUser()
    const [meals, cache, settingsRow] = await Promise.all([
      loadRecentMeals(user.id),
      prisma.mealSuggestionCache.findUnique({ where: { userId: user.id } }),
      prisma.userSettings.findUnique({ where: { userId: user.id }, select: { settingsJson: true } }),
    ])

    if (meals.length === 0) {
      return NextResponse.json({
        suggestions: [],
        source: "empty",
        generatedAt: null,
        isStale: false,
      })
    }

    const cachedSuggestions = parseCachedSuggestions(cache?.suggestionsJson)
    const cacheIsFresh = Boolean(cache && isSameBangkokDay(cache.generatedAt, new Date()))
    if (!forceRefresh && cache && cachedSuggestions.length > 0 && cacheIsFresh) {
      return NextResponse.json({
        suggestions: cachedSuggestions,
        source: "cache",
        generatedAt: cache.generatedAt.toISOString(),
        isStale: false,
        refreshing: suggestionJobs.has(user.id),
      })
    }

    const dailyCalories = readDailyCalories(settingsRow?.settingsJson)
    const hasAiConfiguration = Boolean(process.env.QWEN_API_KEY)
    const suggestions = cachedSuggestions.length > 0
      ? cachedSuggestions
      : buildFallbackSuggestions({ meals, dailyCalories })

    if (hasAiConfiguration) {
      refreshSuggestionsInBackground(user.id, meals, dailyCalories)
    }

    return NextResponse.json({
      suggestions,
      source: cachedSuggestions.length > 0 ? (cacheIsFresh ? "cache" : "cache-stale") : "fallback",
      generatedAt: cache?.generatedAt.toISOString() ?? null,
      isStale: cachedSuggestions.length > 0 && !cacheIsFresh,
      refreshing: hasAiConfiguration,
      error: hasAiConfiguration ? undefined : "ยังไม่ได้ตั้งค่า QWEN_API_KEY",
    }, { status: hasAiConfiguration ? 202 : 200 })
  } catch (error) {
    return jsonError(error)
  }
}

export async function GET() {
  return handleSuggestions(false)
}

export async function POST() {
  return handleSuggestions(true)
}
