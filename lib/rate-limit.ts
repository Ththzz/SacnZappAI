import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"

type RateLimitEntry = {
  count: number
  resetAt: number
}

type RateLimitOptions = {
  limit: number
  windowMs: number
}

type RateLimitResult = {
  allowed: boolean
  retryAfterSeconds: number
}

type PostgresRateLimitRow = {
  count: number
  reset_at: Date
}

const globalRateLimits = globalThis as typeof globalThis & {
  scanzappRateLimits?: Map<string, RateLimitEntry>
}

const entries = globalRateLimits.scanzappRateLimits ?? new Map<string, RateLimitEntry>()
globalRateLimits.scanzappRateLimits = entries

export function getClientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  )
}

function checkMemoryRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now()
  const current = entries.get(key)

  if (!current || current.resetAt <= now) {
    entries.set(key, { count: 1, resetAt: now + options.windowMs })
    return { allowed: true, retryAfterSeconds: 0 }
  }

  if (current.count >= options.limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    }
  }

  current.count += 1
  if (entries.size > 5_000) {
    for (const [entryKey, entry] of entries) {
      if (entry.resetAt <= now) entries.delete(entryKey)
    }
  }
  return { allowed: true, retryAfterSeconds: 0 }
}

async function checkPostgresRateLimit(key: string, options: RateLimitOptions): Promise<RateLimitResult> {
  const now = new Date()
  const nextResetAt = new Date(now.getTime() + options.windowMs)
  const rows = await prisma.$queryRaw<PostgresRateLimitRow[]>(Prisma.sql`
    INSERT INTO "rate_limit_buckets" ("key", "count", "reset_at", "updated_at")
    VALUES (${key}, 1, ${nextResetAt}, CURRENT_TIMESTAMP)
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "rate_limit_buckets"."reset_at" <= CURRENT_TIMESTAMP THEN 1
        ELSE "rate_limit_buckets"."count" + 1
      END,
      "reset_at" = CASE
        WHEN "rate_limit_buckets"."reset_at" <= CURRENT_TIMESTAMP THEN EXCLUDED."reset_at"
        ELSE "rate_limit_buckets"."reset_at"
      END,
      "updated_at" = CURRENT_TIMESTAMP
    RETURNING "count", "reset_at"
  `)
  const row = rows[0]
  if (!row) throw new Error("RATE_LIMIT_UPDATE_FAILED")

  if (Math.random() < 0.01) {
    void prisma.rateLimitBucket.deleteMany({
      where: { resetAt: { lt: now } },
    }).catch(() => undefined)
  }

  return {
    allowed: row.count <= options.limit,
    retryAfterSeconds: row.count <= options.limit
      ? 0
      : Math.max(1, Math.ceil((row.reset_at.getTime() - now.getTime()) / 1000)),
  }
}

export async function checkRateLimit(key: string, options: RateLimitOptions) {
  const usePostgres = /^postgres(?:ql)?:\/\//i.test(process.env.DATABASE_URL ?? "")
  return usePostgres
    ? checkPostgresRateLimit(key, options)
    : checkMemoryRateLimit(key, options)
}
