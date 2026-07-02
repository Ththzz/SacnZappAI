export const defaultAiModel = "qwen/qwen3.7-plus"
const apiBaseUrl = process.env.AI_BASE_URL?.trim() || "https://ai.psu.blue/v1"
const retryableStatuses = new Set([429, 500, 502, 503, 504])

type ProviderMessage = {
  role: "system" | "user" | "assistant"
  content: unknown
}

type ProviderUsage = {
  prompt_tokens?: number
  completion_tokens?: number
}

export class AiProviderError extends Error {
  status: number
  retryable: boolean
  rawPreview?: string

  constructor(message: string, status = 502, retryable = false, rawPreview?: string) {
    super(message)
    this.status = status
    this.retryable = retryable
    this.rawPreview = rawPreview
  }
}

function wait(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"))
      return
    }

    const finish = () => {
      signal?.removeEventListener("abort", abort)
      resolve()
    }
    const timeout = setTimeout(finish, ms)
    const abort = () => {
      clearTimeout(timeout)
      reject(new DOMException("Aborted", "AbortError"))
    }
    signal?.addEventListener("abort", abort, { once: true })
  })
}

function parseJsonPayload(rawBody: string): Record<string, unknown> | null {
  try {
    return JSON.parse(rawBody) as Record<string, unknown>
  } catch {
    return null
  }
}

function parseStreamedPayload(rawBody: string): { payload: Record<string, unknown>; content: string } | null {
  const dataLines = rawBody
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.replace(/^data:\s*/, "").trim())
    .filter((line) => line && line !== "[DONE]")

  if (dataLines.length === 0) return null

  const chunks: Record<string, unknown>[] = []
  let content = ""

  for (const line of dataLines) {
    const chunk = parseJsonPayload(line)
    if (!chunk) continue

    chunks.push(chunk)
    const choices = (chunk as { choices?: { delta?: { content?: string }; message?: { content?: string } }[] }).choices
    content += choices?.[0]?.delta?.content ?? choices?.[0]?.message?.content ?? ""
  }

  if (chunks.length === 0) return null

  return {
    payload: {
      object: "chat.completion.stream",
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

function parseResponseBody(rawBody: string) {
  let payload = parseJsonPayload(rawBody)
  const streamedPayload = payload ? null : parseStreamedPayload(rawBody)
  if (!payload && streamedPayload) {
    payload = streamedPayload.payload
  }

  return {
    payload,
    content: streamedPayload?.content ?? (payload ? extractTextFromPayload(payload) : ""),
  }
}

export function extractTextFromPayload(payload: Record<string, unknown>) {
  return (
    (payload as { choices?: { message?: { content?: string } }[] })?.choices?.[0]?.message?.content ??
    (payload as { output?: { choices?: { message?: { content?: string } }[] } })?.output?.choices?.[0]?.message?.content ??
    (payload as { output?: { text?: string } })?.output?.text ??
    ""
  )
}

export function normalizeAiBusyMessage(message: string | undefined, model: string) {
  const normalized = message?.toLowerCase() || ""
  if (
    normalized.includes("high demand") ||
    normalized.includes("try again later") ||
    normalized.includes("overloaded") ||
    normalized.includes("rate limit") ||
    normalized.includes("temporarily unavailable") ||
    normalized.includes("unavailable")
  ) {
    return `ระบบวิเคราะห์ด้วย ${model} กำลังมีผู้ใช้งานเยอะ กรุณาลองใหม่อีกครั้งในอีกสักครู่`
  }

  return message || `เรียก ${model} ไม่สำเร็จ`
}

export async function requestAiChat(input: {
  apiKey: string
  model?: string
  messages: ProviderMessage[]
  timeoutMs?: number
  signal?: AbortSignal
  maxTokens?: number
  onDelta?: (text: string) => void
}) {
  const model = input.model?.trim() || process.env.QWEN_MODEL?.trim() || defaultAiModel
  // This is a budget for the whole operation, not for every retry. The old
  // per-attempt timeout could keep one browser request open for over 2 minutes.
  const timeoutMs = input.timeoutMs ?? 60_000
  const deadline = Date.now() + timeoutMs
  const retryDelays = [0, 500, 1_000]
  let lastError: unknown = null
  let response: Response | null = null
  let timedOut = false
  let rawBody = ""
  let streamedAnyContent = false

  for (const delay of retryDelays) {
    if (delay > 0) {
      try {
        await wait(Math.min(delay, Math.max(0, deadline - Date.now())), input.signal)
      } catch {
        break
      }
    }

    const remainingMs = deadline - Date.now()
    if (remainingMs <= 0) {
      timedOut = true
      break
    }

    const controller = new AbortController()
    let attemptTimedOut = false
    const timeout = setTimeout(() => {
      attemptTimedOut = true
      controller.abort()
    }, remainingMs)
    const abortListener = () => controller.abort()
    input.signal?.addEventListener("abort", abortListener, { once: true })

    try {
      response = await fetch(`${apiBaseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          stream: Boolean(input.onDelta),
          messages: input.messages,
          max_tokens: input.maxTokens,
        }),
        signal: controller.signal,
      })

      if (response.ok) {
        if (input.onDelta) {
          const streamed = await readCompletionStream(response, (text) => {
            streamedAnyContent = true
            input.onDelta?.(text)
          })
          rawBody = streamed.rawBody
          clearTimeout(timeout)
          input.signal?.removeEventListener("abort", abortListener)
          return buildCompletionResult(model, streamed.payload, streamed.content, rawBody)
        }

        rawBody = await response.text()
        lastError = null
        break
      }

      rawBody = await response.text().catch(() => "")
      lastError = null
    } catch (error) {
      if (streamedAnyContent) {
        throw new AiProviderError("การเชื่อมต่อขาดหายระหว่างรับคำตอบ กรุณาลองใหม่", 502, true)
      }
      lastError = error
      response = null
      timedOut = attemptTimedOut
    } finally {
      clearTimeout(timeout)
      input.signal?.removeEventListener("abort", abortListener)
    }

    if (input.signal?.aborted || (response !== null && !retryableStatuses.has(response.status))) {
      break
    }
  }

  if (!response) {
    if (input.signal?.aborted) {
      throw new AiProviderError("การตอบถูกยกเลิก", 499, false)
    }

    if (timedOut) {
      throw new AiProviderError(
        `ระบบวิเคราะห์ด้วย ${model} ใช้เวลาตอบนานเกินไป กรุณาลองส่งอีกครั้ง`,
        504,
        true,
      )
    }

    throw new AiProviderError(
      normalizeAiBusyMessage(lastError instanceof Error ? lastError.message : undefined, model),
      502,
      true,
    )
  }

  const { payload, content } = parseResponseBody(rawBody)

  if (!response.ok) {
    const upstreamMessage =
      payload && "error" in payload
        ? (payload as { error?: { message?: string } }).error?.message
        : rawBody.slice(0, 300) || undefined
    throw new AiProviderError(
      normalizeAiBusyMessage(upstreamMessage, model),
      retryableStatuses.has(response.status) ? 503 : 502,
      retryableStatuses.has(response.status),
      rawBody.slice(0, 500),
    )
  }

  return buildCompletionResult(model, payload, content, rawBody)
}

function buildCompletionResult(
  model: string,
  payload: Record<string, unknown> | null,
  content: string,
  rawBody: string,
) {
  if (!payload) {
    throw new AiProviderError(`อ่านผลลัพธ์จาก ${model} ไม่สำเร็จ (response ไม่ใช่ JSON)`, 502, false, rawBody.slice(0, 500))
  }

  if (!content.trim()) {
    throw new AiProviderError(`อ่านผลลัพธ์จาก ${model} ไม่สำเร็จ (content ว่าง)`, 502, false, rawBody.slice(0, 500))
  }

  const usage = (payload as { usage?: ProviderUsage }).usage
  const finishReason =
    (payload as { choices?: { finish_reason?: string | null }[] }).choices?.[0]?.finish_reason ?? null

  return {
    model,
    payload,
    text: content.trim(),
    finishReason,
    usage: {
      inputTokens: usage?.prompt_tokens ?? null,
      outputTokens: usage?.completion_tokens ?? null,
    },
    rawPreview: rawBody.slice(0, 500),
  }
}

async function readCompletionStream(response: Response, onDelta: (text: string) => void) {
  if (!response.body) {
    throw new AiProviderError("ผู้ให้บริการไม่ส่ง response stream กลับมา", 502, true)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let content = ""
  let rawBody = ""
  let usage: ProviderUsage | undefined
  let finishReason: string | null = null

  const consumeLine = (line: string) => {
    const trimmed = line.trim()
    if (!trimmed.startsWith("data:")) return
    const data = trimmed.replace(/^data:\s*/, "").trim()
    if (!data || data === "[DONE]") return

    const chunk = parseJsonPayload(data)
    if (!chunk) return
    const choice = (chunk as {
      choices?: Array<{ delta?: { content?: string }; message?: { content?: string }; finish_reason?: string | null }>
    }).choices?.[0]
    const delta = choice?.delta?.content ?? choice?.message?.content ?? ""
    if (delta) {
      content += delta
      onDelta(delta)
    }
    usage = (chunk as { usage?: ProviderUsage }).usage ?? usage
    finishReason = choice?.finish_reason ?? finishReason
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const decoded = decoder.decode(value, { stream: true })
    rawBody += decoded
    buffer += decoded
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ""
    lines.forEach(consumeLine)
  }

  buffer += decoder.decode()
  if (buffer) consumeLine(buffer)

  return {
    content,
    rawBody,
    payload: {
      object: "chat.completion.stream",
      choices: [{ message: { content }, finish_reason: finishReason }],
      usage,
    } as Record<string, unknown>,
  }
}
