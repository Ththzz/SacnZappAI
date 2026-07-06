import { NextResponse } from "next/server"

import { requireUser } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { jsonError } from "@/lib/http"
import { normalizeSettings, type AppSettings } from "@/lib/settings"

export async function GET(request: Request) {
  try {
    const user = await requireUser()
    const { searchParams } = new URL(request.url)
    const from = readDate(searchParams.get("from"))
    const to = readDate(searchParams.get("to"))

    const [meals, waterLogs, settingsRow, profileRow, savedSuggestions] = await Promise.all([
      prisma.meal.findMany({
        where: {
          userId: user.id,
          date: from || to ? { gte: from, lte: to } : undefined,
        },
        orderBy: [{ date: "desc" }, { time: "desc" }, { createdAt: "desc" }],
        take: 500,
      }),
      prisma.waterLog.findMany({
        where: {
          userId: user.id,
          date: from || to ? { gte: from, lte: to } : undefined,
        },
        orderBy: [{ date: "desc" }, { time: "desc" }, { createdAt: "desc" }],
        take: 500,
      }),
      prisma.userSettings.findUnique({ where: { userId: user.id } }),
      prisma.profile.findUnique({ where: { userId: user.id } }),
      prisma.savedMealSuggestion.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      }),
    ])

    const parsedSettings = settingsRow?.settingsJson
      ? JSON.parse(settingsRow.settingsJson) as Partial<AppSettings>
      : null
    const profile = profileRow
      ? {
          selectedGoal: profileRow.selectedGoal,
          form: JSON.parse(profileRow.formJson || "{}"),
        }
      : null

    return NextResponse.json({
      meals,
      waterLogs,
      settings: normalizeSettings(parsedSettings, profile),
      savedSuggestions,
    })
  } catch (error) {
    return jsonError(error)
  }
}

function readDate(value: string | null) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined
}
