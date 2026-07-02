type RateLimitEntry = {
  count: number
  resetAt: number
}

type RateLimitOptions = {
  limit: number
  windowMs: number
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

export function checkRateLimit(key: string, options: RateLimitOptions) {
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
