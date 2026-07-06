import { defaultAiModel, requestAiChat } from "@/lib/ai/provider"

export type FoodAnalysis = {
  isFood: boolean
  reason: string
  name: string
  calories: number
  protein: number
  carbs: number
  fat: number
  confidence: number
  note: string
  mealKind: "main_meal" | "snack"
}

// Base64 adds roughly 33% overhead. Keep the encoded JSON request below
// Vercel Functions' 4.5 MB request payload limit.
export const MAX_FOOD_IMAGE_BYTES = 3 * 1024 * 1024

const imageDataUrlPrefixPattern = /^data:(image\/(?:png|jpe?g|webp|heic|heif));base64,/i

function getDecodedBase64Size(value: string) {
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0
  return Math.floor((value.length * 3) / 4) - padding
}

export function parseFoodImageDataUrl(image: unknown): { mimeType: string; imageData: string } | { error: string } {
  if (typeof image !== "string") {
    return { error: "กรุณาส่งไฟล์รูปภาพอาหารเป็น PNG, JPG, WEBP หรือ HEIC" }
  }

  const prefixMatch = image.match(imageDataUrlPrefixPattern)
  if (!prefixMatch) {
    return { error: "กรุณาส่งไฟล์รูปภาพอาหารเป็น PNG, JPG, WEBP หรือ HEIC" }
  }

  const imageData = image.slice(prefixMatch[0].length)
  if (!imageData || !/^[a-z\d+/]+={0,2}$/i.test(imageData) || imageData.length % 4 !== 0) {
    return { error: "รูปภาพต้องอยู่ในรูปแบบ base64 data URL ที่ถูกต้อง" }
  }

  if (getDecodedBase64Size(imageData) > MAX_FOOD_IMAGE_BYTES) {
    return { error: "รูปภาพหลังปรับขนาดต้องไม่เกิน 3MB" }
  }

  return {
    mimeType: prefixMatch[1],
    imageData,
  }
}

export function normalizeFoodAnalysis(value: Partial<FoodAnalysis>): FoodAnalysis {
  return {
    isFood: Boolean(value.isFood),
    reason: String(value.reason ?? ""),
    name: String(value.name ?? ""),
    calories: Number(value.calories ?? 0),
    protein: Number(value.protein ?? 0),
    carbs: Number(value.carbs ?? 0),
    fat: Number(value.fat ?? 0),
    confidence: Math.max(0, Math.min(100, Number(value.confidence ?? 0))),
    note: String(value.note ?? ""),
    mealKind: value.mealKind === "snack" ? "snack" : "main_meal",
  }
}

export function extractJsonFromFoodContent(content: string): string {
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (jsonMatch) return jsonMatch[1].trim()

  const braceMatch = content.match(/\{[\s\S]*\}/)
  if (braceMatch) return braceMatch[0]

  return content
}

export function buildFoodAnalysisMessages(mimeType: string, imageData: string) {
  return [
    {
      role: "system" as const,
      content:
        "You are ScanZapp AI. Analyze only food or drink photos. If the image is not clearly food or drink, return isFood=false and do not invent nutrition. Estimate nutrition conservatively for one visible serving. Classify mealKind from the food itself, never from capture time: use snack for a light between-meal food/drink or small treat, and main_meal for a substantial meal. Respond in Thai where text is needed. You MUST respond with ONLY a valid JSON object, no markdown, no explanation outside the JSON.",
    },
    {
      role: "user" as const,
      content: [
        {
          type: "text",
          text: 'ตรวจภาพนี้ว่าเป็นอาหารหรือไม่ ถ้าเป็นอาหาร ให้ระบุชื่อเมนู แคลอรี่โดยประมาณ สารอาหารหลัก และจำแนกจากลักษณะอาหารว่าเป็นมื้อหลักหรือของว่างโดยไม่อิงเวลา ถ้าไม่ใช่อาหารให้ isFood=false และบอกเหตุผลสั้น ๆ ตอบเป็น JSON เท่านั้นตามฟอร์แมตนี้: {"isFood":boolean,"reason":"string","name":"string","calories":number,"protein":number,"carbs":number,"fat":number,"confidence":number,"note":"string","mealKind":"main_meal|snack"}',
        },
        {
          type: "image_url",
          image_url: {
            url: `data:${mimeType};base64,${imageData}`,
          },
        },
      ],
    },
  ]
}

export async function analyzeFoodImage(input: {
  apiKey: string
  model?: string
  imageDataUrl: string
}) {
  const model = input.model?.trim() || process.env.QWEN_MODEL?.trim() || defaultAiModel
  const parsedImage = parseFoodImageDataUrl(input.imageDataUrl)

  if ("error" in parsedImage) {
    throw new Error(parsedImage.error)
  }

  const completion = await requestAiChat({
    apiKey: input.apiKey,
    model,
    messages: buildFoodAnalysisMessages(parsedImage.mimeType, parsedImage.imageData),
  })

  const jsonStr = extractJsonFromFoodContent(completion.text)
  const parsed = JSON.parse(jsonStr) as Partial<FoodAnalysis>
  const analysis = normalizeFoodAnalysis(parsed)

  return {
    model,
    analysis,
    rawPreview: completion.text.slice(0, 500),
  }
}
