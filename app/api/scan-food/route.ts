import { NextResponse } from "next/server"

import { requireUser } from "@/lib/auth"
import { analyzeFoodImage, MAX_FOOD_IMAGE_BYTES, parseFoodImageDataUrl } from "@/lib/ai/food-analysis"
import { AiProviderError, defaultAiModel } from "@/lib/ai/provider"
import { prisma } from "@/lib/db"
import { jsonError } from "@/lib/http"
import { checkRateLimit } from "@/lib/rate-limit"
import { readJsonBodyWithLimit } from "@/lib/request-body"

const isDevelopment = process.env.NODE_ENV === "development"
const maxRequestBodyBytes = Math.ceil((MAX_FOOD_IMAGE_BYTES * 4) / 3) + 1024

export const maxDuration = 90

function logScanFoodDebug(message: string, details?: Record<string, unknown>) {
  if (!isDevelopment) return
  console.info("[scan-food]", message, details ?? "")
}

async function recordScanResult(input: {
  userId?: string | null
  model: string
  status: "success" | "error"
  isFood?: boolean | null
  confidence?: number | null
  latencyMs: number
  upstreamStatus?: number | null
  errorMessage?: string | null
  rawPreview?: string | null
}) {
  try {
    await prisma.scanResult.create({
      data: {
        userId: input.userId ?? null,
        model: input.model,
        status: input.status,
        isFood: input.isFood ?? null,
        confidence: input.confidence ?? null,
        latencyMs: input.latencyMs,
        upstreamStatus: input.upstreamStatus ?? null,
        errorMessage: input.errorMessage ?? null,
        rawPreview: input.rawPreview ?? null,
      },
    })
  } catch (error) {
    logScanFoodDebug("Failed to record scan result", { error: String(error) })
  }
}

function isBusyModelMessage(message?: string) {
  if (!message) return false

  const normalized = message.toLowerCase()
  return (
    normalized.includes("high demand") ||
    normalized.includes("try again later") ||
    normalized.includes("overloaded") ||
    normalized.includes("rate limit") ||
    normalized.includes("temporarily unavailable") ||
    normalized.includes("unavailable")
  )
}

function friendlyModelError(message: string | undefined, model: string) {
  const normalized = message?.trimStart().toLowerCase() ?? ""
  const isHtmlResponse =
    normalized.startsWith("<!doctype html") ||
    normalized.startsWith("<html") ||
    normalized.includes("<html") ||
    normalized.includes("cloudflare")

  if (isHtmlResponse) {
    return "บริการวิเคราะห์อาหารขัดข้องชั่วคราว กรุณารอสักครู่แล้วลองสแกนใหม่อีกครั้ง"
  }

  if (isBusyModelMessage(message)) {
    return `ระบบวิเคราะห์ด้วย ${model} กำลังมีผู้ใช้งานเยอะ กรุณาลองสแกนใหม่อีกครั้งในอีกสักครู่`
  }

  return message ?? `เรียก ${model} ไม่สำเร็จ`
}

export async function POST(request: Request) {
  const startedAt = Date.now()
  let user
  try {
    user = await requireUser()
  } catch (error) {
    return jsonError(error)
  }
  const rateLimit = await checkRateLimit(`ai:scan:${user.id}`, {
    limit: 20,
    windowMs: 60 * 60 * 1000,
  })
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "สแกนรูปหลายครั้งเกินไป กรุณาลองใหม่ภายหลัง" },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    )
  }
  const apiKey = process.env.QWEN_API_KEY
  const model = process.env.QWEN_MODEL?.trim() || defaultAiModel

  if (!apiKey) {
    await recordScanResult({
      userId: user?.id,
      model,
      status: "error",
      latencyMs: Date.now() - startedAt,
      errorMessage: "QWEN_API_KEY missing",
    })
    return NextResponse.json(
      { error: `ยังไม่ได้ตั้งค่า QWEN_API_KEY สำหรับวิเคราะห์ด้วย ${model}` },
      { status: 500 },
    )
  }

  const parsedBody = await readJsonBodyWithLimit<{ image?: unknown }>(
    request,
    maxRequestBodyBytes,
    "รูปภาพหลังปรับขนาดต้องไม่เกิน 3MB",
  )
  if ("error" in parsedBody) {
    return NextResponse.json({ error: parsedBody.error }, { status: parsedBody.status })
  }
  const body = parsedBody.body
  const imageResult = parseFoodImageDataUrl(body?.image)

  if ("error" in imageResult) {
    await recordScanResult({
      userId: user?.id,
      model,
      status: "error",
      latencyMs: Date.now() - startedAt,
      errorMessage: imageResult.error,
    })
    return NextResponse.json({ error: imageResult.error }, { status: 400 })
  }

  try {
    const result = await analyzeFoodImage({
      apiKey,
      model,
      imageDataUrl: body?.image as string,
    })

    await recordScanResult({
      userId: user?.id,
      model,
      status: "success",
      isFood: result.analysis.isFood,
      confidence: result.analysis.confidence,
      latencyMs: Date.now() - startedAt,
      upstreamStatus: 200,
      rawPreview: result.rawPreview,
    })

    return NextResponse.json(result.analysis)
  } catch (error) {
    const providerError = error instanceof AiProviderError ? error : null
    const message = providerError ? friendlyModelError(providerError.message, model) : undefined

    if (providerError) {
      await recordScanResult({
        userId: user?.id,
        model,
        status: "error",
        latencyMs: Date.now() - startedAt,
        upstreamStatus: providerError.status,
        errorMessage: message,
        rawPreview: providerError.rawPreview ?? null,
      })
      return NextResponse.json({ error: message }, { status: providerError.status >= 500 ? 502 : providerError.status })
    }

    logScanFoodDebug("Failed to parse model content as FoodAnalysis JSON", {
      error: String(error),
    })
    await recordScanResult({
      userId: user?.id,
      model,
      status: "error",
      latencyMs: Date.now() - startedAt,
      errorMessage: `อ่านผลลัพธ์จาก ${model} ไม่สำเร็จ`,
    })
    return NextResponse.json({ error: `อ่านผลลัพธ์จาก ${model} ไม่สำเร็จ` }, { status: 502 })
  }
}
