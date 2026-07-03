import { NextResponse } from "next/server"

export function jsonError(error: unknown) {
  if (error instanceof Response) return error

  if (process.env.NODE_ENV === "production") {
    console.error("[api]", error)
    return NextResponse.json({ error: "เกิดข้อผิดพลาดภายในระบบ" }, { status: 500 })
  }

  const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาด"
  return NextResponse.json({ error: message }, { status: 500 })
}

export function isUniqueConstraintError(error: unknown) {
  if (!error || typeof error !== "object") return false
  const code = "code" in error ? String(error.code) : ""
  const message = error instanceof Error ? error.message : ""
  return code === "P2002" || message.includes("UNIQUE")
}

export function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

export function readNumber(value: unknown, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}
