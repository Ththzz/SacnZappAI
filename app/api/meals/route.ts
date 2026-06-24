import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth"
import { getDb, nowIso } from "@/lib/db"
import { jsonError, readNumber, readString } from "@/lib/http"

export async function GET() {
  try {
    const user = await requireUser()
    const meals = getDb().prepare(`
      SELECT id, name, calories, protein, carbs, fat, time, date, source, confidence, note, image_url AS imageUrl, created_at AS createdAt, updated_at AS updatedAt
      FROM meals
      WHERE user_id = ?
      ORDER BY date DESC, time DESC, created_at DESC
    `).all(user.id)

    return NextResponse.json({ meals })
  } catch (error) {
    return jsonError(error)
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser()
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const id = readString(body?.id) || randomUUID()
    const name = readString(body?.name)
    const timestamp = nowIso()
    const source = body?.source === "manual" ? "manual" : "scan"

    if (!name) return NextResponse.json({ error: "กรุณาระบุชื่ออาหาร" }, { status: 400 })

    getDb().prepare(`
      INSERT INTO meals (id, user_id, name, calories, protein, carbs, fat, time, date, source, confidence, note, image_url, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      user.id,
      name,
      readNumber(body?.calories),
      readNumber(body?.protein),
      readNumber(body?.carbs),
      readNumber(body?.fat),
      readString(body?.time),
      readString(body?.date),
      source,
      body?.confidence === undefined ? null : readNumber(body.confidence),
      readString(body?.note) || null,
      readString(body?.imageUrl) || null,
      timestamp,
      timestamp,
    )

    return NextResponse.json({ id }, { status: 201 })
  } catch (error) {
    return jsonError(error)
  }
}
