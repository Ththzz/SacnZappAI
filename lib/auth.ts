import { pbkdf2Sync, randomBytes, randomUUID, timingSafeEqual, createHash } from "node:crypto"
import { cookies } from "next/headers"
import { getDb, nowIso } from "@/lib/db"

export type UserRole = "user" | "admin"

export type AuthUser = {
  id: string
  name: string
  email: string
  role: UserRole
  createdAt: string
}

type UserRow = {
  id: string
  name: string
  email: string
  password_hash: string
  role: UserRole
  created_at: string
}

type SessionUserRow = UserRow & {
  expires_at: string
}

export const sessionCookieName = "scanzapp_session"

const passwordIterations = 210_000
const sessionDays = 30

function toUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    createdAt: row.created_at,
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex")
  const hash = pbkdf2Sync(password, salt, passwordIterations, 32, "sha256").toString("hex")
  return `pbkdf2$${passwordIterations}$${salt}$${hash}`
}

export function verifyPassword(password: string, stored: string) {
  const [scheme, iterationsRaw, salt, expected] = stored.split("$")
  if (scheme !== "pbkdf2" || !iterationsRaw || !salt || !expected) return false

  const iterations = Number(iterationsRaw)
  if (!Number.isInteger(iterations) || iterations < 1) return false

  const actual = pbkdf2Sync(password, salt, iterations, 32, "sha256")
  const expectedBuffer = Buffer.from(expected, "hex")
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer)
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

export function createUser(input: { name: string; email: string; password: string; role: UserRole }) {
  const db = getDb()
  const id = randomUUID()
  const timestamp = nowIso()
  const email = normalizeEmail(input.email)

  db.prepare(`
    INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, input.name.trim(), email, hashPassword(input.password), input.role, timestamp, timestamp)

  return getUserByEmail(email)
}

export function getUserByEmail(email: string) {
  const row = getDb()
    .prepare("SELECT id, name, email, password_hash, role, created_at FROM users WHERE email = ?")
    .get(normalizeEmail(email)) as UserRow | undefined

  return row ? { user: toUser(row), passwordHash: row.password_hash } : null
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url")
  const timestamp = nowIso()
  const expiresAt = new Date(Date.now() + sessionDays * 24 * 60 * 60 * 1000)

  getDb().prepare(`
    INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(randomUUID(), userId, hashToken(token), expiresAt.toISOString(), timestamp)

  const cookieStore = await cookies()
  cookieStore.set(sessionCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  })
}

export async function destroySession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(sessionCookieName)?.value

  if (token) {
    getDb().prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token))
  }

  cookieStore.delete(sessionCookieName)
}

export async function getCurrentUser() {
  const token = (await cookies()).get(sessionCookieName)?.value
  if (!token) return null

  const row = getDb().prepare(`
    SELECT users.id, users.name, users.email, users.password_hash, users.role, users.created_at, sessions.expires_at
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ?
  `).get(hashToken(token)) as SessionUserRow | undefined

  if (!row) return null

  if (Date.parse(row.expires_at) <= Date.now()) {
    getDb().prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token))
    return null
  }

  return toUser(row)
}

export async function requireUser() {
  const user = await getCurrentUser()
  if (!user) {
    throw new Response(JSON.stringify({ error: "กรุณาเข้าสู่ระบบ" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }
  return user
}

export async function requireAdmin() {
  const user = await requireUser()
  if (user.role !== "admin") {
    throw new Response(JSON.stringify({ error: "ต้องใช้สิทธิ์แอดมิน" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    })
  }
  return user
}

export function canCreateAdmin(adminCode?: string) {
  const expected = process.env.ADMIN_SIGNUP_CODE?.trim()
  return !expected || adminCode === expected
}
