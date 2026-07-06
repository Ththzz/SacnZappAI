export type GoalMode = "lose" | "maintain" | "gain"
export type ActivityLevel = "low" | "medium" | "high"
export type Gender = "male" | "female" | "unspecified"

export type AppSettings = {
  notifications: {
    mealReminder: boolean
    waterReminder: boolean
    weeklyReport: boolean
  }
  healthGoal: {
    mode: GoalMode
    weeklyDeltaKg: number
    currentWeightKg: number
    targetWeightKg: number
    dailyCalories: number
    activityLevel: ActivityLevel
  }
}

export type ProfileForm = {
  age?: string
  height?: string
  weight?: string
  targetWeight?: string
  activity?: string
  gender?: string
}

const activityFactor: Record<ActivityLevel, number> = {
  low: 1.2,
  medium: 1.45,
  high: 1.7,
}

const DEFAULT_HEALTH_GOAL = {
  mode: "lose",
  weeklyDeltaKg: 0.5,
  currentWeightKg: 70,
  targetWeightKg: 68,
  activityLevel: "medium",
} satisfies Omit<AppSettings["healthGoal"], "dailyCalories">

function readPositiveNumber(value: unknown): number | null {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null
}

export function normalizeActivityLevel(value: unknown): ActivityLevel {
  if (value === "low" || value === "medium" || value === "high") return value

  const normalized = String(value ?? "").trim().toLowerCase()
  if (["น้อย", "เบา", "light", "sedentary", "low"].includes(normalized)) return "low"
  if (["หนัก", "มาก", "active", "high", "intense"].includes(normalized)) return "high"

  return "medium"
}

function normalizeGender(value: unknown): Gender {
  const normalized = String(value ?? "").trim().toLowerCase()
  if (["male", "m", "ชาย"].includes(normalized)) return "male"
  if (["female", "f", "หญิง"].includes(normalized)) return "female"
  return "unspecified"
}

export function mapProfileGoalToMode(selectedGoal?: string | null): GoalMode | null {
  if (selectedGoal === "cut") return "lose"
  if (selectedGoal === "lean") return "gain"
  if (selectedGoal === "maintain") return "maintain"
  return null
}

export function mapGoalModeToProfileGoal(mode: GoalMode) {
  if (mode === "lose") return "cut" as const
  if (mode === "gain") return "lean" as const
  return "maintain" as const
}

export function getWeeklyRateLabel(mode: GoalMode) {
  if (mode === "maintain") return null
  return `อัตราการ${mode === "lose" ? "ลด" : "เพิ่ม"}น้ำหนัก (kg/สัปดาห์)`
}

export function calculateBmr(input: { weightKg?: number | null; heightCm?: number | null; age?: number | null; gender?: Gender | string | null }) {
  const weightKg = readPositiveNumber(input.weightKg)
  const heightCm = readPositiveNumber(input.heightCm)
  const age = readPositiveNumber(input.age)
  if (!weightKg || !heightCm || !age) return null

  const gender = normalizeGender(input.gender)
  const genderOffset = gender === "male" ? 5 : gender === "female" ? -161 : -78

  return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + genderOffset)
}

export function calculateTdee(input: { bmr?: number | null; activityLevel?: ActivityLevel | string | null }) {
  const bmr = readPositiveNumber(input.bmr)
  if (!bmr) return null

  return Math.round(bmr * activityFactor[normalizeActivityLevel(input.activityLevel)])
}

export function calculateNutritionTargets(
  settingsGoal: Omit<AppSettings["healthGoal"], "dailyCalories"> | AppSettings["healthGoal"],
  profile?: { selectedGoal?: string | null; form?: ProfileForm | null } | null,
) {
  const profileForm = profile?.form
  const profileWeight = readPositiveNumber(profileForm?.weight)
  const profileHeight = readPositiveNumber(profileForm?.height)
  const profileAge = readPositiveNumber(profileForm?.age)
  const currentWeightKg = profileWeight ?? readPositiveNumber(settingsGoal.currentWeightKg) ?? DEFAULT_HEALTH_GOAL.currentWeightKg
  const targetWeightKg = readPositiveNumber(profileForm?.targetWeight) ?? readPositiveNumber(settingsGoal.targetWeightKg) ?? DEFAULT_HEALTH_GOAL.targetWeightKg
  const activityLevel = normalizeActivityLevel(profileForm?.activity ?? settingsGoal.activityLevel)
  const mode = mapProfileGoalToMode(profile?.selectedGoal) ?? settingsGoal.mode
  const bmr = calculateBmr({
    weightKg: profileWeight,
    heightCm: profileHeight,
    age: profileAge,
    gender: profileForm?.gender,
  })
  const tdee = calculateTdee({ bmr, activityLevel })
  const weeklyDelta = readPositiveNumber(settingsGoal.weeklyDeltaKg) ?? DEFAULT_HEALTH_GOAL.weeklyDeltaKg
  const dailyAdjustment = (weeklyDelta * 7700) / 7
  const baseCalories = tdee ?? currentWeightKg * 22 * activityFactor[activityLevel]
  const dailyCalories = mode === "lose" ? baseCalories - dailyAdjustment : mode === "gain" ? baseCalories + dailyAdjustment : baseCalories
  const calories = Math.max(1200, Math.round(dailyCalories))
  const protein = Math.round(currentWeightKg * (mode === "gain" ? 2 : 1.8))
  const fat = Math.round(currentWeightKg * 0.85)
  const carbs = Math.max(80, Math.round((calories - protein * 4 - fat * 9) / 4))

  return {
    bmr,
    tdee,
    calories,
    protein,
    fat,
    carbs,
    currentWeightKg,
    targetWeightKg,
    activityLevel,
    mode,
    usedProfile: Boolean(bmr && tdee),
  }
}

export function calculateDailyCalories(
  goal: Omit<AppSettings["healthGoal"], "dailyCalories"> | AppSettings["healthGoal"],
  profile?: { selectedGoal?: string | null; form?: ProfileForm | null } | null,
) {
  return calculateNutritionTargets(goal, profile).calories
}

function calculateFallbackDailyCalories(goal: Omit<AppSettings["healthGoal"], "dailyCalories"> | AppSettings["healthGoal"]) {
  const weight = Number(goal.currentWeightKg)
  const activity = activityFactor[goal.activityLevel] ?? activityFactor.medium
  const safeWeight = Number.isFinite(weight) && weight > 0 ? weight : DEFAULT_HEALTH_GOAL.currentWeightKg
  const baseBmr = safeWeight * 22
  const tdee = baseBmr * activity
  const weeklyDelta = Number(goal.weeklyDeltaKg)
  const dailyAdjustment = ((Number.isFinite(weeklyDelta) ? weeklyDelta : DEFAULT_HEALTH_GOAL.weeklyDeltaKg) * 7700) / 7
  const calories = goal.mode === "lose" ? tdee - dailyAdjustment : goal.mode === "gain" ? tdee + dailyAdjustment : tdee

  return Math.max(1200, Math.round(calories))
}

export const DEFAULT_SETTINGS: AppSettings = {
  notifications: {
    mealReminder: true,
    waterReminder: true,
    weeklyReport: false,
  },
  healthGoal: {
    ...DEFAULT_HEALTH_GOAL,
    dailyCalories: calculateFallbackDailyCalories(DEFAULT_HEALTH_GOAL),
  },
}

export function normalizeSettings(
  value: Partial<AppSettings> | null | undefined,
  profile?: { selectedGoal?: string | null; form?: ProfileForm | null } | null,
): AppSettings {
  const healthGoal = { ...DEFAULT_SETTINGS.healthGoal, ...value?.healthGoal }
  const hasLegacyFixedCalories = Number(value?.healthGoal?.dailyCalories) === 1800
  const hasValidCalories = Number.isFinite(Number(healthGoal.dailyCalories)) && Number(healthGoal.dailyCalories) > 0
  const targets = calculateNutritionTargets(healthGoal, profile)

  return {
    notifications: { ...DEFAULT_SETTINGS.notifications, ...value?.notifications },
    healthGoal: {
      ...healthGoal,
      mode: targets.mode,
      currentWeightKg: targets.currentWeightKg,
      targetWeightKg: targets.targetWeightKg,
      activityLevel: targets.activityLevel,
      dailyCalories: profile?.form || hasLegacyFixedCalories || !hasValidCalories
        ? targets.calories
        : Math.round(Number(healthGoal.dailyCalories)),
    },
  }
}

export function updateHealthGoal<K extends keyof AppSettings["healthGoal"]>(
  current: AppSettings["healthGoal"],
  key: K,
  value: AppSettings["healthGoal"][K],
) {
  const next = {
    ...current,
    [key]: value,
  }

  if (key === "dailyCalories" || key === "targetWeightKg") return next

  return {
    ...next,
    dailyCalories: calculateDailyCalories(next),
  }
}
