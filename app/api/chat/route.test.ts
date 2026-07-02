import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const {
  requireUser,
  requestChatCompletion,
  getActiveChatConsent,
  getMessageByClientRequestId,
  getAssistantMessageForUserMessage,
  getConversationById,
  createConversation,
  listRecentMessagesForConversation,
  createMessage,
  updateMessage,
  createChatUsage,
  touchConversation,
} = vi.hoisted(() => ({
  requireUser: vi.fn(),
  requestChatCompletion: vi.fn(),
  getActiveChatConsent: vi.fn(),
  getMessageByClientRequestId: vi.fn(),
  getAssistantMessageForUserMessage: vi.fn(),
  getConversationById: vi.fn(),
  createConversation: vi.fn(),
  listRecentMessagesForConversation: vi.fn(),
  createMessage: vi.fn(),
  updateMessage: vi.fn(),
  createChatUsage: vi.fn(),
  touchConversation: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  requireUser,
}))

vi.mock("@/lib/db", () => ({
  prisma: {},
}))

vi.mock("@/lib/chat/ai", async () => {
  const actual = await vi.importActual<typeof import("@/lib/chat/ai")>("@/lib/chat/ai")
  return {
    ...actual,
    requestChatCompletion,
  }
})

vi.mock("@/lib/chat/repository", () => ({
  getActiveChatConsent,
  getMessageByClientRequestId,
  getAssistantMessageForUserMessage,
  getConversationById,
  createConversation,
  listRecentMessagesForConversation,
  createMessage,
  updateMessage,
  createChatUsage,
  touchConversation,
}))

import { POST } from "./route"

async function readText(response: Response) {
  return await response.text()
}

describe("chat route", () => {
  const originalApiKey = process.env.QWEN_API_KEY

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.QWEN_API_KEY = "test-key"
    requireUser.mockResolvedValue({ id: "user-1" })
    getMessageByClientRequestId.mockResolvedValue(null)
    getActiveChatConsent.mockResolvedValue({ id: "consent-1" })
    listRecentMessagesForConversation.mockResolvedValue([])
    touchConversation.mockResolvedValue({})
  })

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.QWEN_API_KEY
    } else {
      process.env.QWEN_API_KEY = originalApiKey
    }
  })

  it("rejects requests when chat consent is missing", async () => {
    getActiveChatConsent.mockResolvedValue(null)

    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "สรุปอาหารวันนี้", clientRequestId: "req-1" }),
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body).toMatchObject({
      error: {
        code: "CONSENT_REQUIRED",
      },
    })
  })

  it("streams meta delta and done events for a successful request", async () => {
    createConversation.mockResolvedValue({ id: "conversation-1" })
    createMessage
      .mockResolvedValueOnce({ id: "user-message-1", conversationId: "conversation-1" })
      .mockResolvedValueOnce({ id: "assistant-message-1" })
    requestChatCompletion.mockImplementation(
      async ({ onDelta }: { onDelta?: (text: string) => void }) => {
        onDelta?.("ลองเพิ่มผักอีก 1 อย่างในมื้อนี้ครับ")
        return {
          text: "ลองเพิ่มผักอีก 1 อย่างในมื้อนี้ครับ",
          model: "qwen/test",
          finishReason: "stop",
          usage: { inputTokens: 12, outputTokens: 24 },
        }
      },
    )

    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "สรุปอาหารวันนี้", clientRequestId: "req-1" }),
      }),
    )
    const body = await readText(response)

    expect(response.headers.get("Content-Type")).toContain("text/event-stream")
    expect(body).toContain("event: meta")
    expect(body).toContain("\"conversationId\":\"conversation-1\"")
    expect(body).toContain("event: delta")
    expect(body).toContain("ลองเพิ่มผักอีก 1 อย่างในมื้อนี้ครับ")
    expect(body).toContain("event: done")
    expect(updateMessage).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "assistant-message-1",
      expect.objectContaining({
        status: "complete",
        model: "qwen/test",
      }),
    )
    expect(createChatUsage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        conversationId: "conversation-1",
        outcome: "success",
      }),
    )
  })

  it("replays existing assistant output when clientRequestId is duplicated", async () => {
    getMessageByClientRequestId.mockResolvedValue({
      id: "user-message-1",
      conversationId: "conversation-1",
      inputTokens: null,
      outputTokens: null,
    })
    getAssistantMessageForUserMessage.mockResolvedValue({
      id: "assistant-message-1",
      content: "คำตอบเดิม",
      finishReason: "stop",
      inputTokens: 3,
      outputTokens: 5,
    })

    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "สรุปอาหารวันนี้", clientRequestId: "req-1" }),
      }),
    )
    const body = await readText(response)

    expect(response.headers.get("Content-Type")).toContain("text/event-stream")
    expect(body).toContain("\"replayed\":true")
    expect(body).toContain("คำตอบเดิม")
    expect(requestChatCompletion).not.toHaveBeenCalled()
  })
})
