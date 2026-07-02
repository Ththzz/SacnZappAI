import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  addMealEntry,
  getLocalDateKey,
  getTimeBasedMealCategory,
  readMealEntries,
  readWaterLogs,
  STORAGE_KEYS,
  writeMealEntries,
  writeWaterLogs,
  resolveMealCategory,
  type MealEntry,
  type WaterLogEntry,
} from "./user-data"

const mealEntry: MealEntry = {
  id: "scan-1",
  name: "ข้าวไข่เจียว",
  calories: 480,
  protein: 18,
  carbs: 52,
  fat: 20,
  time: "12:30",
  date: "2026-06-23",
  source: "scan",
  confidence: 87,
  note: "ทดสอบ",
}

const waterLog: WaterLogEntry = {
  date: "2026-06-23",
  time: "09:00",
  amount: 250,
}

if (!window.localStorage) {
  const values = new Map<string, string>()
  Object.defineProperty(window, "localStorage", {
    value: {
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, String(value)),
      removeItem: (key: string) => values.delete(key),
    },
    configurable: true,
  })
}

describe("user-data storage helpers", () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.useRealTimers()
  })

  it("writes and reads valid meal entries", () => {
    writeMealEntries([mealEntry])

    expect(readMealEntries()).toEqual([mealEntry])
  })

  it("adds new meal entries before existing entries", () => {
    const laterMeal = { ...mealEntry, id: "scan-2", name: "สลัดไก่" }

    writeMealEntries([mealEntry])
    addMealEntry(laterMeal)

    expect(readMealEntries().map((meal) => meal.id)).toEqual(["scan-2", "scan-1"])
  })

  it("filters malformed meal entries from localStorage", () => {
    window.localStorage.setItem(
      STORAGE_KEYS.meals,
      JSON.stringify([
        mealEntry,
        { ...mealEntry, id: 123 },
        { ...mealEntry, calories: Number.NaN },
        { ...mealEntry, source: "imported" },
      ]),
    )

    expect(readMealEntries()).toEqual([mealEntry])
  })

  it("writes and reads valid water logs", () => {
    writeWaterLogs([waterLog])

    expect(readWaterLogs()).toEqual([waterLog])
  })

  it("normalizes legacy water logs without a date", () => {
    vi.setSystemTime(new Date(2026, 5, 23, 10, 0, 0))
    window.localStorage.setItem(
      STORAGE_KEYS.waterLogs,
      JSON.stringify([
        { time: "08:00", amount: 250 },
        { time: "08:30", amount: -100 },
        { time: 900, amount: 200 },
      ]),
    )

    expect(readWaterLogs()).toEqual([
      {
        date: "2026-06-23",
        time: "08:00",
        amount: 250,
      },
    ])
  })

  it("formats local date keys without UTC shifting", () => {
    expect(getLocalDateKey(new Date(2026, 0, 5, 23, 30, 0))).toBe("2026-01-05")
  })

  it("maps main meals to regular and special time ranges", () => {
    expect(getTimeBasedMealCategory("08:00")).toBe("breakfast")
    expect(getTimeBasedMealCategory("12:00")).toBe("lunch")
    expect(getTimeBasedMealCategory("18:00")).toBe("dinner")
    expect(getTimeBasedMealCategory("23:00")).toBe("special")
    expect(getTimeBasedMealCategory("04:59")).toBe("special")
  })

  it("keeps an explicit AI snack category regardless of time", () => {
    expect(resolveMealCategory({ time: "08:00", mealCategory: "snack" })).toBe("snack")
    expect(resolveMealCategory({ time: "18:00", mealCategory: "snack" })).toBe("snack")
  })
})
