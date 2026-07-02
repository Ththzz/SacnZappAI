import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { jsonError, readNumber, readString } from "@/lib/http"
import { isMealCategory } from "@/lib/user-data"

function readLimit(value: string | null, fallback = 200) {
  const parsed = Number(value)
  return Number.isInteger(parsed) ? Math.max(1, Math.min(parsed, 500)) : fallback
}

function readDate(value: string | null) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined
}

export async function GET(request: Request) {
  try {
    const user = await requireUser()
    const { searchParams } = new URL(request.url)
    const limit = readLimit(searchParams.get("limit"))
    const from = readDate(searchParams.get("from"))
    const to = readDate(searchParams.get("to"))
    const cursor = readString(searchParams.get("cursor")) || undefined
    const rows = await prisma.meal.findMany({
      where: {
        userId: user.id,
        date: from || to ? { gte: from, lte: to } : undefined,
      },
      orderBy: [{ date: "desc" }, { time: "desc" }, { createdAt: "desc" }],
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : undefined,
    })
    const hasMore = rows.length > limit
    const meals = hasMore ? rows.slice(0, limit) : rows

    return NextResponse.json({
      meals,
      nextCursor: hasMore ? meals.at(-1)?.id ?? null : null,
    })
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
    const source = body?.source === "manual" ? "manual" : "scan"

    if (!name) return NextResponse.json({ error: "กรุณาระบุชื่ออาหาร" }, { status: 400 })

    await prisma.meal.create({
      data: {
        id,
        userId: user.id,
        name,
        calories: readNumber(body?.calories),
        protein: readNumber(body?.protein),
        carbs: readNumber(body?.carbs),
        fat: readNumber(body?.fat),
        time: readString(body?.time),
        date: readString(body?.date),
        source,
        confidence: body?.confidence === undefined ? null : readNumber(body.confidence),
        note: readString(body?.note) || null,
        mealCategory: isMealCategory(body?.mealCategory) ? body.mealCategory : null,
        imageUrl: readString(body?.imageUrl) || null,
      },
    })

    return NextResponse.json({ id }, { status: 201 })
  } catch (error) {
    return jsonError(error)
  }
}
