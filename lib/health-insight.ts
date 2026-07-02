import { getLocalDateKey, type MealEntry } from "@/lib/user-data"

export type TrendStatus = "good" | "over" | "empty"

export type CalorieTrendPoint = {
  date: string
  day: string
  calories: number
  status: TrendStatus
}

export type MacroBalanceItem = {
  label: string
  value: string
}

export const defaultMacroBalance: MacroBalanceItem[] = [
  { label: "คาร์บ", value: "0%" },
  { label: "โปรตีน", value: "0%" },
  { label: "ไขมัน", value: "0%" },
]

export function getSevenDayDateKeys(today = new Date()) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today)
    date.setHours(12, 0, 0, 0)
    date.setDate(today.getDate() - (6 - index))
    return getLocalDateKey(date)
  })
}

export function buildCalorieTrend(
  meals: MealEntry[],
  calorieGoal: number | null,
  today = new Date(),
): CalorieTrendPoint[] {
  const byDate = new Map<string, number>()
  meals.forEach((meal) => {
    byDate.set(meal.date, (byDate.get(meal.date) ?? 0) + meal.calories)
  })
  const dayLabels = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"]

  return getSevenDayDateKeys(today).map((dateKey) => {
    const calories = byDate.get(dateKey) ?? 0
    const day = new Date(`${dateKey}T12:00:00`).getDay()
    return {
      date: dateKey,
      day: dayLabels[day],
      calories,
      status: calories === 0 ? "empty" : calorieGoal && calories > calorieGoal ? "over" : "good",
    }
  })
}

export function buildMacroBalance(meals: MealEntry[]): MacroBalanceItem[] {
  const proteinCalories = meals.reduce((sum, meal) => sum + meal.protein * 4, 0)
  const carbCalories = meals.reduce((sum, meal) => sum + meal.carbs * 4, 0)
  const fatCalories = meals.reduce((sum, meal) => sum + meal.fat * 9, 0)
  const total = proteinCalories + carbCalories + fatCalories
  if (total <= 0) return defaultMacroBalance

  return [
    { label: "คาร์บ", value: `${Math.round((carbCalories / total) * 100)}%` },
    { label: "โปรตีน", value: `${Math.round((proteinCalories / total) * 100)}%` },
    { label: "ไขมัน", value: `${Math.round((fatCalories / total) * 100)}%` },
  ]
}
