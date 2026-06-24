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
const defaultQwenModel = 'qwen/qwen3.7-plus'
const apiBaseUrl = process.env.AI_BASE_URL?.trim() || 'https://ai.psu.blue/v1'

const retryableStatuses = new Set([429, 500, 502, 503, 504])

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const isDevelopment = process.env.NODE_ENV === 'development'

function logScanFoodDebug(message: string, details?: Record<string, unknown>) {
  if (!isDevelopment) return
  console.info('[scan-food]', message, details ?? '')
}

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

function parseImageDataUrl(image: unknown): { mimeType: string; imageData: string } | { error: string } {
  if (typeof image !== 'string' || !imageDataUrlPattern.test(image)) {
    return { error: 'กรุณาส่งไฟล์รูปภาพอาหารเป็น PNG, JPG, WEBP หรือ HEIC' }
  }

  const imageMatch = image.match(/^data:(image\/[^;]+);base64,(.+)$/i)
  if (!imageMatch) {
    return { error: 'รูปภาพต้องอยู่ในรูปแบบ base64 data URL' }
  }

  return {
    mimeType: imageMatch[1],
    imageData: imageMatch[2],
  }
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

function extractJsonFromContent(content: string): string {
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (jsonMatch) return jsonMatch[1].trim()

  const braceMatch = content.match(/\{[\s\S]*\}/)
  if (braceMatch) return braceMatch[0]

  return content
}

function parseJsonPayload(rawBody: string): Record<string, unknown> | null {
  try {
    return JSON.parse(rawBody) as Record<string, unknown>
  } catch {
    return null
  }
}

function extractContentFromPayload(payload: Record<string, unknown>): string {
  return (
    (payload as { choices?: { message?: { content?: string } }[] })?.choices?.[0]?.message?.content ??
    (payload as { output?: { choices?: { message?: { content?: string } }[] } })?.output?.choices?.[0]?.message?.content ??
    (payload as { output?: { text?: string } })?.output?.text ??
    ''
  )
}

function parseStreamedPayload(rawBody: string): { payload: Record<string, unknown>; content: string } | null {
  const dataLines = rawBody
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.replace(/^data:\s*/, '').trim())
    .filter((line) => line && line !== '[DONE]')

  if (dataLines.length === 0) return null

  const chunks: Record<string, unknown>[] = []
  let content = ''

  for (const line of dataLines) {
    const chunk = parseJsonPayload(line)
    if (!chunk) continue

    chunks.push(chunk)

    const choices = (chunk as { choices?: { delta?: { content?: string }; message?: { content?: string } }[] }).choices
    const deltaContent = choices?.[0]?.delta?.content ?? choices?.[0]?.message?.content ?? ''
    content += deltaContent
  }

  if (chunks.length === 0) return null

  return {
    payload: {
      object: 'chat.completion.stream',
      chunks,
      choices: [
        {
          message: {
            content,
          },
        },
      ],
    },
    content,
  }
}

function parseQwenResponseBody(rawBody: string) {
  let payload = parseJsonPayload(rawBody)
  const streamedPayload = payload ? null : parseStreamedPayload(rawBody)

  if (!payload && streamedPayload) {
    payload = streamedPayload.payload
  }

  return { payload, streamedPayload }
}

function buildQwenRequestBody(model: string, mimeType: string, imageData: string) {
  return {
    model,
    stream: false,
    messages: [
      {
        role: 'system',
        content:
          'You are ScanZapp AI. Analyze only food or drink photos. If the image is not clearly food or drink, return isFood=false and do not invent nutrition. Estimate nutrition conservatively for one visible serving. Respond in Thai where text is needed. You MUST respond with ONLY a valid JSON object, no markdown, no explanation outside the JSON.',
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'ตรวจภาพนี้ว่าเป็นอาหารหรือไม่ ถ้าเป็นอาหาร ให้ระบุชื่อเมนู แคลอรี่โดยประมาณ และสารอาหารหลักโปรตีน คาร์บ และไขมันเป็นกรัม ถ้าไม่ใช่อาหารให้ isFood=false และบอกเหตุผลสั้น ๆ ตอบเป็น JSON เท่านั้นตามฟอร์แมตนี้: {"isFood":boolean,"reason":"string","name":"string","calories":number,"protein":number,"carbs":number,"fat":number,"confidence":number,"note":"string"}',
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${imageData}`,
            },
          },
        ],
      },
    ],
  }
}

async function requestQwenAnalysis(apiKey: string, requestBody: ReturnType<typeof buildQwenRequestBody>) {
  let qwenResponse: Response | null = null
  let requestError: unknown = null

  for (const delay of [0, 800, 1600]) {
    if (delay > 0) await wait(delay)

    try {
      qwenResponse = await fetch(`${apiBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })
      requestError = null
    } catch (error) {
      requestError = error
      continue
    }

    if (!retryableStatuses.has(qwenResponse.status)) break
  }

  return { qwenResponse, requestError }
}

export async function POST(request: Request) {
  const apiKey = process.env.QWEN_API_KEY
  const model = process.env.QWEN_MODEL?.trim() || defaultQwenModel

  if (!apiKey) {
    return NextResponse.json(
      { error: `ยังไม่ได้ตั้งค่า QWEN_API_KEY สำหรับวิเคราะห์ด้วย ${model}` },
      { status: 500 },
    )
  }

  const body = (await request.json().catch(() => null)) as { image?: unknown } | null
  const imageResult = parseImageDataUrl(body?.image)

  if ('error' in imageResult) {
    return NextResponse.json(
      { error: imageResult.error },
      { status: 400 },
    )
  }

  const { mimeType, imageData } = imageResult
  const requestBody = buildQwenRequestBody(model, mimeType, imageData)
  const { qwenResponse, requestError } = await requestQwenAnalysis(apiKey, requestBody)

  if (!qwenResponse) {
    const message = requestError instanceof Error ? requestError.message : undefined
    return NextResponse.json({ error: friendlyModelError(message, model) }, { status: 502 })
  }

  const rawBody = await qwenResponse.text().catch(() => '')

  logScanFoodDebug('Upstream response received', {
    status: qwenResponse.status,
    bodyLength: rawBody.length,
  })

  const { payload, streamedPayload } = parseQwenResponseBody(rawBody)

  if (!payload) {
    logScanFoodDebug('Failed to parse JSON from upstream response body')
  }

  if (!qwenResponse.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? (payload as { error?: { message?: string } }).error?.message
        : rawBody.slice(0, 300) || undefined
    return NextResponse.json({ error: friendlyModelError(message, model), status: qwenResponse.status }, { status: qwenResponse.status })
  }

  if (!payload) {
    return NextResponse.json(
      { error: `อ่านผลลัพธ์จาก ${model} ไม่สำเร็จ (response ไม่ใช่ JSON)` },
      { status: 502 },
    )
  }

  const content = streamedPayload?.content ?? extractContentFromPayload(payload)

  logScanFoodDebug('Upstream payload parsed', {
    payloadKeys: Object.keys(payload),
    contentLength: content.length,
  })

  if (!content) {
    logScanFoodDebug('Upstream payload content was empty', {
      payloadKeys: Object.keys(payload),
    })
    return NextResponse.json(
      { error: `อ่านผลลัพธ์จาก ${model} ไม่สำเร็จ (content ว่าง)`, payloadKeys: Object.keys(payload) },
      { status: 502 },
    )
  }

  try {
    const jsonStr = extractJsonFromContent(content)
    const parsed = JSON.parse(jsonStr) as Partial<FoodAnalysis>
    return NextResponse.json(normalizeAnalysis(parsed))
  } catch (parseError) {
    logScanFoodDebug('Failed to parse model content as FoodAnalysis JSON', {
      error: String(parseError),
      contentLength: content.length,
    })
    return NextResponse.json(
      { error: `อ่านผลลัพธ์จาก ${model} ไม่สำเร็จ` },
      { status: 502 },
    )
  }
}
