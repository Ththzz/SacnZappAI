import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { jsonError, readNumber, readString } from "@/lib/http"

export async function GET() {
  try {
    const user = await requireUser()
    const meals = await prisma.meal.findMany({
      where: { userId: user.id },
      orderBy: [{ date: "desc" }, { time: "desc" }, { createdAt: "desc" }],
    })

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
        imageUrl: readString(body?.imageUrl) || null,
      },
    })

    return NextResponse.json({ id }, { status: 201 })
  } catch (error) {
    return jsonError(error)
  }
}
