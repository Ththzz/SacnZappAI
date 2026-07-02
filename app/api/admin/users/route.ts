import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { jsonError } from "@/lib/http"

export async function GET(request: Request) {
  try {
    await requireAdmin()
    const { searchParams } = new URL(request.url)
    const parsedLimit = Number(searchParams.get("limit"))
    const limit = Number.isInteger(parsedLimit) ? Math.max(1, Math.min(parsedLimit, 100)) : 50
    const cursor = searchParams.get("cursor")?.trim() || undefined
    const rows = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : undefined,
    })
    const hasMore = rows.length > limit
    const users = hasMore ? rows.slice(0, limit) : rows

    return NextResponse.json({
      users,
      nextCursor: hasMore ? users.at(-1)?.id ?? null : null,
    })
  } catch (error) {
    return jsonError(error)
  }
}
