import { beforeEach, describe, expect, it, vi } from "vitest"

const { requireUser, deleteMany, findFirst, createMeal, deleteSaved, transaction } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  deleteMany: vi.fn(),
  findFirst: vi.fn(),
  createMeal: vi.fn(),
  deleteSaved: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({ requireUser }))
vi.mock("@/lib/db", () => ({
  prisma: {
    savedMealSuggestion: {
      deleteMany,
      findFirst,
      delete: deleteSaved,
    },
    meal: { create: createMeal },
    $transaction: transaction,
  },
}))

import { DELETE, POST } from "./route"

describe("saved meal suggestion item route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireUser.mockResolvedValue({ id: "user-1" })
    transaction.mockResolvedValue([])
    createMeal.mockImplementation((args) => ({ type: "meal", args }))
    deleteSaved.mockImplementation((args) => ({ type: "saved", args }))
  })

  it("deletes only a suggestion owned by the current user", async () => {
    deleteMany.mockResolvedValue({ count: 1 })

    const response = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ id: "saved-1" }),
    })

    expect(response.status).toBe(200)
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: "saved-1", userId: "user-1" } })
  })

  it("returns 404 instead of exposing another user's suggestion", async () => {
    deleteMany.mockResolvedValue({ count: 0 })

    const response = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ id: "saved-other" }),
    })

    expect(response.status).toBe(404)
  })

  it("creates a manual meal and removes the saved item in one transaction", async () => {
    findFirst.mockResolvedValue({
      id: "saved-1",
      userId: "user-1",
      name: "สลัดไก่",
      calories: 320,
      protein: 30,
      carbs: 20,
      fat: 10,
      reason: "เพิ่มโปรตีน",
    })

    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "สลัดไก่",
          calories: 320,
          protein: 30,
          carbs: 20,
          fat: 10,
          date: "2026-06-29",
          time: "18:30",
          mealCategory: "dinner",
        }),
      }),
      { params: Promise.resolve({ id: "saved-1" }) },
    )

    expect(response.status).toBe(201)
    expect(findFirst).toHaveBeenCalledWith({ where: { id: "saved-1", userId: "user-1" } })
    expect(createMeal).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: "user-1",
        source: "manual",
        mealCategory: "dinner",
      }),
    }))
    expect(deleteSaved).toHaveBeenCalledWith({ where: { id: "saved-1" } })
    expect(transaction).toHaveBeenCalledTimes(1)
  })
})
