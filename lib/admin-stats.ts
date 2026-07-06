import { prisma } from "@/lib/db"

export type AdminStats = {
  users: number
  admins: number
  meals: number
  mealsToday: number
  waterTodayMl: number
  scans: number
  scanErrors: number
  activeUsers7d: number
}

type AdminStatsRow = {
  users: bigint | number
  admins: bigint | number
  meals: bigint | number
  mealsToday: bigint | number
  waterTodayMl: bigint | number | null
  scans: bigint | number
  scanErrors: bigint | number
  activeUsers7d: bigint | number
}

export async function getAdminStats(today: string, since: Date): Promise<AdminStats> {
  const rows = await prisma.$queryRaw<AdminStatsRow[]>`
    SELECT
      (SELECT COUNT(*) FROM "users") AS "users",
      (SELECT COUNT(*) FROM "users" WHERE "role" = 'admin') AS "admins",
      (SELECT COUNT(*) FROM "meals") AS "meals",
      (SELECT COUNT(*) FROM "meals" WHERE "date" = ${today}) AS "mealsToday",
      (SELECT COALESCE(SUM("amount"), 0) FROM "water_logs" WHERE "date" = ${today}) AS "waterTodayMl",
      (SELECT COUNT(*) FROM "scan_results") AS "scans",
      (SELECT COUNT(*) FROM "scan_results" WHERE "status" = 'error') AS "scanErrors",
      (
        SELECT COUNT(DISTINCT "user_id")
        FROM (
          SELECT "user_id" FROM "meals" WHERE "created_at" >= ${since}
          UNION ALL
          SELECT "user_id" FROM "water_logs" WHERE "created_at" >= ${since}
          UNION ALL
          SELECT "user_id" FROM "scan_results"
          WHERE "created_at" >= ${since} AND "user_id" IS NOT NULL
        ) AS "active_users"
      ) AS "activeUsers7d"
  `
  const row = rows[0]

  return {
    users: Number(row?.users ?? 0),
    admins: Number(row?.admins ?? 0),
    meals: Number(row?.meals ?? 0),
    mealsToday: Number(row?.mealsToday ?? 0),
    waterTodayMl: Number(row?.waterTodayMl ?? 0),
    scans: Number(row?.scans ?? 0),
    scanErrors: Number(row?.scanErrors ?? 0),
    activeUsers7d: Number(row?.activeUsers7d ?? 0),
  }
}
