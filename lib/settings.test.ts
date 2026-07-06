import { describe, expect, it } from "vitest"

import {
  mapGoalModeToProfileGoal,
  mapProfileGoalToMode,
  getWeeklyRateLabel,
  normalizeSettings,
  updateHealthGoal,
} from "./settings"

describe("health goal settings", () => {
  it("maps profile goals and settings modes in both directions", () => {
    expect(mapProfileGoalToMode("cut")).toBe("lose")
    expect(mapProfileGoalToMode("maintain")).toBe("maintain")
    expect(mapProfileGoalToMode("lean")).toBe("gain")
    expect(mapGoalModeToProfileGoal("lose")).toBe("cut")
    expect(mapGoalModeToProfileGoal("maintain")).toBe("maintain")
    expect(mapGoalModeToProfileGoal("gain")).toBe("lean")
  })

  it("only describes a weekly rate for weight-changing plans", () => {
    expect(getWeeklyRateLabel("lose")).toBe("อัตราการลดน้ำหนัก (kg/สัปดาห์)")
    expect(getWeeklyRateLabel("gain")).toBe("อัตราการเพิ่มน้ำหนัก (kg/สัปดาห์)")
    expect(getWeeklyRateLabel("maintain")).toBeNull()
  })

  it("keeps explicitly saved settings when no profile override is supplied", () => {
    const settings = normalizeSettings({
      healthGoal: {
        mode: "gain",
        weeklyDeltaKg: 0.35,
        currentWeightKg: 72,
        targetWeightKg: 78,
        dailyCalories: 2450,
        activityLevel: "high",
      },
    })

    expect(settings.healthGoal).toEqual({
      mode: "gain",
      weeklyDeltaKg: 0.35,
      currentWeightKg: 72,
      targetWeightKg: 78,
      dailyCalories: 2450,
      activityLevel: "high",
    })
  })

  it("recalculates calories when the weekly rate changes", () => {
    const initial = normalizeSettings(null).healthGoal
    const updated = updateHealthGoal(initial, "weeklyDeltaKg", 0.8)

    expect(updated.weeklyDeltaKg).toBe(0.8)
    expect(updated.dailyCalories).not.toBe(initial.dailyCalories)
  })
})
