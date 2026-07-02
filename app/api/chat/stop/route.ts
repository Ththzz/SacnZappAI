import { NextResponse } from "next/server"

import { requireUser } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { ChatApiError, chatJsonError, getRequestId, parseJsonBody } from "@/lib/chat/http"
import { getConversationById, getMessageById, type ChatDbClient, updateMessage } from "@/lib/chat/repository"
import { stopActiveChat } from "@/lib/chat/runtime"

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

export async function POST(request: Request) {
  const requestId = getRequestId(request)
  const chatDb = prisma as unknown as ChatDbClient

  try {
    const user = await requireUser()
    const body = parseJsonBody(await request.json().catch(() => null))
    const conversationId = readString(body?.conversationId)
    const assistantMessageId = readString(body?.assistantMessageId)

    if (!conversationId || !assistantMessageId) {
      throw new ChatApiError(400, "VALIDATION_ERROR", "กรุณาระบุ conversationId และ assistantMessageId", { requestId })
    }

    const conversation = await getConversationById(chatDb, user.id, conversationId)
    if (!conversation) {
      throw new ChatApiError(404, "CONVERSATION_NOT_FOUND", "ไม่พบบทสนทนา", { requestId })
    }

    const message = await getMessageById(chatDb, user.id, assistantMessageId, conversationId)
    if (!message || message.role !== "assistant") {
      throw new ChatApiError(404, "CONVERSATION_NOT_FOUND", "ไม่พบบทสนทนา", { requestId })
    }

    const stopped = stopActiveChat(assistantMessageId)
    if (!stopped && message.status !== "streaming") {
      return NextResponse.json({ ok: true, status: message.status })
    }

    await updateMessage(chatDb, user.id, assistantMessageId, {
      status: "stopped",
      finishReason: "stop",
    })

    return NextResponse.json({ ok: true, status: "stopped" })
  } catch (error) {
    return chatJsonError(error, requestId)
  }
}
