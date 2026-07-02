import { afterEach, describe, expect, it, vi } from "vitest"

import { AiProviderError, requestAiChat } from "./provider"

function streamResponse(chunks: string[]) {
  const encoder = new TextEncoder()
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
        controller.close()
      },
    }),
    { status: 200, headers: { "Content-Type": "text/event-stream" } },
  )
}

describe("requestAiChat streaming", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("forwards provider deltas as soon as they arrive and assembles the result", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      streamResponse([
        'data: {"choices":[{"delta":{"content":"สวัสดี"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"ครับ"},"finish_reason":"stop"}],"usage":{"prompt_tokens":4,"completion_tokens":2}}\n\n',
        "data: [DONE]\n\n",
      ]),
    )
    const deltas: string[] = []

    const result = await requestAiChat({
      apiKey: "test-key",
      model: "qwen/test",
      messages: [{ role: "user", content: "hello" }],
      onDelta: (text) => deltas.push(text),
    })

    expect(deltas).toEqual(["สวัสดี", "ครับ"])
    expect(result.text).toBe("สวัสดีครับ")
    expect(result.finishReason).toBe("stop")
    expect(result.usage).toEqual({ inputTokens: 4, outputTokens: 2 })
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      stream: true,
    })
  })

  it("retries a transient provider error before any content is streamed", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response('{"error":{"message":"overloaded"}}', { status: 503 }))
      .mockResolvedValueOnce(
        streamResponse([
          'data: {"choices":[{"delta":{"content":"พร้อมแล้ว"},"finish_reason":"stop"}]}\n\n',
          "data: [DONE]\n\n",
        ]),
      )

    const result = await requestAiChat({
      apiKey: "test-key",
      messages: [{ role: "user", content: "hello" }],
      timeoutMs: 5_000,
      onDelta: vi.fn(),
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.text).toBe("พร้อมแล้ว")
  })

  it("does not retry after a partial answer to avoid duplicated text", async () => {
    const encoder = new TextEncoder()
    let pullCount = 0
    const partialResponse = new Response(
      new ReadableStream({
        pull(controller) {
          pullCount += 1
          if (pullCount === 1) {
            controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"บางส่วน"}}]}\n\n'))
          } else {
            controller.error(new Error("connection lost"))
          }
        },
      }),
      { status: 200 },
    )
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(partialResponse)

    await expect(
      requestAiChat({
        apiKey: "test-key",
        messages: [{ role: "user", content: "hello" }],
        onDelta: vi.fn(),
      }),
    ).rejects.toBeInstanceOf(AiProviderError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
