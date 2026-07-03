import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET() {
  const startedAt = Date.now()

  try {
    await prisma.$queryRaw`SELECT 1`

    return NextResponse.json(
      {
        status: "ok",
        database: "ok",
        aiConfigured: Boolean(process.env.QWEN_API_KEY?.trim()),
        responseTimeMs: Date.now() - startedAt,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    )
  } catch {
    return NextResponse.json(
      {
        status: "error",
        database: "unavailable",
        aiConfigured: Boolean(process.env.QWEN_API_KEY?.trim()),
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    )
  }
}
