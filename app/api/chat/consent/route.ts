import { NextResponse } from "next/server"

import { requireUser } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { CHAT_CONSENT_SCOPES, CHAT_POLICY_VERSION, type ChatConsentScopeValue } from "@/lib/chat/config"
import { ChatApiError, chatJsonError, getRequestId, parseJsonBody } from "@/lib/chat/http"
import { getActiveChatConsent, grantChatConsent, listActiveChatConsents, revokeChatConsent, type ChatDbClient } from "@/lib/chat/repository"

function isConsentScope(value: unknown): value is ChatConsentScopeValue {
  return typeof value === "string" && CHAT_CONSENT_SCOPES.includes(value as ChatConsentScopeValue)
}

export async function GET(request: Request) {
  const requestId = getRequestId(request)
  const chatDb = prisma as unknown as ChatDbClient

  try {
    const user = await requireUser()
    const items = await listActiveChatConsents(chatDb, user.id, CHAT_POLICY_VERSION)

    return NextResponse.json({
      policyVersion: CHAT_POLICY_VERSION,
      items: items.map((item: { scope: string; grantedAt: Date; uiVersion: string | null }) => ({
        scope: item.scope,
        grantedAt: item.grantedAt.toISOString(),
        uiVersion: item.uiVersion,
      })),
    })
  } catch (error) {
    return chatJsonError(error, requestId)
  }
}

export async function PATCH(request: Request) {
  const requestId = getRequestId(request)
  const chatDb = prisma as unknown as ChatDbClient

  try {
    const user = await requireUser()
    const body = parseJsonBody(await request.json().catch(() => null))
    const updates = Array.isArray(body?.updates) ? body.updates : null

    if (!updates || updates.length === 0) {
      throw new ChatApiError(400, "VALIDATION_ERROR", "กรุณาระบุรายการ consent ที่ต้องการอัปเดต", { requestId })
    }

    await prisma.$transaction(async (tx) => {
      const transactionDb = tx as unknown as ChatDbClient
      for (const update of updates) {
        const record = parseJsonBody(update)
        const scope = record?.scope
        const granted = record?.granted
        const uiVersion = typeof record?.uiVersion === "string" ? record.uiVersion.trim() : null

        if (!isConsentScope(scope) || typeof granted !== "boolean") {
          throw new ChatApiError(400, "VALIDATION_ERROR", "รูปแบบ consent ไม่ถูกต้อง", { requestId })
        }

        if (granted) {
          const active = await getActiveChatConsent(transactionDb, user.id, scope, CHAT_POLICY_VERSION)
          if (!active) {
            await grantChatConsent(transactionDb, {
              userId: user.id,
              scope,
              policyVersion: CHAT_POLICY_VERSION,
              uiVersion,
            })
          }
        } else {
          await revokeChatConsent(transactionDb, user.id, scope, CHAT_POLICY_VERSION)
        }
      }
    })

    const items = await listActiveChatConsents(chatDb, user.id, CHAT_POLICY_VERSION)

    return NextResponse.json({
      policyVersion: CHAT_POLICY_VERSION,
      items: items.map((item: { scope: string; grantedAt: Date; uiVersion: string | null }) => ({
        scope: item.scope,
        grantedAt: item.grantedAt.toISOString(),
        uiVersion: item.uiVersion,
      })),
    })
  } catch (error) {
    return chatJsonError(error, requestId)
  }
}
