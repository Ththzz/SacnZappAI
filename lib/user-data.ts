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

export function readMealEntries(): MealEntry[] {
  if (typeof window === "undefined") return []
  const items = safeParse<MealEntry[]>(window.localStorage.getItem(STORAGE_KEYS.meals), [])
  return Array.isArray(items) ? items : []
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
  const items = safeParse<WaterLogEntry[]>(window.localStorage.getItem(STORAGE_KEYS.waterLogs), [])
  return Array.isArray(items) ? items : []
}

export function writeWaterLogs(logs: WaterLogEntry[]) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORAGE_KEYS.waterLogs, JSON.stringify(logs))
}
