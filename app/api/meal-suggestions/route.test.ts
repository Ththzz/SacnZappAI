import { beforeEach, describe, expect, it, vi } from "vitest"

const { requireUser, requestAiChat, findMeals, findCache, upsertCache, findSettings, afterTasks } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  requestAiChat: vi.fn(),
  findMeals: vi.fn(),
  findCache: vi.fn(),
  upsertCache: vi.fn(),
  findSettings: vi.fn(),
  afterTasks: [] as (() => Promise<void> | void)[],
}))

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>()
  return {
    ...actual,
    after: vi.fn((task: () => Promise<void> | void) => afterTasks.push(task)),
  }
})
vi.mock("@/lib/auth", () => ({ requireUser }))
vi.mock("@/lib/ai/provider", () => ({
  AiProviderError: class AiProviderError extends Error {},
  defaultAiModel: "qwen/test",
  requestAiChat,
}))
vi.mock("@/lib/db", () => ({
  prisma: {
    meal: { findMany: findMeals },
    mealSuggestionCache: { findUnique: findCache, upsert: upsertCache },
    userSettings: { findUnique: findSettings },
  },
}))

import { GET, POST } from "./route"

const meals = [
  {
    id: "meal-1",
    date: "2026-06-29",
    time: "12:00",
    name: "ข้าวไก่",
    calories: 450,
    protein: 25,
    carbs: 55,
    fat: 12,
  },
]

const suggestions = [
  {
    id: "suggestion-1",
    name: "สลัดอกไก่",
    calories: 320,
    protein: 30,
    carbs: 20,
    fat: 10,
    reason: "เพิ่มโปรตีน",
  },
]

describe("meal suggestions cache", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    afterTasks.length = 0
    process.env.QWEN_API_KEY = "test-key"
    requireUser.mockResolvedValue({ id: "user-1" })
    findMeals.mockResolvedValue(meals)
    findSettings.mockResolvedValue({ settingsJson: JSON.stringify({ healthGoal: { dailyCalories: 1800 } }) })
    upsertCache.mockResolvedValue({})
  })

  it("returns today's cache without calling AI", async () => {
    findCache.mockResolvedValue({
      userId: "user-1",
      suggestionsJson: JSON.stringify(suggestions),
      generatedAt: new Date(),
    })

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.source).toBe("cache")
    expect(body.suggestions).toEqual(suggestions)
    expect(requestAiChat).not.toHaveBeenCalled()
  })

  it("returns an older cache immediately without blocking GET on AI", async () => {
    findCache.mockResolvedValue({
      userId: "user-1",
      suggestionsJson: JSON.stringify(suggestions),
      generatedAt: new Date(2020, 0, 1),
    })

    const response = await GET()
    const body = await response.json()

    expect(body.source).toBe("cache-stale")
    expect(body.isStale).toBe(true)
    expect(body.refreshing).toBe(true)
    expect(body.suggestions).toEqual(suggestions)
    expect(requestAiChat).not.toHaveBeenCalled()
    expect(afterTasks).toHaveLength(1)

    requestAiChat.mockResolvedValue({
      text: JSON.stringify([
        { name: "ต้มยำปลา", calories: 280, protein: 26, carbs: 12, fat: 8, reason: "โปรตีนสูง" },
      ]),
    })
    await afterTasks[0]()
  })

  it("returns immediately from POST and updates the cache in the background", async () => {
    findCache.mockResolvedValue({
      userId: "user-1",
      suggestionsJson: JSON.stringify(suggestions),
      generatedAt: new Date(),
    })
    requestAiChat.mockResolvedValue({
      text: JSON.stringify([
        { name: "ต้มยำปลา", calories: 280, protein: 26, carbs: 12, fat: 8, reason: "โปรตีนสูง" },
      ]),
    })

    const response = await POST()
    const body = await response.json()

    expect(response.status).toBe(202)
    expect(body.source).toBe("cache")
    expect(body.refreshing).toBe(true)
    expect(body.suggestions).toEqual(suggestions)
    expect(requestAiChat).not.toHaveBeenCalled()

    await afterTasks[0]()

    expect(requestAiChat).toHaveBeenCalledTimes(1)
    expect(requestAiChat).toHaveBeenCalledWith(expect.objectContaining({
      timeoutMs: 12_000,
      maxTokens: 320,
    }))
    expect(upsertCache).toHaveBeenCalledTimes(1)
  })

  it("falls back to stale cache when AI refresh fails", async () => {
    findCache.mockResolvedValue({
      userId: "user-1",
      suggestionsJson: JSON.stringify(suggestions),
      generatedAt: new Date(2020, 0, 1),
    })
    requestAiChat.mockRejectedValue(new Error("AI unavailable"))

    const response = await POST()
    const body = await response.json()
    await afterTasks[0]()

    expect(response.status).toBe(202)
    expect(body.source).toBe("cache-stale")
    expect(body.isStale).toBe(true)
    expect(body.refreshing).toBe(true)
    expect(body.suggestions).toEqual(suggestions)
  })

  it("returns fallback suggestions when AI refresh fails without cache", async () => {
    findCache.mockResolvedValue(null)
    requestAiChat.mockRejectedValue(new Error("AI unavailable"))

    const response = await POST()
    const body = await response.json()
    await afterTasks[0]()

    expect(response.status).toBe(202)
    expect(body.source).toBe("fallback")
    expect(body.refreshing).toBe(true)
    expect(body.suggestions).toHaveLength(3)
  })
})
