import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth"
import { getDb, nowIso } from "@/lib/db"
import { jsonError, readNumber } from "@/lib/http"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const amount = readNumber(body?.amount)

    if (amount <= 0) return NextResponse.json({ error: "ปริมาณน้ำต้องมากกว่า 0" }, { status: 400 })

    const result = getDb()
      .prepare("UPDATE water_logs SET amount = ?, updated_at = ? WHERE id = ? AND user_id = ?")
      .run(amount, nowIso(), id, user.id)

    if (result.changes === 0) return NextResponse.json({ error: "ไม่พบรายการน้ำดื่ม" }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return jsonError(error)
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const result = getDb().prepare("DELETE FROM water_logs WHERE id = ? AND user_id = ?").run(id, user.id)

    if (result.changes === 0) return NextResponse.json({ error: "ไม่พบรายการน้ำดื่ม" }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return jsonError(error)
  }
}
