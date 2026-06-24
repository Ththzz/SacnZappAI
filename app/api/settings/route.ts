import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth"
import { getDb, nowIso } from "@/lib/db"
import { jsonError } from "@/lib/http"

export async function GET() {
  try {
    const user = await requireUser()
    const row = getDb().prepare("SELECT settings_json AS settingsJson FROM user_settings WHERE user_id = ?").get(user.id) as
      | { settingsJson?: string }
      | undefined

    return NextResponse.json({ settings: row?.settingsJson ? JSON.parse(row.settingsJson) : null })
  } catch (error) {
    return jsonError(error)
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser()
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const settingsJson = JSON.stringify(body?.settings && typeof body.settings === "object" ? body.settings : {})
    const timestamp = nowIso()

    getDb().prepare(`
      INSERT INTO user_settings (user_id, settings_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET settings_json = excluded.settings_json, updated_at = excluded.updated_at
    `).run(user.id, settingsJson, timestamp)

    return NextResponse.json({ ok: true })
  } catch (error) {
    return jsonError(error)
  }
}
