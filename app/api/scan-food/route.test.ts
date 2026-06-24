import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { POST } from "./route"

const validImage = "data:image/png;base64,aGVsbG8="

function createJsonRequest(body: unknown) {
  return new Request("http://localhost/api/scan-food", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>
}

describe("scan-food route", () => {
  const originalApiKey = process.env.QWEN_API_KEY

  beforeEach(() => {
    process.env.QWEN_API_KEY = "test-key"
    vi.restoreAllMocks()
  })

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.QWEN_API_KEY
    } else {
      process.env.QWEN_API_KEY = originalApiKey
    }
  })

  it("rejects requests without a configured API key", async () => {
    delete process.env.QWEN_API_KEY

    const response = await POST(createJsonRequest({ image: validImage }))
    const body = await readJson(response)

    expect(response.status).toBe(500)
    expect(body.error).toContain("QWEN_API_KEY")
  })

  it("rejects non-image data URLs without calling upstream", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")

    const response = await POST(createJsonRequest({ image: "data:text/plain;base64,aGVsbG8=" }))
    const body = await readJson(response)

    expect(response.status).toBe(400)
    expect(body.error).toBe("กรุณาส่งไฟล์รูปภาพอาหารเป็น PNG, JPG, WEBP หรือ HEIC")
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("returns normalized analysis for a valid upstream response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  isFood: true,
                  reason: "",
                  name: "ข้าวไข่เจียว",
                  calories: 480,
                  protein: 18,
                  carbs: 52,
                  fat: 20,
                  confidence: 120,
                  note: "โปรตีนพอใช้",
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    )

    const response = await POST(createJsonRequest({ image: validImage }))
    const body = await readJson(response)

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      isFood: true,
      name: "ข้าวไข่เจียว",
      calories: 480,
      protein: 18,
      carbs: 52,
      fat: 20,
      confidence: 100,
      note: "โปรตีนพอใช้",
    })
  })

  it("does not expose raw upstream payloads on parse errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: "not-json",
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    )

    const response = await POST(createJsonRequest({ image: validImage }))
    const body = await readJson(response)

    expect(response.status).toBe(502)
    expect(body.error).toBe("อ่านผลลัพธ์จาก qwen/qwen3.7-plus ไม่สำเร็จ")
    expect(body.rawPreview).toBeUndefined()
    expect(body.detail).toBeUndefined()
  })
})
