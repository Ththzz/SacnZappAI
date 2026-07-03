import { beforeEach, describe, expect, it, vi } from "vitest"

const { requireUser, listConversationsForUser, listMessagesForConversation, createConversation } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  listConversationsForUser: vi.fn(),
  listMessagesForConversation: vi.fn(),
  createConversation: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  requireUser,
}))

vi.mock("@/lib/db", () => ({
  prisma: {},
}))

vi.mock("@/lib/chat/repository", () => ({
  listConversationsForUser,
  listMessagesForConversation,
  createConversation,
}))

import { GET, POST } from "./route"

describe("chat conversations route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("rejects invalid status filters with shared validation error shape", async () => {
    requireUser.mockResolvedValue({ id: "user-1" })

    const response = await GET(
      new Request("http://localhost/api/chat/conversations?status=wrong"),
    )
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
        message: "ค่า status ไม่ถูกต้อง",
      },
    })
    expect(listConversationsForUser).not.toHaveBeenCalled()
  })

  it("creates a conversation with a bounded title", async () => {
    requireUser.mockResolvedValue({ id: "user-1" })
    createConversation.mockResolvedValue({
      id: "conversation-1",
      title: "แชตใหม่",
      pinned: false,
      archivedAt: null,
      updatedAt: new Date("2026-06-28T00:00:00.000Z"),
    })

    const response = await POST(
      new Request("http://localhost/api/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "แชตใหม่" }),
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(createConversation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: "user-1",
        title: "แชตใหม่",
      }),
    )
    expect(body).toMatchObject({
      id: "conversation-1",
      title: "แชตใหม่",
    })
  })

  it("includes the first conversation messages in the initial list request", async () => {
    requireUser.mockResolvedValue({ id: "user-1" })
    listConversationsForUser.mockResolvedValue({
      items: [{
        id: "conversation-1",
        title: "มื้อเย็น",
        summary: "คุยเรื่องมื้อเย็น",
        pinned: false,
        archivedAt: null,
        updatedAt: new Date("2026-06-28T00:00:00.000Z"),
      }],
      nextCursor: null,
    })
    listMessagesForConversation.mockResolvedValue({
      items: [{
        id: "message-1",
        role: "user",
        content: "กินอะไรดี",
        status: "complete",
        parentMessageId: null,
        clientRequestId: null,
        model: null,
        finishReason: null,
        createdAt: new Date("2026-06-28T00:00:00.000Z"),
        updatedAt: new Date("2026-06-28T00:00:00.000Z"),
      }],
      nextCursor: null,
    })

    const response = await GET(
      new Request("http://localhost/api/chat/conversations?status=active&includeFirst=true"),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(listMessagesForConversation).toHaveBeenCalledTimes(1)
    expect(body.initialConversation).toMatchObject({
      conversation: { id: "conversation-1" },
      messages: [{ id: "message-1", content: "กินอะไรดี" }],
    })
  })
})
