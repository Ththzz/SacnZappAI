import { NextResponse } from "next/server"

import { requireUser } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { CHAT_MESSAGE_PAGE_SIZE, CHAT_TITLE_MAX_LENGTH } from "@/lib/chat/config"
import { ChatApiError, chatJsonError, getRequestId, normalizeCursor, normalizeLimit, parseJsonBody, readBoolean } from "@/lib/chat/http"
import {
  getConversationById,
  listMessagesForConversation,
  softDeleteConversation,
  type ChatDbClient,
  updateConversation,
} from "@/lib/chat/repository"

function readTitle(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request)
  const chatDb = prisma as unknown as ChatDbClient

  try {
    const user = await requireUser()
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const cursor = normalizeCursor(searchParams.get("cursor"))
    const limit = normalizeLimit(searchParams.get("limit"), CHAT_MESSAGE_PAGE_SIZE, 100)

    const conversation = await getConversationById(chatDb, user.id, id)
    if (!conversation) {
      throw new ChatApiError(404, "CONVERSATION_NOT_FOUND", "ไม่พบบทสนทนา", { requestId })
    }

    const messages = await listMessagesForConversation(chatDb, {
      userId: user.id,
      conversationId: id,
      cursor: cursor ?? undefined,
      limit,
    })

    return NextResponse.json({
      conversation: {
        id: conversation.id,
        title: conversation.title,
        summary: conversation.summary,
        pinned: conversation.pinned,
        archivedAt: conversation.archivedAt ? conversation.archivedAt.toISOString() : null,
        updatedAt: conversation.updatedAt.toISOString(),
      },
      messages: messages.items.map((item) => ({
        id: item.id,
        role: item.role,
        content: item.content,
        status: item.status,
        parentMessageId: item.parentMessageId,
        clientRequestId: item.clientRequestId,
        model: item.model,
        finishReason: item.finishReason,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })),
      nextCursor: messages.nextCursor,
    })
  } catch (error) {
    return chatJsonError(error, requestId)
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request)
  const chatDb = prisma as unknown as ChatDbClient

  try {
    const user = await requireUser()
    const { id } = await params
    const body = parseJsonBody(await request.json().catch(() => null))
    const title = body && "title" in body ? readTitle(body.title) : undefined
    const pinned = body && "pinned" in body ? readBoolean(body.pinned) : undefined
    const archived = body && "archived" in body ? readBoolean(body.archived) : undefined

    if (!body) {
      throw new ChatApiError(400, "VALIDATION_ERROR", "รูปแบบคำขอไม่ถูกต้อง", { requestId })
    }

    for (const key of Object.keys(body)) {
      if (!["title", "pinned", "archived"].includes(key)) {
        throw new ChatApiError(400, "VALIDATION_ERROR", "พบฟิลด์ที่ไม่รองรับ", { requestId })
      }
    }

    if (title !== undefined && (!title || title.length > CHAT_TITLE_MAX_LENGTH)) {
      throw new ChatApiError(400, "VALIDATION_ERROR", "ชื่อบทสนทนาไม่ถูกต้อง", { requestId })
    }

    if (body.pinned !== undefined && pinned === null) {
      throw new ChatApiError(400, "VALIDATION_ERROR", "ค่า pinned ต้องเป็น boolean", { requestId })
    }

    if (body.archived !== undefined && archived === null) {
      throw new ChatApiError(400, "VALIDATION_ERROR", "ค่า archived ต้องเป็น boolean", { requestId })
    }

    const conversation = await updateConversation(chatDb, user.id, id, {
      title,
      pinned: pinned ?? undefined,
      archived: archived ?? undefined,
    })

    if (!conversation) {
      throw new ChatApiError(404, "CONVERSATION_NOT_FOUND", "ไม่พบบทสนทนา", { requestId })
    }

    return NextResponse.json({
      id: conversation.id,
      title: conversation.title,
      pinned: conversation.pinned,
      archivedAt: conversation.archivedAt ? conversation.archivedAt.toISOString() : null,
      updatedAt: conversation.updatedAt.toISOString(),
    })
  } catch (error) {
    return chatJsonError(error, requestId)
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request)
  const chatDb = prisma as unknown as ChatDbClient

  try {
    const user = await requireUser()
    const { id } = await params
    await softDeleteConversation(chatDb, user.id, id)
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return chatJsonError(error, requestId)
  }
}
