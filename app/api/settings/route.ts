import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { jsonError } from "@/lib/http"
import { mapGoalModeToProfileGoal, normalizeSettings, type AppSettings } from "@/lib/settings"

export async function GET() {
  try {
    const user = await requireUser()
    const [row, profileRow] = await Promise.all([
      prisma.userSettings.findUnique({ where: { userId: user.id } }),
      prisma.profile.findUnique({ where: { userId: user.id } }),
    ])
    const parsed = row?.settingsJson ? JSON.parse(row.settingsJson) as Partial<AppSettings> : null
    const profile = profileRow
      ? { selectedGoal: profileRow.selectedGoal, form: JSON.parse(profileRow.formJson || "{}") }
      : null
    const settings = normalizeSettings(parsed, profile)

    if (row && row.settingsJson !== JSON.stringify(settings)) {
      await prisma.userSettings.update({
        where: { userId: user.id },
        data: { settingsJson: JSON.stringify(settings) },
      })
    }

    return NextResponse.json({ settings })
  } catch (error) {
    return jsonError(error)
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser()
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const profileRow = await prisma.profile.findUnique({ where: { userId: user.id } })
    const settings = normalizeSettings(
      body?.settings && typeof body.settings === "object" ? body.settings as Partial<AppSettings> : null,
    )
    const settingsJson = JSON.stringify(settings)
    const storedForm = profileRow ? JSON.parse(profileRow.formJson || "{}") as Record<string, unknown> : {}
    const profile = {
      selectedGoal: mapGoalModeToProfileGoal(settings.healthGoal.mode),
      form: {
        name: user.name,
        email: user.email,
        ...storedForm,
        weight: String(settings.healthGoal.currentWeightKg),
        targetWeight: String(settings.healthGoal.targetWeightKg),
        activity: settings.healthGoal.activityLevel,
      },
    }

    await prisma.$transaction(async (transaction) => {
      await transaction.userSettings.upsert({
        where: { userId: user.id },
        create: { userId: user.id, settingsJson },
        update: { settingsJson },
      })
      await transaction.profile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          selectedGoal: profile.selectedGoal,
          formJson: JSON.stringify(profile.form),
        },
        update: {
          selectedGoal: profile.selectedGoal,
          formJson: JSON.stringify(profile.form),
        },
      })
    })

    return NextResponse.json({ ok: true, settings, profile })
  } catch (error) {
    return jsonError(error)
  }
}
