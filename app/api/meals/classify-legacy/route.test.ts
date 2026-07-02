import { beforeEach, describe, expect, it, vi } from "vitest"

const { requireUser, classifyLegacyMeals, findMany, updateMany, count, transaction } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  classifyLegacyMeals: vi.fn(),
  findMany: vi.fn(),
  updateMany: vi.fn(),
  count: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({ requireUser }))
vi.mock("@/lib/ai/meal-classification", () => ({ classifyLegacyMeals }))
vi.mock("@/lib/ai/provider", () => ({ defaultAiModel: "qwen/test" }))
vi.mock("@/lib/db", () => ({
  prisma: {
    meal: { findMany, updateMany, count },
    $transaction: transaction,
  },
}))

import { POST } from "./route"

describe("classify legacy meals route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.QWEN_API_KEY = "test-key"
    requireUser.mockResolvedValue({ id: "user-1" })
    transaction.mockResolvedValue([])
    count.mockResolvedValue(0)
    updateMany.mockImplementation((args) => args)
  })

  it("skips AI when every meal already has a category", async () => {
    findMany.mockResolvedValue([])

    const response = await POST()

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ updated: 0, remaining: 0 })
    expect(classifyLegacyMeals).not.toHaveBeenCalled()
  })

  it("classifies only uncategorized meals and maps off-hours main meals to special", async () => {
    findMany.mockResolvedValue([
      { id: "meal-1", name: "กล้วย", calories: 90, protein: 1, carbs: 23, fat: 0, time: "08:00" },
      { id: "meal-2", name: "ข้าวต้ม", calories: 320, protein: 12, carbs: 50, fat: 8, time: "23:00" },
    ])
    classifyLegacyMeals.mockResolvedValue([
      { id: "meal-1", mealKind: "snack" },
      { id: "meal-2", mealKind: "main_meal" },
    ])

    const response = await POST()

    expect(response.status).toBe(200)
    expect(updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: "meal-1", userId: "user-1", mealCategory: null },
      data: { mealCategory: "snack" },
    })
    expect(updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: "meal-2", userId: "user-1", mealCategory: null },
      data: { mealCategory: "special" },
    })
    expect(transaction).toHaveBeenCalledTimes(1)
  })
})
