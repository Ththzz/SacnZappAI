import { pbkdf2Sync, randomBytes, randomUUID, timingSafeEqual, createHash } from "node:crypto"
import { cookies } from "next/headers"
import { prisma } from "@/lib/db"

export type UserRole = "user" | "admin"

export type AuthUser = {
  id: string
  name: string
  email: string
  role: UserRole
  createdAt: string
}

type UserRecord = {
  id: string
  name: string
  email: string
  passwordHash: string
  role: UserRole
  createdAt: Date
}

export const sessionCookieName = "scanzapp_session"

const passwordIterations = 210_000
const sessionDays = 30

function toUser(row: UserRecord): AuthUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    createdAt: row.createdAt.toISOString(),
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

export async function createUser(input: { name: string; email: string; password: string; role: UserRole }) {
  const email = normalizeEmail(input.email)

  const user = await prisma.user.create({
    data: {
      id: randomUUID(),
      name: input.name.trim(),
      email,
      passwordHash: hashPassword(input.password),
      role: input.role,
    },
  })

  return { user: toUser(user), passwordHash: user.passwordHash }
}

export async function getUserByEmail(email: string) {
  const row = await prisma.user.findUnique({
    where: { email: normalizeEmail(email) },
  })

  return row ? { user: toUser(row), passwordHash: row.passwordHash } : null
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url")
  const expiresAt = new Date(Date.now() + sessionDays * 24 * 60 * 60 * 1000)

  await prisma.session.create({
    data: {
      id: randomUUID(),
      userId,
      tokenHash: hashToken(token),
      expiresAt,
    },
  })

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
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } })
  }

  cookieStore.delete(sessionCookieName)
}

export async function getCurrentUser() {
  const token = (await cookies()).get(sessionCookieName)?.value
  if (!token) return null

  const row = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  })

  if (!row) return null

  if (row.expiresAt.getTime() <= Date.now()) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } })
    return null
  }

  return toUser(row.user)
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
