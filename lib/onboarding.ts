export const ONBOARDING_GOALS = ["cut", "maintain", "lean"] as const
export type OnboardingGoal = (typeof ONBOARDING_GOALS)[number]

export type OnboardingProfile = {
  selectedGoal?: unknown
  form?: Record<string, unknown> | null
}

function isNumberInRange(value: unknown, min: number, max: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= min && parsed <= max
}

export function isOnboardingComplete(profile: OnboardingProfile | null | undefined) {
  const form = profile?.form
  if (!form || !ONBOARDING_GOALS.includes(profile.selectedGoal as OnboardingGoal)) return false

  return (
    typeof form.name === "string" &&
    form.name.trim().length >= 2 &&
    ["male", "female", "unspecified"].includes(String(form.gender)) &&
    ["low", "medium", "high"].includes(String(form.activity)) &&
    isNumberInRange(form.age, 13, 120) &&
    isNumberInRange(form.height, 100, 250) &&
    isNumberInRange(form.weight, 25, 350) &&
    isNumberInRange(form.targetWeight, 25, 350)
  )
}

export function safeNextPath(value: string | null | undefined, fallback = "/") {
  if (!value?.startsWith("/") || value.startsWith("//") || value.startsWith("/onboarding")) return fallback
  return value
}
