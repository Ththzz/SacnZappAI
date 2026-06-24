import { NextResponse } from "next/server"
import { createSession, getUserByEmail, verifyPassword } from "@/lib/auth"
import { jsonError, readString } from "@/lib/http"

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const email = readString(body?.email)
    const password = readString(body?.password)

    const result = getUserByEmail(email)
    if (!result || !verifyPassword(password, result.passwordHash)) {
      return NextResponse.json({ error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 })
    }

    await createSession(result.user.id)
    return NextResponse.json({ user: result.user })
  } catch (error) {
    return jsonError(error)
  }
}
