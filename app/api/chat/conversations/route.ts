import { NextResponse } from "next/server"

import { requireUser } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { CHAT_CONVERSATION_PAGE_SIZE, CHAT_TITLE_MAX_LENGTH } from "@/lib/chat/config"
import { ChatApiError, chatJsonError, getRequestId, normalizeCursor, normalizeLimit, parseJsonBody, readBoolean } from "@/lib/chat/http"
import { createConversation, listConversationsForUser, type ChatDbClient } from "@/lib/chat/repository"

function readTitle(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

export async function GET(request: Request) {
  const requestId = getRequestId(request)
  const chatDb = prisma as unknown as ChatDbClient

  try {
    const user = await requireUser()
    const { searchParams } = new URL(request.url)
    const cursor = normalizeCursor(searchParams.get("cursor"))
    const limit = normalizeLimit(searchParams.get("limit"), CHAT_CONVERSATION_PAGE_SIZE, 50)
    const status = searchParams.get("status")
    const query = searchParams.get("q")?.trim() || undefined
    const pinnedParam = searchParams.get("pinned")

    if (status && status !== "active" && status !== "archived") {
      throw new ChatApiError(400, "VALIDATION_ERROR", "ค่า status ไม่ถูกต้อง", { requestId })
    }

    const pinned =
      pinnedParam === null ? undefined : pinnedParam === "true" ? true : pinnedParam === "false" ? false : null

    if (pinned === null) {
      throw new ChatApiError(400, "VALIDATION_ERROR", "ค่า pinned ต้องเป็น true หรือ false", { requestId })
    }

    const result = await listConversationsForUser(chatDb, {
      userId: user.id,
      cursor: cursor ?? undefined,
      limit,
      archived: status === "archived" ? true : status === "active" ? false : undefined,
      pinned: pinned ?? undefined,
      query,
    })

    return NextResponse.json({
      items: result.items.map((item) => ({
        id: item.id,
        title: item.title,
        pinned: item.pinned,
        archivedAt: item.archivedAt ? item.archivedAt.toISOString() : null,
        updatedAt: item.updatedAt.toISOString(),
        preview: item.summary ?? "",
      })),
      nextCursor: result.nextCursor,
    })
  } catch (error) {
    return chatJsonError(error, requestId)
  }
}

export async function POST(request: Request) {
  const requestId = getRequestId(request)
  const chatDb = prisma as unknown as ChatDbClient

  try {
    const user = await requireUser()
    const body = parseJsonBody(await request.json().catch(() => null))
    const title = readTitle(body?.title) || "แชตใหม่"

    if (title.length > CHAT_TITLE_MAX_LENGTH) {
      throw new ChatApiError(400, "VALIDATION_ERROR", "ชื่อบทสนทนายาวเกินกำหนด", { requestId })
    }

    const conversation = await createConversation(chatDb, {
      userId: user.id,
      title,
      pinned: readBoolean(body?.pinned) ?? false,
    })

    return NextResponse.json(
      {
        id: conversation.id,
        title: conversation.title,
        pinned: conversation.pinned,
        archivedAt: conversation.archivedAt,
        updatedAt: conversation.updatedAt.toISOString(),
      },
      { status: 201 },
    )
  } catch (error) {
    return chatJsonError(error, requestId)
  }
}
