// @vitest-environment node

import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"
import { createRequire } from "node:module"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
  type ChatDbClient,
  createChatUsage,
  createConversation,
  createMessage,
  getActiveChatConsent,
  getConversationById,
  getMessageByClientRequestId,
  grantChatConsent,
  listConversationsForUser,
  listMessagesForConversation,
  revokeChatConsent,
} from "./repository"

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const require = createRequire(import.meta.url)
const { PrismaClient } = require("@prisma/client") as {
  PrismaClient: new (options?: { datasources?: { db?: { url?: string } } }) => ChatDbClient & {
    $connect: () => Promise<void>
    $disconnect: () => Promise<void>
    user: {
      create: (args: unknown) => Promise<unknown>
    }
    conversation: ChatDbClient["conversation"] & {
      delete: (args: unknown) => Promise<unknown>
    }
    message: ChatDbClient["message"] & {
      count: (args?: unknown) => Promise<number>
    }
    chatUsage: ChatDbClient["chatUsage"] & {
      count: (args?: unknown) => Promise<number>
    }
  }
}

type TestContext = {
  dbDir: string
  dbPath: string
  prisma: InstanceType<typeof PrismaClient>
}

async function createTestContext(): Promise<TestContext> {
  const dbDir = mkdtempSync(join(tmpdir(), "scanzapp-chat-"))
  const dbPath = join(dbDir, "test.db")
  const init = spawnSync(process.execPath, [join(rootDir, "scripts", "db-migrate.mjs")], {
    env: { ...process.env, SQLITE_DATABASE_PATH: dbPath },
    stdio: ["ignore", "ignore", "pipe"],
  })

  if (init.status !== 0) {
    throw new Error(`SQLite migration failed: ${init.stderr.toString()}`)
  }

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: `file:${dbPath}`,
      },
    },
  })

  await prisma.$connect()

  return { dbDir, dbPath, prisma }
}

async function seedUser(prisma: InstanceType<typeof PrismaClient>, userId: string, email: string) {
  return prisma.user.create({
    data: {
      id: userId,
      name: email.split("@")[0] ?? userId,
      email,
      passwordHash: "pbkdf2$1$salt$hash",
      role: "user",
    },
  })
}

describe("chat repository persistence", () => {
  let context: TestContext

  beforeEach(async () => {
    context = await createTestContext()
  })

  afterEach(async () => {
    await context.prisma.$disconnect()
    rmSync(context.dbDir, { recursive: true, force: true })
  })

  it("isolates conversations and messages by user ownership", async () => {
    const { prisma } = context
    await seedUser(prisma, "user-1", "one@example.com")
    await seedUser(prisma, "user-2", "two@example.com")

    const conversation = await createConversation(prisma, {
      userId: "user-1",
      title: "แผนอาหารวันนี้",
    })

    await createMessage(prisma, {
      conversationId: conversation.id,
      userId: "user-1",
      role: "user",
      content: "ช่วยสรุปอาหารวันนี้",
      clientRequestId: "req-1",
    })

    expect(await getConversationById(prisma, "user-1", conversation.id)).toMatchObject({
      id: conversation.id,
      userId: "user-1",
    })
    expect(await getConversationById(prisma, "user-2", conversation.id)).toBeNull()
    expect(await listConversationsForUser(prisma, { userId: "user-2" })).toEqual({
      items: [],
      nextCursor: null,
    })
    expect(
      await listMessagesForConversation(prisma, {
        userId: "user-2",
        conversationId: conversation.id,
      }),
    ).toEqual({
      items: [],
      nextCursor: null,
    })
  })

  it("enforces idempotent lookup by user-scoped client request id", async () => {
    const { prisma } = context
    await seedUser(prisma, "user-1", "one@example.com")
    await seedUser(prisma, "user-2", "two@example.com")

    const one = await createConversation(prisma, { userId: "user-1", title: "one" })
    const two = await createConversation(prisma, { userId: "user-2", title: "two" })

    await createMessage(prisma, {
      conversationId: one.id,
      userId: "user-1",
      role: "user",
      content: "hello",
      clientRequestId: "same-request",
    })

    await createMessage(prisma, {
      conversationId: two.id,
      userId: "user-2",
      role: "user",
      content: "world",
      clientRequestId: "same-request",
    })

    const duplicateAttempt = createMessage(prisma, {
      conversationId: one.id,
      userId: "user-1",
      role: "assistant",
      content: "duplicate",
      clientRequestId: "same-request",
    })

    await expect(duplicateAttempt).rejects.toMatchObject({
      code: "P2002",
    })

    expect(await getMessageByClientRequestId(prisma, "user-1", "same-request")).toMatchObject({
      content: "hello",
    })
    expect(await getMessageByClientRequestId(prisma, "user-2", "same-request")).toMatchObject({
      content: "world",
    })
  })

  it("cascades messages and usage when a conversation is deleted", async () => {
    const { prisma } = context
    await seedUser(prisma, "user-1", "one@example.com")

    const conversation = await createConversation(prisma, {
      userId: "user-1",
      title: "cascade",
    })

    const message = await createMessage(prisma, {
      conversationId: conversation.id,
      userId: "user-1",
      role: "assistant",
      content: "ผลลัพธ์",
      status: "complete",
    })

    await createChatUsage(prisma, {
      userId: "user-1",
      conversationId: conversation.id,
      messageId: message.id,
      requestId: "req-cascade",
      model: "test-model",
      outcome: "success",
      inputTokens: 12,
      outputTokens: 34,
    })

    await prisma.conversation.delete({
      where: { id: conversation.id },
    })

    expect(await prisma.message.count()).toBe(0)
    expect(await prisma.chatUsage.count()).toBe(0)
  })

  it("tracks active consent and revocation per user, scope, and policy version", async () => {
    const { prisma } = context
    await seedUser(prisma, "user-1", "one@example.com")
    await seedUser(prisma, "user-2", "two@example.com")

    const firstGrant = await grantChatConsent(prisma, {
      userId: "user-1",
      scope: "ai_chat_basic",
      policyVersion: "2026-06",
      grantedAt: new Date("2026-06-28T10:00:00.000Z"),
      uiVersion: "chat-v1",
    })

    expect(await getActiveChatConsent(prisma, "user-1", "ai_chat_basic", "2026-06")).toMatchObject({
      id: firstGrant.id,
      revokedAt: null,
    })

    await revokeChatConsent(prisma, "user-1", "ai_chat_basic", "2026-06", new Date("2026-06-28T11:00:00.000Z"))

    expect(await getActiveChatConsent(prisma, "user-1", "ai_chat_basic", "2026-06")).toBeNull()

    await grantChatConsent(prisma, {
      userId: "user-2",
      scope: "ai_chat_basic",
      policyVersion: "2026-06",
    })

    expect(await getActiveChatConsent(prisma, "user-2", "ai_chat_basic", "2026-06")).not.toBeNull()
    expect(await getActiveChatConsent(prisma, "user-1", "ai_chat_basic", "2026-06")).toBeNull()
  })
})
