import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { jsonError } from "@/lib/http"

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 })
    }
    return NextResponse.json({ user })
  } catch (error) {
    return jsonError(error)
  }
}
