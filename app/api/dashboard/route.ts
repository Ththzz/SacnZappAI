import { NextResponse } from "next/server"

import { requireUser } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { jsonError } from "@/lib/http"

export async function GET() {
  try {
    const user = await requireUser()
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
      prisma.userSettings.findUnique({
        where: { userId: user.id },
        select: { settingsJson: true },
      }),
    ])

    return NextResponse.json({
      meals,
      waterLogs,
      calorieGoal: readCalorieGoal(settingsRow?.settingsJson),
    })
  } catch (error) {
    return jsonError(error)
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
