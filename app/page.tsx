import { redirect } from "next/navigation"

import General from "@/components/Cards/General"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/db"

const HomePage = async () => {
  const user = await getCurrentUser()
  if (!user) redirect("/sign-in")

  const [meals, waterLogs, settingsRow] = await Promise.all([
    prisma.meal.findMany({
      where: { userId: user.id },
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
      where: { userId: user.id },
      select: { id: true, date: true, time: true, amount: true },
      orderBy: [{ date: "desc" }, { time: "desc" }, { createdAt: "desc" }],
      take: 100,
    }),
    prisma.userSettings.findUnique({ where: { userId: user.id }, select: { settingsJson: true } }),
  ])

  let calorieGoal: number | null = null
  try {
    const settings = settingsRow?.settingsJson
      ? JSON.parse(settingsRow.settingsJson) as { healthGoal?: { dailyCalories?: number } }
      : null
    const value = Number(settings?.healthGoal?.dailyCalories)
    calorieGoal = Number.isFinite(value) && value > 0 ? Math.round(value) : null
  } catch {
    calorieGoal = null
  }

  const dashboardMeals = meals.map((meal) => ({
    ...meal,
    confidence: meal.confidence ?? undefined,
    note: meal.note ?? undefined,
  }))

  return <General meals={dashboardMeals} waterLogs={waterLogs} calorieGoal={calorieGoal} />
}

export default HomePage
