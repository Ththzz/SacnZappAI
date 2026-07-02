import { requireUser } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { requestChatCompletion, buildChatMessagesWithContext, buildChatTitle, ChatProviderError } from "@/lib/chat/ai"
import { CHAT_MESSAGE_MAX_LENGTH, CHAT_POLICY_VERSION } from "@/lib/chat/config"
import { ChatApiError, chatError, chatJsonError, getRequestId, parseJsonBody } from "@/lib/chat/http"
import { buildChatContext } from "@/lib/chat/context"
import {
  createChatUsage,
  createConversation,
  createMessage,
  getActiveChatConsent,
  getAssistantMessageForUserMessage,
  getConversationById,
  getMessageByClientRequestId,
  listRecentMessagesForConversation,
  type ChatDbClient,
  touchConversation,
  updateMessage,
} from "@/lib/chat/repository"
import { clearActiveChat, createChatAbortController } from "@/lib/chat/runtime"
import { checkRateLimit } from "@/lib/rate-limit"
import { readJsonBodyWithLimit } from "@/lib/request-body"

type ChatRequestBody = {
  conversationId?: unknown
  message?: unknown
  clientRequestId?: unknown
  contextNote?: unknown
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function createSseHeaders() {
  return {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  }
}

function encodeSseEvent(event: string, data: Record<string, unknown>) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

function createReplayStream(input: {
  conversationId: string
  userMessageId: string
  assistantMessageId: string
  text: string
  finishReason: string | null
  usage: { inputTokens: number | null; outputTokens: number | null }
}) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(
        new TextEncoder().encode(
          encodeSseEvent("meta", {
            conversationId: input.conversationId,
            userMessageId: input.userMessageId,
            assistantMessageId: input.assistantMessageId,
            replayed: true,
          }) +
            encodeSseEvent("delta", { text: input.text }) +
            encodeSseEvent("done", {
              finishReason: input.finishReason ?? "stop",
              usage: input.usage,
            }),
        ),
      )
      controller.close()
    },
  })
}

export async function POST(request: Request) {
  const requestId = getRequestId(request)
  const chatDb = prisma as unknown as ChatDbClient
  const contextDb = prisma as Parameters<typeof buildChatContext>[0]["db"]

  try {
    const user = await requireUser()
    const rateLimit = checkRateLimit(`ai:chat:${user.id}`, {
      limit: 30,
      windowMs: 10 * 60 * 1000,
    })
    if (!rateLimit.allowed) {
      throw new ChatApiError(429, "RATE_LIMITED", "ส่งข้อความถี่เกินไป กรุณารอสักครู่", {
        requestId,
        retryable: true,
      })
    }
    const apiKey = process.env.QWEN_API_KEY?.trim()
    const parsedBody = await readJsonBodyWithLimit<ChatRequestBody>(
      request,
      32 * 1024,
      "คำขอมีขนาดใหญ่เกินกำหนด",
    )
    if ("error" in parsedBody) {
      throw new ChatApiError(413, "VALIDATION_ERROR", parsedBody.error, { requestId })
    }
    const body = parseJsonBody(parsedBody.body)
    const conversationId = readString(body?.conversationId)
    const message = readString(body?.message)
    const clientRequestId = readString(body?.clientRequestId)
    const contextNote = readString(body?.contextNote)

    if (!apiKey) {
      throw new ChatApiError(503, "PROVIDER_UNAVAILABLE", "ยังไม่ได้ตั้งค่า QWEN_API_KEY", { requestId, retryable: false })
    }

    if (!message) {
      throw new ChatApiError(400, "VALIDATION_ERROR", "กรุณาระบุข้อความ", { requestId })
    }

    if (message.length > CHAT_MESSAGE_MAX_LENGTH) {
      throw new ChatApiError(400, "VALIDATION_ERROR", "ข้อความยาวเกินกำหนด", { requestId })
    }

    if (!clientRequestId) {
      throw new ChatApiError(400, "VALIDATION_ERROR", "กรุณาระบุ clientRequestId", { requestId })
    }

    const consent = await getActiveChatConsent(chatDb, user.id, "ai_chat_basic", CHAT_POLICY_VERSION)
    if (!consent) {
      throw new ChatApiError(403, "CONSENT_REQUIRED", "ต้องยินยอมการใช้งาน AI chat ก่อน", { requestId })
    }

    const existingUserMessage = await getMessageByClientRequestId(chatDb, user.id, clientRequestId)
    if (existingUserMessage) {
      const existingAssistant = await getAssistantMessageForUserMessage(
        chatDb,
        user.id,
        existingUserMessage.conversationId,
        existingUserMessage.id,
      )

      if (existingAssistant?.content) {
        return new Response(
          createReplayStream({
            conversationId: existingUserMessage.conversationId,
            userMessageId: existingUserMessage.id,
            assistantMessageId: existingAssistant.id,
            text: existingAssistant.content,
            finishReason: existingAssistant.finishReason,
            usage: {
              inputTokens: existingAssistant.inputTokens,
              outputTokens: existingAssistant.outputTokens,
            },
          }),
          { headers: createSseHeaders() },
        )
      }

      return chatError(409, "VALIDATION_ERROR", "คำขอนี้ถูกส่งไปแล้วและยังประมวลผลไม่เสร็จ", requestId, true)
    }

    let activeConversationId = conversationId
    if (activeConversationId) {
      const conversation = await getConversationById(chatDb, user.id, activeConversationId)
      if (!conversation) {
        throw new ChatApiError(404, "CONVERSATION_NOT_FOUND", "ไม่พบบทสนทนา", { requestId })
      }
    } else {
      const createdConversation = await createConversation(chatDb, {
        userId: user.id,
        title: buildChatTitle(message),
      })
      activeConversationId = createdConversation.id
    }

    const [recentMessages, personalContext] = await Promise.all([
      listRecentMessagesForConversation(chatDb, user.id, activeConversationId, 10),
      buildChatContext({
        db: contextDb,
        userId: user.id,
        message,
      }),
    ])
    const userMessage = await createMessage(chatDb, {
      conversationId: activeConversationId,
      userId: user.id,
      role: "user",
      content: message,
      status: "complete",
      clientRequestId,
    })

    const assistantMessage = await createMessage(chatDb, {
      conversationId: activeConversationId,
      userId: user.id,
      role: "assistant",
      content: "",
      status: "streaming",
      parentMessageId: userMessage.id,
    })

    const provenanceLabels = [...personalContext.provenanceLabels]
    if (contextNote) {
      provenanceLabels.push("ภาพอาหารที่แนบ")
    }

    const promptMessages = buildChatMessagesWithContext({
      history: recentMessages.map((item) => ({
        role: item.role,
        content: item.content,
      })),
      nextUserMessage: message,
      contextBlocks: personalContext.contextBlocks,
      additionalUserContext: contextNote || null,
    })

    let generationController: AbortController | null = null
    let streamCanceled = false

    return new Response(
      new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder()
          const generationStartedAt = Date.now()
          let closed = streamCanceled
          const sendEvent = (event: string, data: Record<string, unknown>) => {
            if (!closed) {
              try {
                controller.enqueue(encoder.encode(encodeSseEvent(event, data)))
              } catch {
                closed = true
                generationController?.abort()
              }
            }
          }
          sendEvent("meta", {
            conversationId: activeConversationId,
            userMessageId: userMessage.id,
            assistantMessageId: assistantMessage.id,
          })

          // Keep proxies from treating model thinking time as an idle connection.
          const heartbeat = setInterval(() => {
            if (!closed) {
              try {
                controller.enqueue(encoder.encode(": keep-alive\n\n"))
              } catch {
                closed = true
                generationController?.abort()
              }
            }
          }, 10_000)

          try {
            const abortController = createChatAbortController(assistantMessage.id)
            generationController = abortController
            const abortFromClient = () => abortController.abort()
            request.signal.addEventListener("abort", abortFromClient, { once: true })
            const completion = await requestChatCompletion({
              apiKey,
              messages: promptMessages,
              signal: abortController.signal,
              onDelta: (text) => sendEvent("delta", { text }),
            })
            request.signal.removeEventListener("abort", abortFromClient)

            await Promise.all([
              updateMessage(chatDb, user.id, assistantMessage.id, {
                content: completion.text,
                status: "complete",
                model: completion.model,
                finishReason: completion.finishReason ?? "stop",
                inputTokens: completion.usage.inputTokens,
                outputTokens: completion.usage.outputTokens,
              }),
              createChatUsage(chatDb, {
                userId: user.id,
                conversationId: activeConversationId,
                messageId: assistantMessage.id,
                requestId: clientRequestId,
                model: completion.model,
                outcome: "success",
                latencyMs: Date.now() - generationStartedAt,
                inputTokens: completion.usage.inputTokens,
                outputTokens: completion.usage.outputTokens,
              }),
              touchConversation(chatDb, user.id, activeConversationId),
            ])

            sendEvent("done", {
              finishReason: completion.finishReason ?? "stop",
              usage: completion.usage,
              provenance: provenanceLabels,
            })
          } catch (error) {
            const wasStopped =
              error instanceof ChatProviderError &&
              (error.status === 499 || error.message === "การตอบถูกยกเลิก")
            const providerMessage =
              wasStopped
                ? "หยุดการตอบแล้ว"
                : error instanceof ChatProviderError
                  ? error.message
                  : "ยังไม่สามารถตอบคำถามได้ในตอนนี้"

            await Promise.all([
              updateMessage(chatDb, user.id, assistantMessage.id, {
                status: wasStopped ? "stopped" : "error",
                finishReason: wasStopped ? "stop" : "error",
                model: process.env.QWEN_MODEL?.trim() || undefined,
              }),
              createChatUsage(chatDb, {
                userId: user.id,
                conversationId: activeConversationId,
                messageId: assistantMessage.id,
                requestId: clientRequestId,
                model: process.env.QWEN_MODEL?.trim() || "qwen/qwen3.7-plus",
                outcome: wasStopped
                  ? "stopped"
                  : error instanceof ChatProviderError && error.status === 504
                    ? "timeout"
                    : "error",
                latencyMs: Date.now() - generationStartedAt,
              }),
            ])

            sendEvent("error", {
              code: wasStopped
                ? "GENERATION_STOPPED"
                : error instanceof ChatProviderError
                  ? "PROVIDER_UNAVAILABLE"
                  : "INTERNAL_ERROR",
              message: providerMessage,
              retryable: wasStopped ? false : error instanceof ChatProviderError ? error.retryable : false,
            })
          } finally {
            clearInterval(heartbeat)
            clearActiveChat(assistantMessage.id)
            closed = true
            if (!streamCanceled) controller.close()
          }
        },
        cancel() {
          streamCanceled = true
          generationController?.abort()
        },
      }),
      { headers: createSseHeaders() },
    )
  } catch (error) {
    return chatJsonError(error, requestId)
  }
}
