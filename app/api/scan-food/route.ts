import { NextResponse } from 'next/server'

type FoodAnalysis = {
  isFood: boolean
  reason: string
  name: string
  calories: number
  protein: number
  carbs: number
  fat: number
  confidence: number
  note: string
}

const imageDataUrlPattern = /^data:image\/(png|jpe?g|webp|heic|heif);base64,/i
const defaultGeminiModel = 'gemini-2.5-flash'
const retryableStatuses = new Set([429, 500, 502, 503, 504])

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function isBusyModelMessage(message?: string) {
  if (!message) return false

  const normalized = message.toLowerCase()
  return (
    normalized.includes('high demand') ||
    normalized.includes('try again later') ||
    normalized.includes('overloaded') ||
    normalized.includes('rate limit') ||
    normalized.includes('temporarily unavailable') ||
    normalized.includes('unavailable')
  )
}

function friendlyModelError(message: string | undefined, model: string) {
  if (isBusyModelMessage(message)) {
    return `ระบบวิเคราะห์ด้วย ${model} กำลังมีผู้ใช้งานเยอะ กรุณาลองสแกนใหม่อีกครั้งในอีกสักครู่`
  }

  return message ?? `เรียก ${model} ไม่สำเร็จ`
}

function extractOutputText(response: unknown) {
  if (!response || typeof response !== 'object') return ''

  const candidates = (response as { candidates?: unknown }).candidates
  if (!Array.isArray(candidates)) return ''

  return candidates
    .flatMap((candidate) => {
      if (!candidate || typeof candidate !== 'object') return []
      const content = (candidate as { content?: { parts?: unknown } }).content
      return Array.isArray(content?.parts) ? content.parts : []
    })
    .map((part) => {
      if (!part || typeof part !== 'object') return ''
      return (part as { text?: unknown }).text
    })
    .filter((text): text is string => typeof text === 'string')
    .join('')
}

function normalizeAnalysis(value: Partial<FoodAnalysis>): FoodAnalysis {
  return {
    isFood: Boolean(value.isFood),
    reason: String(value.reason ?? ''),
    name: String(value.name ?? ''),
    calories: Number(value.calories ?? 0),
    protein: Number(value.protein ?? 0),
    carbs: Number(value.carbs ?? 0),
    fat: Number(value.fat ?? 0),
    confidence: Math.max(0, Math.min(100, Number(value.confidence ?? 0))),
    note: String(value.note ?? ''),
  }
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY
  const model = process.env.GEMINI_MODEL?.trim() || defaultGeminiModel

  if (!apiKey) {
    return NextResponse.json({ error: `ยังไม่ได้ตั้งค่า GEMINI_API_KEY สำหรับวิเคราะห์ด้วย ${model}` }, { status: 500 })
  }

  const body = (await request.json().catch(() => null)) as { image?: unknown } | null
  const image = body?.image

  if (typeof image !== 'string' || !imageDataUrlPattern.test(image)) {
    return NextResponse.json({ error: 'กรุณาส่งไฟล์รูปภาพอาหารเป็น PNG, JPG, WEBP หรือ HEIC' }, { status: 400 })
  }

  const imageMatch = image.match(/^data:(image\/[^;]+);base64,(.+)$/i)
  if (!imageMatch) {
    return NextResponse.json({ error: 'รูปภาพต้องอยู่ในรูปแบบ base64 data URL' }, { status: 400 })
  }

  const [, mimeType, imageData] = imageMatch

  const requestBody = JSON.stringify({
    system_instruction: {
      parts: [
        {
          text:
            'You are NutriScan AI. Analyze only food or drink photos. If the image is not clearly food or drink, return isFood=false and do not invent nutrition. Estimate nutrition conservatively for one visible serving. Respond in Thai where text is needed.',
        },
      ],
    },
    contents: [
      {
        role: 'user',
        parts: [
          {
            text:
              'ตรวจภาพนี้ว่าเป็นอาหารหรือไม่ ถ้าเป็นอาหาร ให้ระบุชื่อเมนู แคลอรี่โดยประมาณ และสารอาหารหลัก Protein, Carb, Fat เป็นกรัม ถ้าไม่ใช่อาหารให้ isFood=false และบอกเหตุผลสั้น ๆ',
          },
          {
            inline_data: {
              mime_type: mimeType,
              data: imageData,
            },
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseJsonSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          isFood: { type: 'boolean', description: 'Whether the image clearly contains food or drink.' },
          reason: { type: 'string', description: 'Short Thai reason, especially when isFood is false.' },
          name: { type: 'string', description: 'Thai food or drink name. Empty string when not food.' },
          calories: { type: 'number', description: 'Estimated calories for one visible serving. Zero when not food.' },
          protein: { type: 'number', description: 'Estimated protein grams for one visible serving. Zero when not food.' },
          carbs: { type: 'number', description: 'Estimated carbohydrate grams for one visible serving. Zero when not food.' },
          fat: { type: 'number', description: 'Estimated fat grams for one visible serving. Zero when not food.' },
          confidence: { type: 'number', description: 'Confidence from 0 to 100.' },
          note: { type: 'string', description: 'Short Thai nutrition note. Empty string when not food.' },
        },
        required: ['isFood', 'reason', 'name', 'calories', 'protein', 'carbs', 'fat', 'confidence', 'note'],
      },
    },
  })

  let geminiResponse: Response | null = null
  let requestError: unknown = null

  for (const delay of [0, 800, 1600]) {
    if (delay > 0) await wait(delay)

    try {
      geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: {
          'x-goog-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: requestBody,
      })
      requestError = null
    } catch (error) {
      requestError = error
      continue
    }

    if (!retryableStatuses.has(geminiResponse.status)) break
  }

  if (!geminiResponse) {
    const message = requestError instanceof Error ? requestError.message : undefined
    return NextResponse.json({ error: friendlyModelError(message, model) }, { status: 502 })
  }

  const payload = await geminiResponse.json().catch(() => null)

  if (!geminiResponse.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? (payload as { error?: { message?: string } }).error?.message
        : undefined
    return NextResponse.json({ error: friendlyModelError(message, model) }, { status: geminiResponse.status })
  }

  try {
    const text = extractOutputText(payload)
    const parsed = JSON.parse(text) as Partial<FoodAnalysis>
    return NextResponse.json(normalizeAnalysis(parsed))
  } catch {
    return NextResponse.json({ error: `อ่านผลลัพธ์จาก ${model} ไม่สำเร็จ` }, { status: 502 })
  }
}
