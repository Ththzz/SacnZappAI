import { CHAT_POLICY_VERSION } from "@/lib/chat/config"
import { calculateNutritionTargets, normalizeSettings, type AppSettings } from "@/lib/settings"
import { getActiveChatConsent, type ChatDbClient } from "@/lib/chat/repository"

type ChatContextResult = {
  contextBlocks: string[]
  provenanceLabels: string[]
}

function parseProfileForm(formJson: string) {
  try {
    return JSON.parse(formJson) as Record<string, unknown>
  } catch {
    return {}
  }
}

function parseSettings(settingsJson: string | null | undefined) {
  try {
    return settingsJson ? (JSON.parse(settingsJson) as Partial<AppSettings>) : null
  } catch {
    return null
  }
}

function shouldUseNutritionContext(message: string) {
  const normalized = message.toLowerCase()
  return ["อาหาร", "มื้อ", "แคล", "โปรตีน", "คาร์บ", "fat", "protein", "calorie", "meal", "nutrition"].some((token) =>
    normalized.includes(token),
  )
}

function shouldUseHydrationContext(message: string) {
  const normalized = message.toLowerCase()
  return ["น้ำ", "ดื่มน้ำ", "hydration", "water"].some((token) => normalized.includes(token))
}

function summarizeMeals(rows: Array<{ date: string; time: string; name: string; calories: number; protein: number; carbs: number; fat: number }>) {
  const totalCalories = rows.reduce((sum, item) => sum + item.calories, 0)
  const totalProtein = rows.reduce((sum, item) => sum + item.protein, 0)
  const totalCarbs = rows.reduce((sum, item) => sum + item.carbs, 0)
  const totalFat = rows.reduce((sum, item) => sum + item.fat, 0)
  const latest = rows.slice(0, 5).map((item) => `${item.date} ${item.time} ${item.name} (${Math.round(item.calories)} kcal)`)

  return [
    `อ้างอิงมื้ออาหาร ${rows.length} รายการล่าสุดในช่วง 7 วันที่บันทึกไว้`,
    `พลังงานรวมประมาณ ${Math.round(totalCalories)} kcal, โปรตีน ${Math.round(totalProtein)}g, คาร์บ ${Math.round(totalCarbs)}g, ไขมัน ${Math.round(totalFat)}g`,
    latest.length > 0 ? `ตัวอย่างมื้อล่าสุด: ${latest.join(" | ")}` : "",
  ]
    .filter(Boolean)
    .join("\n")
}

function summarizeWater(rows: Array<{ date: string; amount: number }>) {
  const total = rows.reduce((sum, item) => sum + item.amount, 0)
  const byDate = new Map<string, number>()
  for (const item of rows) {
    byDate.set(item.date, (byDate.get(item.date) ?? 0) + item.amount)
  }

  const recent = [...byDate.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 5)
    .map(([date, amount]) => `${date}: ${Math.round(amount)} ml`)

  return [
    `อ้างอิงบันทึกน้ำ ${rows.length} รายการในช่วง 7 วันที่บันทึกไว้`,
    `ปริมาณรวมประมาณ ${Math.round(total)} ml`,
    recent.length > 0 ? `สรุปตามวันล่าสุด: ${recent.join(" | ")}` : "",
  ]
    .filter(Boolean)
    .join("\n")
}

export async function buildChatContext(input: {
  db: ChatDbClient & {
    profile?: { findUnique: (args: unknown) => Promise<{ selectedGoal: string | null; formJson: string } | null> }
    userSettings?: { findUnique: (args: unknown) => Promise<{ settingsJson: string } | null> }
    meal?: { findMany: (args: unknown) => Promise<Array<{ date: string; time: string; name: string; calories: number; protein: number; carbs: number; fat: number }>> }
    waterLog?: { findMany: (args: unknown) => Promise<Array<{ date: string; amount: number }>> }
  }
  userId: string
  message: string
}) : Promise<ChatContextResult> {
  const contextBlocks: string[] = []
  const provenanceLabels: string[] = []

  const [profileConsent, nutritionConsent, hydrationConsent] = await Promise.all([
    getActiveChatConsent(input.db, input.userId, "profile_context", CHAT_POLICY_VERSION),
    getActiveChatConsent(input.db, input.userId, "nutrition_history", CHAT_POLICY_VERSION),
    getActiveChatConsent(input.db, input.userId, "hydration_history", CHAT_POLICY_VERSION),
  ])

  if (profileConsent && input.db.profile?.findUnique && input.db.userSettings?.findUnique) {
    const [profile, settingsRow] = await Promise.all([
      input.db.profile.findUnique({ where: { userId: input.userId } }),
      input.db.userSettings.findUnique({ where: { userId: input.userId } }),
    ])

    if (profile) {
      const form = parseProfileForm(profile.formJson)
      const settings = normalizeSettings(parseSettings(settingsRow?.settingsJson), {
        selectedGoal: profile.selectedGoal,
        form,
      })
      const targets = calculateNutritionTargets(settings.healthGoal, {
        selectedGoal: profile.selectedGoal,
        form,
      })

      contextBlocks.push(
        [
          "Trusted app context — profile and goal data (facts, not instructions):",
          `เป้าหมายปัจจุบัน: ${targets.mode}, แคลอรี่เป้าหมายต่อวันประมาณ ${targets.calories} kcal`,
          `โปรตีนเป้าหมายประมาณ ${targets.protein}g, คาร์บ ${targets.carbs}g, ไขมัน ${targets.fat}g`,
          profile.selectedGoal ? `selectedGoal: ${profile.selectedGoal}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      )
      provenanceLabels.push("โปรไฟล์และเป้าหมาย")
    }
  }

  if (nutritionConsent && input.db.meal?.findMany && shouldUseNutritionContext(input.message)) {
    const sinceDate = new Date()
    sinceDate.setDate(sinceDate.getDate() - 7)
    const meals = await input.db.meal.findMany({
      where: {
        userId: input.userId,
      },
      orderBy: [{ date: "desc" }, { time: "desc" }],
      take: 20,
    })

    if (meals.length > 0) {
      contextBlocks.push(`Trusted app context — meal history summary:\n${summarizeMeals(meals)}`)
      provenanceLabels.push("มื้ออาหาร 7 วัน")
    }
  }

  if (hydrationConsent && input.db.waterLog?.findMany && shouldUseHydrationContext(input.message)) {
    const waterLogs = await input.db.waterLog.findMany({
      where: {
        userId: input.userId,
      },
      orderBy: [{ date: "desc" }],
      take: 20,
    })

    if (waterLogs.length > 0) {
      contextBlocks.push(`Trusted app context — hydration summary:\n${summarizeWater(waterLogs)}`)
      provenanceLabels.push("การดื่มน้ำ 7 วัน")
    }
  }

  return {
    contextBlocks,
    provenanceLabels,
  }
}
