import { NextResponse } from "next/server"
import { canCreateAdmin, createSession, createUser, type UserRole } from "@/lib/auth"
import { jsonError, readString } from "@/lib/http"

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const name = readString(body?.name)
    const email = readString(body?.email)
    const password = readString(body?.password)
    const role = body?.role === "admin" ? "admin" : "user"
    const adminCode = readString(body?.adminCode)

    if (name.length < 2) return NextResponse.json({ error: "กรุณากรอกชื่ออย่างน้อย 2 ตัวอักษร" }, { status: 400 })
    if (!email.includes("@")) return NextResponse.json({ error: "อีเมลไม่ถูกต้อง" }, { status: 400 })
    if (password.length < 8) return NextResponse.json({ error: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" }, { status: 400 })
    if (role === "admin" && !canCreateAdmin(adminCode)) {
      return NextResponse.json({ error: "รหัสสมัครแอดมินไม่ถูกต้อง" }, { status: 403 })
    }

    const result = createUser({ name, email, password, role: role as UserRole })
    if (!result) return NextResponse.json({ error: "สมัครสมาชิกไม่สำเร็จ" }, { status: 500 })

    await createSession(result.user.id)
    return NextResponse.json({ user: result.user }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : ""
    if (message.includes("UNIQUE")) {
      return NextResponse.json({ error: "อีเมลนี้ถูกใช้งานแล้ว" }, { status: 409 })
    }
    return jsonError(error)
  }
}
