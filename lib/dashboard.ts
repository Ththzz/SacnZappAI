import { prisma } from "@/lib/db"
import type { MealEntry, WaterLogEntry } from "@/lib/user-data"

export type DashboardData = {
  meals: MealEntry[]
  waterLogs: WaterLogEntry[]
  calorieGoal: number | null
}

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const [meals, waterLogs, settingsRow] = await Promise.all([
    prisma.meal.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        calories: true,
        protein: true,
        carbs: true,
        fat: true,
        time: true,
        date: true,
        source: true,
        confidence: true,
        note: true,
        mealCategory: true,
      },
      orderBy: [{ date: "desc" }, { time: "desc" }, { createdAt: "desc" }],
      take: 100,
    }),
    prisma.waterLog.findMany({
      where: { userId },
      select: { id: true, date: true, time: true, amount: true },
      orderBy: [{ date: "desc" }, { time: "desc" }, { createdAt: "desc" }],
      take: 100,
    }),
    prisma.userSettings.findUnique({
      where: { userId },
      select: { settingsJson: true },
    }),
  ])

  return {
    meals: meals.map((meal) => ({
      ...meal,
      confidence: meal.confidence ?? undefined,
      note: meal.note ?? undefined,
    })),
    waterLogs,
    calorieGoal: readCalorieGoal(settingsRow?.settingsJson),
  }
}

function readCalorieGoal(settingsJson?: string | null) {
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
