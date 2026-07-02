import { describe, expect, it } from "vitest"

import { buildCalorieTrend, buildMacroBalance, getSevenDayDateKeys } from "@/lib/health-insight"
import type { MealEntry } from "@/lib/user-data"

function meal(date: string, overrides: Partial<MealEntry> = {}): MealEntry {
  return {
    id: `meal-${date}`,
    name: "ข้าวไก่",
    calories: 400,
    protein: 20,
    carbs: 50,
    fat: 10,
    time: "12:00",
    date,
    source: "scan",
    ...overrides,
  }
}

describe("health insight calculations", () => {
  const today = new Date(2026, 5, 29, 12, 0, 0)

  it("always returns seven calendar days and fills days without meals with zero", () => {
    expect(getSevenDayDateKeys(today)).toEqual([
      "2026-06-23",
      "2026-06-24",
      "2026-06-25",
      "2026-06-26",
      "2026-06-27",
      "2026-06-28",
      "2026-06-29",
    ])

    const trend = buildCalorieTrend([
      meal("2026-06-22", { calories: 999 }),
      meal("2026-06-24", { calories: 500 }),
      meal("2026-06-29", { calories: 700 }),
    ], 600, today)

    expect(trend).toHaveLength(7)
    expect(trend.map((item) => item.calories)).toEqual([0, 500, 0, 0, 0, 0, 700])
    expect(trend[6].status).toBe("over")
    expect(trend[0].status).toBe("empty")
  })

  it("calculates macro percentages only from meals passed into the seven-day window", () => {
    expect(buildMacroBalance([
      meal("2026-06-29", { protein: 25, carbs: 50, fat: 0 }),
    ])).toEqual([
      { label: "คาร์บ", value: "67%" },
      { label: "โปรตีน", value: "33%" },
      { label: "ไขมัน", value: "0%" },
    ])
  })
})
