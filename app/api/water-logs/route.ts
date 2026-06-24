import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth"
import { getDb, nowIso } from "@/lib/db"
import { jsonError, readNumber, readString } from "@/lib/http"

export async function GET() {
  try {
    const user = await requireUser()
    const logs = getDb().prepare(`
      SELECT id, date, time, amount, created_at AS createdAt, updated_at AS updatedAt
      FROM water_logs
      WHERE user_id = ?
      ORDER BY date DESC, time DESC, created_at DESC
    `).all(user.id)

    return NextResponse.json({ logs })
  } catch (error) {
    return jsonError(error)
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser()
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const amount = readNumber(body?.amount)
    const id = readString(body?.id) || randomUUID()
    const timestamp = nowIso()

    if (amount <= 0) return NextResponse.json({ error: "ปริมาณน้ำต้องมากกว่า 0" }, { status: 400 })

    getDb().prepare(`
      INSERT INTO water_logs (id, user_id, date, time, amount, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, user.id, readString(body?.date), readString(body?.time), amount, timestamp, timestamp)

    return NextResponse.json({ id }, { status: 201 })
  } catch (error) {
    return jsonError(error)
  }
}
