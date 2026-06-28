import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { prisma } from "@/lib/db"
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
    const [users, admins, meals, mealsToday, waterToday, scans, scanErrors, activeMealUsers, activeWaterUsers, activeScanUsers] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: "admin" } }),
      prisma.meal.count(),
      prisma.meal.count({ where: { date: today } }),
      prisma.waterLog.aggregate({ where: { date: today }, _sum: { amount: true } }),
      prisma.scanResult.count(),
      prisma.scanResult.count({ where: { status: "error" } }),
      prisma.meal.findMany({ where: { createdAt: { gte: since } }, select: { userId: true }, distinct: ["userId"] }),
      prisma.waterLog.findMany({ where: { createdAt: { gte: since } }, select: { userId: true }, distinct: ["userId"] }),
      prisma.scanResult.findMany({ where: { createdAt: { gte: since }, userId: { not: null } }, select: { userId: true }, distinct: ["userId"] }),
    ])
    const activeUsers7d = new Set([
      ...activeMealUsers.map((item) => item.userId),
      ...activeWaterUsers.map((item) => item.userId),
      ...activeScanUsers.flatMap((item) => (item.userId ? [item.userId] : [])),
    ]).size

    return NextResponse.json({
      stats: {
        users,
        admins,
        meals,
        mealsToday,
        waterTodayMl: waterToday._sum.amount ?? 0,
        scans,
        scanErrors,
        activeUsers7d,
      },
    })
  } catch (error) {
    return jsonError(error)
  }
}
