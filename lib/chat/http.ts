import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"

export type ChatErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "CONSENT_REQUIRED"
  | "VALIDATION_ERROR"
  | "CONVERSATION_NOT_FOUND"
  | "RATE_LIMITED"
  | "UNSUPPORTED_IMAGE"
  | "PROVIDER_UNAVAILABLE"
  | "GENERATION_STOPPED"
  | "INTERNAL_ERROR"

export class ChatApiError extends Error {
  status: number
  code: ChatErrorCode
  retryable: boolean
  requestId: string

  constructor(
    status: number,
    code: ChatErrorCode,
    message: string,
    options?: { retryable?: boolean; requestId?: string },
  ) {
    super(message)
    this.status = status
    this.code = code
    this.retryable = options?.retryable ?? false
    this.requestId = options?.requestId ?? randomUUID()
  }
}

export function getRequestId(request: Request) {
  return request.headers.get("x-request-id")?.trim() || randomUUID()
}

export function chatError(status: number, code: ChatErrorCode, message: string, requestId: string, retryable = false) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        requestId,
        retryable,
      },
    },
    { status },
  )
}

export function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null
}

export function normalizeCursor(value: string | null) {
  const cursor = value?.trim()
  return cursor ? cursor : null
}

export function normalizeLimit(value: string | null, fallback: number, max: number) {
  if (!value?.trim()) {
    return Math.max(1, Math.min(Math.trunc(fallback), max))
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(1, Math.min(Math.trunc(parsed), max))
}

export function parseJsonBody(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null
}

export function chatJsonError(error: unknown, requestId: string) {
  if (error instanceof ChatApiError) {
    return chatError(error.status, error.code, error.message, error.requestId || requestId, error.retryable)
  }

  if (error instanceof Response) {
    if (error.status === 401) {
      return chatError(401, "UNAUTHENTICATED", "กรุณาเข้าสู่ระบบ", requestId)
    }

    if (error.status === 403) {
      return chatError(403, "FORBIDDEN", "คุณไม่มีสิทธิ์ทำรายการนี้", requestId)
    }

    return error
  }

  const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาดภายในระบบ"
  return chatError(500, "INTERNAL_ERROR", message, requestId)
}
