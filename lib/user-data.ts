export type MealEntry = {
  id: string
  name: string
  calories: number
  protein: number
  carbs: number
  fat: number
  time: string
  date: string
  source: "scan" | "manual"
  confidence?: number
  note?: string
}

export type WaterLogEntry = {
  id?: string
  date: string
  time: string
  amount: number
}

export const STORAGE_KEYS = {
  meals: "nutriscan.meal.history",
  waterLogs: "nutriscan.water.logs",
  profile: "nutriscan.profile",
} as const

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function isMealEntry(value: unknown): value is MealEntry {
  if (!isRecord(value)) return false

  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    isFiniteNumber(value.calories) &&
    isFiniteNumber(value.protein) &&
    isFiniteNumber(value.carbs) &&
    isFiniteNumber(value.fat) &&
    typeof value.time === "string" &&
    typeof value.date === "string" &&
    (value.source === "scan" || value.source === "manual") &&
    (value.confidence === undefined || isFiniteNumber(value.confidence)) &&
    (value.note === undefined || typeof value.note === "string")
  )
}

function isWaterLogEntry(value: unknown): value is WaterLogEntry {
  if (!isRecord(value)) return false

  return (
    (value.id === undefined || typeof value.id === "string") &&
    typeof value.date === "string" &&
    typeof value.time === "string" &&
    isFiniteNumber(value.amount) &&
    value.amount > 0
  )
}

function normalizeWaterLogEntry(value: unknown): WaterLogEntry | null {
  if (!isRecord(value)) return null
  if (typeof value.time !== "string" || !isFiniteNumber(value.amount) || value.amount <= 0) return null

  return {
    id: typeof value.id === "string" ? value.id : undefined,
    date: typeof value.date === "string" ? value.date : getLocalDateKey(),
    time: value.time,
    amount: value.amount,
  }
}

export function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function readMealEntries(): MealEntry[] {
  if (typeof window === "undefined") return []
  const items = safeParse<unknown>(window.localStorage.getItem(STORAGE_KEYS.meals), [])
  return Array.isArray(items) ? items.filter(isMealEntry) : []
}

export function writeMealEntries(entries: MealEntry[]) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORAGE_KEYS.meals, JSON.stringify(entries))
}

export function addMealEntry(entry: MealEntry) {
  const current = readMealEntries()
  writeMealEntries([entry, ...current])
}

export function readWaterLogs(): WaterLogEntry[] {
  if (typeof window === "undefined") return []
  const items = safeParse<unknown>(window.localStorage.getItem(STORAGE_KEYS.waterLogs), [])
  if (!Array.isArray(items)) return []

  return items.flatMap((item) => {
    if (isWaterLogEntry(item)) return [item]
    const normalized = normalizeWaterLogEntry(item)
    return normalized ? [normalized] : []
  })
}

export function writeWaterLogs(logs: WaterLogEntry[]) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORAGE_KEYS.waterLogs, JSON.stringify(logs))
}
