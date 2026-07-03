import { NextResponse } from "next/server"
import { createSession, createUser } from "@/lib/auth"
import { isUniqueConstraintError, jsonError, readString } from "@/lib/http"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"

export async function POST(request: Request) {
  try {
    const rateLimit = await checkRateLimit(`auth:sign-up:${getClientIp(request)}`, {
      limit: 5,
      windowMs: 60 * 60 * 1000,
    })
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "สมัครบัญชีหลายครั้งเกินไป กรุณาลองใหม่ภายหลัง" },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
      )
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const name = readString(body?.name)
    const email = readString(body?.email)
    const password = readString(body?.password)

    if (name.length < 2) return NextResponse.json({ error: "กรุณากรอกชื่ออย่างน้อย 2 ตัวอักษร" }, { status: 400 })
    if (!email.includes("@")) return NextResponse.json({ error: "อีเมลไม่ถูกต้อง" }, { status: 400 })
    if (password.length < 8) return NextResponse.json({ error: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" }, { status: 400 })

    const result = await createUser({ name, email, password, role: "user" })
    if (!result) return NextResponse.json({ error: "สมัครสมาชิกไม่สำเร็จ" }, { status: 500 })

    await createSession(result.user.id)
    return NextResponse.json({ user: result.user }, { status: 201 })
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ error: "อีเมลนี้ถูกใช้งานแล้ว" }, { status: 409 })
    }
    return jsonError(error)
  }
}
