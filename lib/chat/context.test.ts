import { describe, expect, it, vi } from "vitest"

import { buildChatContext } from "./context"
import type { ChatConsentRecord } from "./repository"

type ContextDb = Parameters<typeof buildChatContext>[0]["db"]

function createConsent(scope: ChatConsentRecord["scope"]): ChatConsentRecord {
  const now = new Date("2026-06-28T00:00:00.000Z")
  return {
    id: `consent-${scope}`,
    userId: "user-1",
    scope,
    policyVersion: "2026-06-28",
    grantedAt: now,
    revokedAt: null,
    uiVersion: "test",
    createdAt: now,
    updatedAt: now,
  }
}

function createDb(consents: Partial<Record<ChatConsentRecord["scope"], ChatConsentRecord | null>>): ContextDb {
  return {
    conversation: { create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    message: { create: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    chatConsent: {
      create: vi.fn(),
      findFirst: vi.fn((args: unknown) => {
        const { where } = args as { where: { scope: ChatConsentRecord["scope"] } }
        return Promise.resolve(consents[where.scope] ?? null)
      }),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    chatUsage: { create: vi.fn() },
    profile: {
      findUnique: vi.fn().mockResolvedValue({
        selectedGoal: "cut",
        formJson: JSON.stringify({ weight: "72", height: "172", age: "30", activity: "medium" }),
      }),
    },
    userSettings: {
      findUnique: vi.fn().mockResolvedValue({
        settingsJson: JSON.stringify({
          healthGoal: {
            mode: "lose",
            currentWeightKg: 72,
            targetWeightKg: 68,
            weeklyDeltaKg: 0.5,
            dailyCalories: 1800,
            activityLevel: "medium",
          },
        }),
      }),
    },
    meal: {
      findMany: vi.fn().mockResolvedValue([
        { date: "2026-06-28", time: "12:00", name: "ข้าวไข่เจียว", calories: 480, protein: 18, carbs: 52, fat: 20 },
      ]),
    },
    waterLog: {
      findMany: vi.fn().mockResolvedValue([
        { date: "2026-06-28", amount: 250 },
        { date: "2026-06-28", amount: 500 },
      ]),
    },
  }
}

describe("buildChatContext", () => {
  it("includes only consented and relevant summaries", async () => {
    const db = createDb({
      profile_context: createConsent("profile_context"),
      nutrition_history: createConsent("nutrition_history"),
      hydration_history: createConsent("hydration_history"),
    })

    const result = await buildChatContext({
      db,
      userId: "user-1",
      message: "วันนี้แคลอรี่กับน้ำที่ดื่มโอเคไหม",
    })

    expect(result.provenanceLabels).toEqual(
      expect.arrayContaining(["โปรไฟล์และเป้าหมาย", "มื้ออาหาร 7 วัน", "การดื่มน้ำ 7 วัน"]),
    )
    expect(result.contextBlocks.join("\n")).toContain("Trusted app context")
    expect(result.contextBlocks.join("\n")).toContain("ข้าวไข่เจียว")
    expect(result.contextBlocks.join("\n")).toContain("750 ml")
  })

  it("skips optional context when consent is missing", async () => {
    const db = createDb({
      profile_context: null,
      nutrition_history: null,
      hydration_history: null,
    })

    const result = await buildChatContext({
      db,
      userId: "user-1",
      message: "ช่วยสรุปหน่อย",
    })

    expect(result.contextBlocks).toEqual([])
    expect(result.provenanceLabels).toEqual([])
  })
})
