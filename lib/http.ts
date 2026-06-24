import { NextResponse } from "next/server"

export function jsonError(error: unknown) {
  if (error instanceof Response) return error

  const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาด"
  return NextResponse.json({ error: message }, { status: 500 })
}

export function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

export function readNumber(value: unknown, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}
