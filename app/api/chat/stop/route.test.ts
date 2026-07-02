import { beforeEach, describe, expect, it, vi } from "vitest"

const { requireUser, getConversationById, getMessageById, updateMessage, stopActiveChat } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  getConversationById: vi.fn(),
  getMessageById: vi.fn(),
  updateMessage: vi.fn(),
  stopActiveChat: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  requireUser,
}))

vi.mock("@/lib/db", () => ({
  prisma: {},
}))

vi.mock("@/lib/chat/repository", () => ({
  getConversationById,
  getMessageById,
  updateMessage,
}))

vi.mock("@/lib/chat/runtime", () => ({
  stopActiveChat,
}))

import { POST } from "./route"

describe("chat stop route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireUser.mockResolvedValue({ id: "user-1" })
  })

  it("rejects invalid payloads", async () => {
    const response = await POST(
      new Request("http://localhost/api/chat/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: "conversation-1" }),
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
      },
    })
  })

  it("marks a streaming assistant message as stopped", async () => {
    getConversationById.mockResolvedValue({ id: "conversation-1" })
    getMessageById.mockResolvedValue({ id: "assistant-1", role: "assistant", status: "streaming" })
    stopActiveChat.mockReturnValue(true)
    updateMessage.mockResolvedValue({})

    const response = await POST(
      new Request("http://localhost/api/chat/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: "conversation-1", assistantMessageId: "assistant-1" }),
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ ok: true, status: "stopped" })
    expect(updateMessage).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "assistant-1",
      expect.objectContaining({
        status: "stopped",
        finishReason: "stop",
      }),
    )
  })
})
