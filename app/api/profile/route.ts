import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { jsonError, readString } from "@/lib/http"
import { normalizeSettings, type AppSettings } from "@/lib/settings"

export async function GET() {
  try {
    const user = await requireUser()
    const profile = await prisma.profile.findUnique({ where: { userId: user.id } })

    return NextResponse.json({
      profile: profile
        ? { selectedGoal: profile.selectedGoal, form: JSON.parse(profile.formJson || "{}") }
        : { selectedGoal: undefined, form: { name: user.name, email: user.email } },
    })
  } catch (error) {
    return jsonError(error)
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser()
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const selectedGoal = readString(body?.selectedGoal) || null
    const formJson = JSON.stringify(body?.form && typeof body.form === "object" ? body.form : {})

    await prisma.profile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, selectedGoal, formJson },
      update: { selectedGoal, formJson },
    })

    const settingsRow = await prisma.userSettings.findUnique({ where: { userId: user.id } })
    const parsedSettings = settingsRow?.settingsJson ? JSON.parse(settingsRow.settingsJson) as Partial<AppSettings> : null
    const settings = normalizeSettings(parsedSettings, {
      selectedGoal,
      form: body?.form && typeof body.form === "object" ? body.form : {},
    })

    await prisma.userSettings.upsert({
      where: { userId: user.id },
      create: { userId: user.id, settingsJson: JSON.stringify(settings) },
      update: { settingsJson: JSON.stringify(settings) },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return jsonError(error)
  }
}
