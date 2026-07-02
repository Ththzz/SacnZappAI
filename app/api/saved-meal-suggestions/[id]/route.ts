import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"

import { requireUser } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { jsonError, readNumber, readString } from "@/lib/http"
import { isMealCategory } from "@/lib/user-data"

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const result = await prisma.savedMealSuggestion.deleteMany({ where: { id, userId: user.id } })
    if (result.count === 0) return NextResponse.json({ error: "ไม่พบเมนูที่บันทึกไว้" }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return jsonError(error)
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const saved = await prisma.savedMealSuggestion.findFirst({ where: { id, userId: user.id } })
    if (!saved) return NextResponse.json({ error: "ไม่พบเมนูที่บันทึกไว้" }, { status: 404 })

    const name = readString(body?.name) || saved.name
    const date = readString(body?.date)
    const time = readString(body?.time)
    const mealCategory = isMealCategory(body?.mealCategory) ? body.mealCategory : null
    if (!date || !time || !mealCategory) {
      return NextResponse.json({ error: "กรุณาระบุวันที่ เวลา และหมวดมื้ออาหาร" }, { status: 400 })
    }

    const mealId = randomUUID()
    const reason = readString(body?.reason) || saved.reason
    const note = reason ? `เพิ่มจากเมนูแนะนำ AI: ${reason}` : "เพิ่มจากเมนูแนะนำ AI"

    await prisma.$transaction([
      prisma.meal.create({
        data: {
          id: mealId,
          userId: user.id,
          name,
          calories: Math.max(0, readNumber(body?.calories, saved.calories)),
          protein: Math.max(0, readNumber(body?.protein, saved.protein)),
          carbs: Math.max(0, readNumber(body?.carbs, saved.carbs)),
          fat: Math.max(0, readNumber(body?.fat, saved.fat)),
          time,
          date,
          source: "manual",
          note,
          mealCategory,
        },
      }),
      prisma.savedMealSuggestion.delete({ where: { id: saved.id } }),
    ])

    return NextResponse.json({ mealId }, { status: 201 })
  } catch (error) {
    return jsonError(error)
  }
}
