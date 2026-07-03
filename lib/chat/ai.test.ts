import { afterEach, describe, expect, it, vi } from "vitest"

const { requestAiChat } = vi.hoisted(() => ({
  requestAiChat: vi.fn(),
}))

vi.mock("@/lib/ai/provider", () => ({
  AiProviderError: class AiProviderError extends Error {
    status = 502
    retryable = false
  },
  requestAiChat,
}))

import { requestChatCompletion } from "./ai"

describe("chat AI model selection", () => {
  afterEach(() => {
    vi.clearAllMocks()
    delete process.env.CHAT_AI_MODEL
  })

  it("uses GPT-4o mini as the chatbot default", async () => {
    delete process.env.CHAT_AI_MODEL
    requestAiChat.mockResolvedValue({
      text: "สวัสดีครับ",
      model: "openai/gpt-4o-mini",
      finishReason: "stop",
      usage: { inputTokens: 4, outputTokens: 2 },
    })

    await requestChatCompletion({
      apiKey: "test-key",
      messages: [{ role: "user", content: "สวัสดี" }],
    })

    expect(requestAiChat).toHaveBeenCalledWith(expect.objectContaining({
      model: "openai/gpt-4o-mini",
      maxTokens: 700,
    }))
  })
})
