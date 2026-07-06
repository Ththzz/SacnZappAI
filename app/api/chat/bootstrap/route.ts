import { NextResponse } from "next/server"

import { requireUser } from "@/lib/auth"
import { CHAT_CONSENT_SCOPES, CHAT_CONVERSATION_PAGE_SIZE, CHAT_MESSAGE_PAGE_SIZE, CHAT_POLICY_VERSION } from "@/lib/chat/config"
import { chatJsonError, getRequestId } from "@/lib/chat/http"
import {
  listActiveChatConsents,
  listConversationsForUser,
  listMessagesForConversation,
  type ChatDbClient,
} from "@/lib/chat/repository"
import { prisma } from "@/lib/db"

export async function GET(request: Request) {
  const requestId = getRequestId(request)
  const chatDb = prisma as unknown as ChatDbClient

  try {
    const user = await requireUser()
    const [consents, conversationResult] = await Promise.all([
      listActiveChatConsents(chatDb, user.id, CHAT_POLICY_VERSION),
      listConversationsForUser(chatDb, {
        userId: user.id,
        limit: CHAT_CONVERSATION_PAGE_SIZE,
        archived: false,
      }),
    ])
    const firstConversation = conversationResult.items[0] ?? null
    const initialMessages = firstConversation
      ? await listMessagesForConversation(chatDb, {
          userId: user.id,
          conversationId: firstConversation.id,
          limit: CHAT_MESSAGE_PAGE_SIZE,
        })
      : null

    return NextResponse.json({
      policyVersion: CHAT_POLICY_VERSION,
      availableScopes: CHAT_CONSENT_SCOPES,
      user: { name: user.name },
      consents: consents.map((item) => ({
        scope: item.scope,
        grantedAt: item.grantedAt.toISOString(),
        uiVersion: item.uiVersion,
      })),
      conversations: conversationResult.items.map((item) => ({
        id: item.id,
        title: item.title,
        pinned: item.pinned,
        archivedAt: item.archivedAt ? item.archivedAt.toISOString() : null,
        updatedAt: item.updatedAt.toISOString(),
        preview: item.summary ?? "",
      })),
      initialConversation: firstConversation && initialMessages
        ? {
            conversation: {
              id: firstConversation.id,
              title: firstConversation.title,
              summary: firstConversation.summary,
              pinned: firstConversation.pinned,
              archivedAt: firstConversation.archivedAt?.toISOString() ?? null,
              updatedAt: firstConversation.updatedAt.toISOString(),
            },
            messages: initialMessages.items.map((item) => ({
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
            nextCursor: initialMessages.nextCursor,
          }
        : null,
    })
  } catch (error) {
    return chatJsonError(error, requestId)
  }
}
