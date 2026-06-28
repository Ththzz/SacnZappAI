import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { jsonError, readNumber, readString } from "@/lib/http"

export async function GET() {
  try {
    const user = await requireUser()
    const logs = await prisma.waterLog.findMany({
      where: { userId: user.id },
      orderBy: [{ date: "desc" }, { time: "desc" }, { createdAt: "desc" }],
    })

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
