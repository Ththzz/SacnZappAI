export type ChatRole = "user" | "assistant"
export type MessageStatus = "pending" | "streaming" | "complete" | "stopped" | "error"
export type ChatConsentScope =
  | "ai_chat_basic"
  | "profile_context"
  | "nutrition_history"
  | "hydration_history"
  | "image_analysis"
  | "memory"
export type ChatUsageOutcome = "success" | "stopped" | "error" | "timeout"

export type ChatConversationRecord = {
  id: string
  userId: string
  title: string
  summary: string | null
  pinned: boolean
  archivedAt: Date | null
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export type ChatMessageRecord = {
  id: string
  conversationId: string
  userId: string
  role: ChatRole
  content: string
  status: MessageStatus
  parentMessageId: string | null
  clientRequestId: string | null
  model: string | null
  finishReason: string | null
  inputTokens: number | null
  outputTokens: number | null
  estimatedCostUsd: number | null
  createdAt: Date
  updatedAt: Date
}

export type ChatConsentRecord = {
  id: string
  userId: string
  scope: ChatConsentScope
  policyVersion: string
  grantedAt: Date
  revokedAt: Date | null
  uiVersion: string | null
  createdAt: Date
  updatedAt: Date
}

export type ChatUsageRecord = {
  id: string
  userId: string
  conversationId: string
  messageId: string | null
  requestId: string | null
  model: string
  outcome: ChatUsageOutcome
  latencyMs: number | null
  inputTokens: number | null
  outputTokens: number | null
  estimatedCostUsd: number | null
  createdAt: Date
}

export type ChatDbClient = {
  conversation: {
    create: (args: unknown) => Promise<ChatConversationRecord>
    findFirst: (args: unknown) => Promise<ChatConversationRecord | null>
    findMany: (args: unknown) => Promise<ChatConversationRecord[]>
    update: (args: unknown) => Promise<ChatConversationRecord>
  }
  message: {
    create: (args: unknown) => Promise<ChatMessageRecord>
    findUnique: (args: unknown) => Promise<ChatMessageRecord | null>
    findFirst: (args: unknown) => Promise<ChatMessageRecord | null>
    findMany: (args: unknown) => Promise<ChatMessageRecord[]>
    update: (args: unknown) => Promise<ChatMessageRecord>
  }
  chatConsent: {
    create: (args: unknown) => Promise<ChatConsentRecord>
    findFirst: (args: unknown) => Promise<ChatConsentRecord | null>
    findMany: (args: unknown) => Promise<ChatConsentRecord[]>
    update: (args: unknown) => Promise<ChatConsentRecord>
  }
  chatUsage: {
    create: (args: unknown) => Promise<ChatUsageRecord>
  }
}

type ConversationListFilter = {
  userId: string
  cursor?: string
  limit?: number
  pinned?: boolean
  query?: string
  archived?: boolean
  includeDeleted?: boolean
}

type CreateConversationInput = {
  userId: string
  title: string
  summary?: string | null
  pinned?: boolean
}

type CreateMessageInput = {
  conversationId: string
  userId: string
  role: ChatRole
  content: string
  status?: MessageStatus
  clientRequestId?: string | null
  parentMessageId?: string | null
  model?: string | null
  finishReason?: string | null
  inputTokens?: number | null
  outputTokens?: number | null
  estimatedCostUsd?: number | null
}

type CreateConsentInput = {
  userId: string
  scope: ChatConsentScope
  policyVersion: string
  grantedAt?: Date
  uiVersion?: string | null
}

type CreateUsageInput = {
  userId: string
  conversationId: string
  messageId?: string | null
  requestId?: string | null
  model: string
  outcome: ChatUsageOutcome
  latencyMs?: number | null
  inputTokens?: number | null
  outputTokens?: number | null
  estimatedCostUsd?: number | null
}

type UpdateConversationInput = {
  title?: string
  pinned?: boolean
  archived?: boolean
}

type MessageListInput = {
  userId: string
  conversationId: string
  cursor?: string
  limit?: number
}

type UpdateMessageInput = {
  content?: string
  status?: MessageStatus
  model?: string | null
  finishReason?: string | null
  inputTokens?: number | null
  outputTokens?: number | null
  estimatedCostUsd?: number | null
}

function activeConversationWhere(userId: string, conversationId: string) {
  return {
    id: conversationId,
    userId,
    deletedAt: null,
  }
}

export async function createConversation(db: ChatDbClient, input: CreateConversationInput) {
  return db.conversation.create({
    data: {
      userId: input.userId,
      title: input.title.trim(),
      summary: input.summary ?? null,
      pinned: input.pinned ?? false,
    },
  })
}

export async function getConversationById(db: ChatDbClient, userId: string, conversationId: string) {
  return db.conversation.findFirst({
    where: activeConversationWhere(userId, conversationId),
  })
}

export async function listConversationsForUser(
  db: ChatDbClient,
  filter: ConversationListFilter,
) {
  const limit = Math.max(1, Math.min(filter.limit ?? 20, 50))
  const rows = await db.conversation.findMany({
    where: {
      userId: filter.userId,
      archivedAt: filter.archived === undefined ? undefined : filter.archived ? { not: null } : null,
      pinned: filter.pinned,
      deletedAt: filter.includeDeleted ? undefined : null,
      OR: filter.query
        ? [
            { title: { contains: filter.query } },
            {
              messages: {
                some: {
                  role: "user",
                  content: { contains: filter.query },
                },
              },
            },
          ]
        : undefined,
    },
    cursor: filter.cursor ? { id: filter.cursor } : undefined,
    skip: filter.cursor ? 1 : 0,
    take: limit + 1,
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
  })

  return {
    items: rows.slice(0, limit),
    nextCursor: rows.length > limit ? rows[limit]?.id ?? null : null,
  }
}

export async function createMessage(db: ChatDbClient, input: CreateMessageInput) {
  return db.message.create({
    data: {
      conversationId: input.conversationId,
      userId: input.userId,
      role: input.role,
      content: input.content,
      status: input.status ?? "pending",
      clientRequestId: input.clientRequestId ?? null,
      parentMessageId: input.parentMessageId ?? null,
      model: input.model ?? null,
      finishReason: input.finishReason ?? null,
      inputTokens: input.inputTokens ?? null,
      outputTokens: input.outputTokens ?? null,
      estimatedCostUsd: input.estimatedCostUsd ?? null,
    },
  })
}

export async function getMessageByClientRequestId(
  db: ChatDbClient,
  userId: string,
  clientRequestId: string,
) {
  return db.message.findUnique({
    where: {
      userId_clientRequestId: {
        userId,
        clientRequestId,
      },
    },
  })
}

export async function getMessageById(
  db: ChatDbClient,
  userId: string,
  messageId: string,
  conversationId?: string,
) {
  return db.message.findFirst({
    where: {
      id: messageId,
      userId,
      conversationId,
    },
  })
}

export async function listMessagesForConversation(db: ChatDbClient, input: MessageListInput) {
  const limit = Math.max(1, Math.min(input.limit ?? 50, 100))
  const rows = await db.message.findMany({
    where: {
      conversationId: input.conversationId,
      userId: input.userId,
      conversation: {
        deletedAt: null,
      },
    },
    cursor: input.cursor ? { id: input.cursor } : undefined,
    skip: input.cursor ? 1 : 0,
    take: limit + 1,
    orderBy: { createdAt: "asc" },
  })

  return {
    items: rows.slice(0, limit),
    nextCursor: rows.length > limit ? rows[limit]?.id ?? null : null,
  }
}

export async function listRecentMessagesForConversation(
  db: ChatDbClient,
  userId: string,
  conversationId: string,
  limit = 12,
) {
  const rows = await db.message.findMany({
    where: {
      conversationId,
      userId,
      conversation: {
        deletedAt: null,
      },
      status: {
        in: ["complete", "streaming", "stopped"],
      },
    },
    orderBy: { createdAt: "desc" },
    take: Math.max(1, Math.min(limit, 20)),
  })

  return rows.reverse()
}

export async function getAssistantMessageForUserMessage(
  db: ChatDbClient,
  userId: string,
  conversationId: string,
  userMessageId: string,
) {
  return db.message.findFirst({
    where: {
      userId,
      conversationId,
      parentMessageId: userMessageId,
      role: "assistant",
    },
    orderBy: { createdAt: "desc" },
  })
}

export async function updateMessage(
  db: ChatDbClient,
  userId: string,
  messageId: string,
  input: UpdateMessageInput,
) {
  const current = await db.message.findFirst({
    where: {
      id: messageId,
      userId,
    },
  })

  if (!current) {
    return null
  }

  return db.message.update({
    where: { id: messageId },
    data: {
      content: input.content,
      status: input.status,
      model: input.model,
      finishReason: input.finishReason,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      estimatedCostUsd: input.estimatedCostUsd,
    },
  })
}

export async function grantChatConsent(db: ChatDbClient, input: CreateConsentInput) {
  return db.chatConsent.create({
    data: {
      userId: input.userId,
      scope: input.scope,
      policyVersion: input.policyVersion,
      grantedAt: input.grantedAt ?? new Date(),
      uiVersion: input.uiVersion ?? null,
    },
  })
}

export async function revokeChatConsent(
  db: ChatDbClient,
  userId: string,
  scope: ChatConsentScope,
  policyVersion: string,
  revokedAt = new Date(),
) {
  const activeConsent = await db.chatConsent.findFirst({
    where: {
      userId,
      scope,
      policyVersion,
      revokedAt: null,
    },
    orderBy: { grantedAt: "desc" },
  })

  if (!activeConsent) {
    return null
  }

  return db.chatConsent.update({
    where: { id: activeConsent.id },
    data: { revokedAt },
  })
}

export async function getActiveChatConsent(
  db: ChatDbClient,
  userId: string,
  scope: ChatConsentScope,
  policyVersion: string,
) {
  return db.chatConsent.findFirst({
    where: {
      userId,
      scope,
      policyVersion,
      revokedAt: null,
    },
    orderBy: { grantedAt: "desc" },
  })
}

export async function listActiveChatConsents(db: ChatDbClient, userId: string, policyVersion: string) {
  return db.chatConsent.findMany({
    where: {
      userId,
      policyVersion,
      revokedAt: null,
    },
    orderBy: [{ scope: "asc" }, { grantedAt: "desc" }],
  })
}

export async function updateConversation(
  db: ChatDbClient,
  userId: string,
  conversationId: string,
  input: UpdateConversationInput,
) {
  const current = await getConversationById(db, userId, conversationId)
  if (!current) {
    return null
  }

  return db.conversation.update({
    where: { id: conversationId },
    data: {
      title: input.title?.trim(),
      pinned: input.pinned,
      archivedAt: input.archived === undefined ? undefined : input.archived ? new Date() : null,
    },
  })
}

export async function touchConversation(db: ChatDbClient, userId: string, conversationId: string, title?: string) {
  const current = await getConversationById(db, userId, conversationId)
  if (!current) {
    return null
  }

  return db.conversation.update({
    where: { id: conversationId },
    data: {
      title: title?.trim() || undefined,
    },
  })
}

export async function softDeleteConversation(db: ChatDbClient, userId: string, conversationId: string) {
  const current = await getConversationById(db, userId, conversationId)
  if (!current) {
    return false
  }

  await db.conversation.update({
    where: { id: conversationId },
    data: {
      deletedAt: new Date(),
    },
  })

  return true
}

export async function createChatUsage(db: ChatDbClient, input: CreateUsageInput) {
  return db.chatUsage.create({
    data: {
      userId: input.userId,
      conversationId: input.conversationId,
      messageId: input.messageId ?? null,
      requestId: input.requestId ?? null,
      model: input.model,
      outcome: input.outcome,
      latencyMs: input.latencyMs ?? null,
      inputTokens: input.inputTokens ?? null,
      outputTokens: input.outputTokens ?? null,
      estimatedCostUsd: input.estimatedCostUsd ?? null,
    },
  })
}
