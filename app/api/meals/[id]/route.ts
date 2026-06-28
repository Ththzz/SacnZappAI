import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { jsonError, readNumber, readString } from "@/lib/http"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const current = await prisma.meal.findFirst({ where: { id, userId: user.id }, select: { id: true } })

    if (!current) return NextResponse.json({ error: "ไม่พบรายการอาหาร" }, { status: 404 })

    const name = readString(body?.name)
    if (!name) return NextResponse.json({ error: "กรุณาระบุชื่ออาหาร" }, { status: 400 })

    await prisma.meal.update({
      where: { id },
      data: {
        name,
        calories: readNumber(body?.calories),
        protein: readNumber(body?.protein),
        carbs: readNumber(body?.carbs),
        fat: readNumber(body?.fat),
        time: readString(body?.time),
        date: readString(body?.date),
        source: body?.source === "manual" ? "manual" : "scan",
        confidence: body?.confidence === undefined ? null : readNumber(body.confidence),
        note: readString(body?.note) || null,
        imageUrl: readString(body?.imageUrl) || null,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return jsonError(error)
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const result = await prisma.meal.deleteMany({ where: { id, userId: user.id } })

    if (result.count === 0) return NextResponse.json({ error: "ไม่พบรายการอาหาร" }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return jsonError(error)
  }
}
