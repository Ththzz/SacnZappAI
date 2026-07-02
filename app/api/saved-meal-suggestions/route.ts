import { NextResponse } from "next/server"

import { requireUser } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { jsonError, readNumber, readString } from "@/lib/http"

function normalizeName(value: string) {
  return value.trim().toLocaleLowerCase("th-TH").replace(/\s+/g, " ")
}

export async function GET() {
  try {
    const user = await requireUser()
    const suggestions = await prisma.savedMealSuggestion.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json({ suggestions })
  } catch (error) {
    return jsonError(error)
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser()
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const name = readString(body?.name)
    if (!name) return NextResponse.json({ error: "กรุณาระบุชื่อเมนู" }, { status: 400 })

    const normalizedName = normalizeName(name)
    const suggestion = await prisma.savedMealSuggestion.upsert({
      where: {
        userId_normalizedName: {
          userId: user.id,
          normalizedName,
        },
      },
      create: {
        userId: user.id,
        normalizedName,
        name,
        calories: Math.max(0, readNumber(body?.calories)),
        protein: Math.max(0, readNumber(body?.protein)),
        carbs: Math.max(0, readNumber(body?.carbs)),
        fat: Math.max(0, readNumber(body?.fat)),
        reason: readString(body?.reason) || null,
      },
      update: {
        name,
        calories: Math.max(0, readNumber(body?.calories)),
        protein: Math.max(0, readNumber(body?.protein)),
        carbs: Math.max(0, readNumber(body?.carbs)),
        fat: Math.max(0, readNumber(body?.fat)),
        reason: readString(body?.reason) || null,
      },
    })

    return NextResponse.json({ suggestion }, { status: 201 })
  } catch (error) {
    return jsonError(error)
  }
}
