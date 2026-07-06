import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  profileFindUnique: vi.fn(),
  settingsUpsert: vi.fn(),
  profileUpsert: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  requireUser: mocks.requireUser,
}))

vi.mock("@/lib/db", () => ({
  prisma: {
    profile: {
      findUnique: mocks.profileFindUnique,
    },
    $transaction: vi.fn(async (callback) => callback({
      userSettings: { upsert: mocks.settingsUpsert },
      profile: { upsert: mocks.profileUpsert },
    })),
  },
}))

import { PATCH } from "./route"

describe("settings route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireUser.mockResolvedValue({
      id: "user-1",
      name: "Demo",
      email: "demo@example.com",
    })
    mocks.profileFindUnique.mockResolvedValue({
      selectedGoal: "cut",
      formJson: JSON.stringify({
        name: "Demo",
        height: "175",
        weight: "70",
        targetWeight: "65",
        activity: "low",
      }),
    })
  })

  it("saves a health goal and synchronizes it back to the profile", async () => {
    const request = new Request("http://localhost/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        settings: {
          healthGoal: {
            mode: "gain",
            weeklyDeltaKg: 0.4,
            currentWeightKg: 72,
            targetWeightKg: 78,
            dailyCalories: 2500,
            activityLevel: "high",
          },
        },
      }),
    })

    const response = await PATCH(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.settings.healthGoal).toMatchObject({
      mode: "gain",
      currentWeightKg: 72,
      targetWeightKg: 78,
      activityLevel: "high",
    })
    expect(payload.profile).toMatchObject({
      selectedGoal: "lean",
      form: {
        height: "175",
        weight: "72",
        targetWeight: "78",
        activity: "high",
      },
    })
    expect(mocks.profileUpsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({ selectedGoal: "lean" }),
    }))
  })
})
