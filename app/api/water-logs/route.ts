import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { jsonError, readNumber, readString } from "@/lib/http"

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
    const rows = await prisma.waterLog.findMany({
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
    const logs = hasMore ? rows.slice(0, limit) : rows

    return NextResponse.json({
      logs,
      nextCursor: hasMore ? logs.at(-1)?.id ?? null : null,
    })
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

    if (amount <= 0) return NextResponse.json({ error: "ปริมาณน้ำต้องมากกว่า 0" }, { status: 400 })

    await prisma.waterLog.create({
      data: {
        id,
        userId: user.id,
        date: readString(body?.date),
        time: readString(body?.time),
        amount,
      },
    })

    return NextResponse.json({ id }, { status: 201 })
  } catch (error) {
    return jsonError(error)
  }
}
