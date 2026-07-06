import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { getAdminStats } from "@/lib/admin-stats"
import { jsonError } from "@/lib/http"

const todayKey = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export async function GET() {
  try {
    await requireAdmin()
    const today = todayKey()
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const stats = await getAdminStats(today, since)

    return NextResponse.json({ stats })
  } catch (error) {
    return jsonError(error)
  }
}
