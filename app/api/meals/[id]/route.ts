import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth"
import { getDb } from "@/lib/db"
import { jsonError } from "@/lib/http"

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const result = getDb().prepare("DELETE FROM meals WHERE id = ? AND user_id = ?").run(id, user.id)

    if (result.changes === 0) return NextResponse.json({ error: "ไม่พบรายการอาหาร" }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return jsonError(error)
  }
}
