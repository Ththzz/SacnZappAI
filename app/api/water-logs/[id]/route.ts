import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { jsonError, readNumber } from "@/lib/http"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const amount = readNumber(body?.amount)

    if (amount <= 0) return NextResponse.json({ error: "ปริมาณน้ำต้องมากกว่า 0" }, { status: 400 })

    const result = await prisma.waterLog.updateMany({
      where: { id, userId: user.id },
      data: { amount },
    })

    if (result.count === 0) return NextResponse.json({ error: "ไม่พบรายการน้ำดื่ม" }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return jsonError(error)
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const result = await prisma.waterLog.deleteMany({ where: { id, userId: user.id } })

    if (result.count === 0) return NextResponse.json({ error: "ไม่พบรายการน้ำดื่ม" }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return jsonError(error)
  }
}
