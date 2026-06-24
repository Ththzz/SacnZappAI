import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth"
import { getDb, nowIso } from "@/lib/db"
import { jsonError, readString } from "@/lib/http"

export async function GET() {
  try {
    const user = await requireUser()
    const profile = getDb().prepare("SELECT selected_goal AS selectedGoal, form_json AS formJson FROM profiles WHERE user_id = ?").get(user.id) as
      | { selectedGoal?: string; formJson?: string }
      | undefined

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
    const timestamp = nowIso()

    getDb().prepare(`
      INSERT INTO profiles (user_id, selected_goal, form_json, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET selected_goal = excluded.selected_goal, form_json = excluded.form_json, updated_at = excluded.updated_at
    `).run(user.id, selectedGoal, formJson, timestamp)

    return NextResponse.json({ ok: true })
  } catch (error) {
    return jsonError(error)
  }
}
