import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { jsonError } from "@/lib/http"
import { normalizeSettings, type AppSettings } from "@/lib/settings"

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
    const profile = profileRow
      ? { selectedGoal: profileRow.selectedGoal, form: JSON.parse(profileRow.formJson || "{}") }
      : null
    const settings = normalizeSettings(body?.settings && typeof body.settings === "object" ? body.settings as Partial<AppSettings> : null, profile)
    const settingsJson = JSON.stringify(settings)

    await prisma.userSettings.upsert({
      where: { userId: user.id },
      create: { userId: user.id, settingsJson },
      update: { settingsJson },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return jsonError(error)
  }
}
