import { NextResponse } from "next/server"
import { createSession, getUserByEmail, verifyPassword } from "@/lib/auth"
import { jsonError, readString } from "@/lib/http"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"

export async function POST(request: Request) {
  try {
    const rateLimit = await checkRateLimit(`auth:sign-in:${getClientIp(request)}`, {
      limit: 10,
      windowMs: 15 * 60 * 1000,
    })
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "ลองเข้าสู่ระบบหลายครั้งเกินไป กรุณารอสักครู่" },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
      )
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const email = readString(body?.email)
    const password = readString(body?.password)

    const result = await getUserByEmail(email)
    if (!result || !(await verifyPassword(password, result.passwordHash))) {
      return NextResponse.json({ error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 })
    }

    await createSession(result.user.id)
    return NextResponse.json({ user: result.user })
  } catch (error) {
    return jsonError(error)
  }
}
