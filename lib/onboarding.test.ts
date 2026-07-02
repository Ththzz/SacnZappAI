import { describe, expect, it } from "vitest"

import { isOnboardingComplete, safeNextPath } from "./onboarding"

const completeProfile = {
  selectedGoal: "cut",
  form: {
    name: "Demo User",
    gender: "male",
    activity: "medium",
    age: "30",
    height: "175",
    weight: "75",
    targetWeight: "68",
  },
}

describe("onboarding profile", () => {
  it("recognizes a complete health profile", () => {
    expect(isOnboardingComplete(completeProfile)).toBe(true)
  })

  it("requires a goal and all health fields", () => {
    expect(isOnboardingComplete({ ...completeProfile, selectedGoal: null })).toBe(false)
    expect(isOnboardingComplete({ ...completeProfile, form: { ...completeProfile.form, height: "" } })).toBe(false)
  })
})

describe("safeNextPath", () => {
  it("allows internal destinations and rejects redirects outside the app", () => {
    expect(safeNextPath("/scan")).toBe("/scan")
    expect(safeNextPath("//example.com")).toBe("/")
    expect(safeNextPath("https://example.com")).toBe("/")
    expect(safeNextPath("/onboarding?next=/scan")).toBe("/")
  })
})
