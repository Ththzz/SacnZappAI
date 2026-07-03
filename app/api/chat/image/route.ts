import { NextResponse } from "next/server"

import { requireUser } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { analyzeFoodImage, MAX_FOOD_IMAGE_BYTES } from "@/lib/ai/food-analysis"
import { CHAT_POLICY_VERSION } from "@/lib/chat/config"
import { ChatApiError, chatJsonError, getRequestId, parseJsonBody } from "@/lib/chat/http"
import { getActiveChatConsent, type ChatDbClient } from "@/lib/chat/repository"
import { checkRateLimit } from "@/lib/rate-limit"
import { readJsonBodyWithLimit } from "@/lib/request-body"

const maxRequestBodyBytes = Math.ceil((MAX_FOOD_IMAGE_BYTES * 4) / 3) + 1024

export const maxDuration = 90

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

export async function POST(request: Request) {
  const requestId = getRequestId(request)
  const chatDb = prisma as unknown as ChatDbClient

  try {
    const user = await requireUser()
    const rateLimit = await checkRateLimit(`ai:chat-image:${user.id}`, {
      limit: 20,
      windowMs: 60 * 60 * 1000,
    })
    if (!rateLimit.allowed) {
      throw new ChatApiError(429, "RATE_LIMITED", "วิเคราะห์รูปถี่เกินไป กรุณารอแล้วลองใหม่", {
        requestId,
        retryable: true,
      })
    }
    const apiKey = process.env.QWEN_API_KEY?.trim()
    const parsedBody = await readJsonBodyWithLimit<Record<string, unknown>>(
      request,
      maxRequestBodyBytes,
      "รูปภาพหลังปรับขนาดต้องไม่เกิน 3MB",
    )
    if ("error" in parsedBody) {
      throw new ChatApiError(413, "UNSUPPORTED_IMAGE", parsedBody.error, { requestId })
    }
    const body = parseJsonBody(parsedBody.body)
    const image = readString(body?.image)

    if (!apiKey) {
      throw new ChatApiError(503, "PROVIDER_UNAVAILABLE", "ยังไม่ได้ตั้งค่า QWEN_API_KEY", { requestId })
    }

    if (!image) {
      throw new ChatApiError(400, "VALIDATION_ERROR", "กรุณาแนบรูปภาพ", { requestId })
    }

    const consent = await getActiveChatConsent(chatDb, user.id, "image_analysis", CHAT_POLICY_VERSION)
    if (!consent) {
      throw new ChatApiError(403, "CONSENT_REQUIRED", "ต้องยินยอมการวิเคราะห์รูปภาพก่อน", { requestId })
    }

    const result = await analyzeFoodImage({
      apiKey,
      imageDataUrl: image,
    })

    return NextResponse.json({
      analysis: result.analysis,
      contextNote: result.analysis.isFood
        ? `ผลวิเคราะห์จากภาพอาหารที่ผู้ใช้แนบ (เป็นค่าประมาณ): ${result.analysis.name}, ประมาณ ${Math.round(result.analysis.calories)} kcal, โปรตีน ${Math.round(result.analysis.protein)}g, คาร์บ ${Math.round(result.analysis.carbs)}g, ไขมัน ${Math.round(result.analysis.fat)}g. สมมติฐาน: 1 เสิร์ฟที่มองเห็นในภาพ และผลลัพธ์นี้อาจคลาดเคลื่อนได้`
        : `ผลวิเคราะห์จากภาพอาหารที่ผู้ใช้แนบ: ยังยืนยันไม่ได้ว่าเป็นอาหารหรือเครื่องดื่ม เหตุผล: ${result.analysis.reason || "ภาพไม่ชัดเจนพอ"}`,
      provenanceLabel: "ภาพอาหารที่แนบ",
      model: result.model,
    })
  } catch (error) {
    return chatJsonError(error, requestId)
  }
}
