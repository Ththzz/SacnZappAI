"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AlertCircle,
  Beef,
  Bot,
  Check,
  Droplets,
  Flame,
  Lightbulb,
  LoaderCircle,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  X,
} from "lucide-react"

import {
  getLocalDateKey,
  getTimeBasedMealCategory,
  isMealCategory,
  MEAL_CATEGORIES,
  MEAL_CATEGORY_LABELS,
  notifyMealHistoryUpdated,
  readMealEntries,
  readWaterLogs,
  type MealCategory,
  type MealEntry,
} from "@/lib/user-data"
import {
  buildCalorieTrend,
  buildMacroBalance,
  defaultMacroBalance,
  getSevenDayDateKeys,
  type CalorieTrendPoint,
  type MacroBalanceItem,
} from "@/lib/health-insight"

type FoodAlert = {
  id: string
  icon: "protein" | "water"
  title: string
  description: string
  colorClass: string
  iconClass: string
}

type MealSuggestion = {
  id: string
  name: string
  calories: number
  protein: number
  carbs: number
  fat: number
  reason: string
}

type SavedMealSuggestion = Omit<MealSuggestion, "id"> & {
  id: string
  createdAt: string
}

type SuggestionPayload = {
  suggestions?: MealSuggestion[]
  source?: string
  generatedAt?: string | null
  isStale?: boolean
  error?: string
}

type SettingsPayload = {
  settings?: {
    healthGoal?: {
      dailyCalories?: number
    }
  } | null
}

type HealthInsightData = SettingsPayload & {
  meals?: MealEntry[]
  waterLogs?: ReturnType<typeof readWaterLogs>
  savedSuggestions?: SavedMealSuggestion[]
}

type InsightCachePayload = {
  mealCount: number
  calorieGoal: number | null
  calorieTrend: CalorieTrendPoint[]
  foodAlerts: FoodAlert[]
  macroBalance: MacroBalanceItem[]
  savedSuggestions: SavedMealSuggestion[]
}

type SuggestionCachePayload = {
  mealSuggestions: MealSuggestion[]
  suggestionSource: string
  suggestionGeneratedAt: string | null
  suggestionStale: boolean
  suggestionError: string | null
}

const INSIGHT_CACHE_KEY = "scanzapp.health-insight.cache.v1"
const SUGGESTION_CACHE_KEY = "scanzapp.meal-suggestions.cache.v1"
const CACHE_MAX_AGE_MS = 5 * 60 * 1000
const FOOD_ALERT_ICONS = {
  protein: Beef,
  water: Droplets,
} as const

const chartHeight = 150
function getCalorieGoal(payload: SettingsPayload): number | null {
  const calories = Number(payload.settings?.healthGoal?.dailyCalories)
  return Number.isFinite(calories) && calories > 0 ? Math.round(calories) : null
}

function normalizedName(value: string) {
  return value.trim().toLocaleLowerCase("th-TH").replace(/\s+/g, " ")
}

function parseApiError(data: unknown, fallback: string) {
  if (!data || typeof data !== "object") return fallback
  const message = (data as { error?: unknown }).error
  return typeof message === "string" && message ? message : fallback
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function isValidDateString(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(new Date(value).getTime())
}

function toSafeNumber(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function parseMealSuggestion(value: unknown): MealSuggestion | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.name !== "string") return null

  return {
    id: value.id,
    name: value.name,
    calories: Math.max(0, Math.round(toSafeNumber(value.calories))),
    protein: Math.max(0, Math.round(toSafeNumber(value.protein))),
    carbs: Math.max(0, Math.round(toSafeNumber(value.carbs))),
    fat: Math.max(0, Math.round(toSafeNumber(value.fat))),
    reason: typeof value.reason === "string" ? value.reason : "",
  }
}

function parseSavedMealSuggestion(value: unknown): SavedMealSuggestion | null {
  if (!isRecord(value) || typeof value.createdAt !== "string") return null
  const base = parseMealSuggestion(value)
  return base ? { ...base, createdAt: value.createdAt } : null
}

function parseCalorieTrendPoint(value: unknown): CalorieTrendPoint | null {
  if (!isRecord(value) || typeof value.date !== "string" || typeof value.day !== "string") return null
  const status = value.status
  if (status !== "good" && status !== "over" && status !== "empty") return null

  return {
    date: value.date,
    day: value.day,
    calories: Math.max(0, toSafeNumber(value.calories)),
    status,
  }
}

function parseMacroBalanceItem(value: unknown): MacroBalanceItem | null {
  if (!isRecord(value) || typeof value.label !== "string" || typeof value.value !== "string") return null
  return { label: value.label, value: value.value }
}

function parseFoodAlert(value: unknown): FoodAlert | null {
  if (!isRecord(value)) return null
  const icon = value.icon
  if ((icon !== "protein" && icon !== "water") || typeof value.id !== "string" || typeof value.title !== "string") {
    return null
  }

  return {
    id: value.id,
    icon,
    title: value.title,
    description: typeof value.description === "string" ? value.description : "",
    colorClass: typeof value.colorClass === "string" ? value.colorClass : "",
    iconClass: typeof value.iconClass === "string" ? value.iconClass : "",
  }
}

function readSessionCache<T>(key: string) {
  if (typeof window === "undefined") return null
  try {
    const raw = window.sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { savedAt?: number; data?: T }
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > CACHE_MAX_AGE_MS) return null
    return parsed.data ?? null
  } catch {
    return null
  }
}

function writeSessionCache<T>(key: string, data: T) {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data }))
  } catch {
    return
  }
}

function readInsightCache() {
  const cached = readSessionCache<unknown>(INSIGHT_CACHE_KEY)
  if (!isRecord(cached)) return null

  const calorieTrend = Array.isArray(cached.calorieTrend)
    ? cached.calorieTrend.map(parseCalorieTrendPoint).filter((item): item is CalorieTrendPoint => item !== null)
    : []
  const foodAlerts = Array.isArray(cached.foodAlerts)
    ? cached.foodAlerts.map(parseFoodAlert).filter((item): item is FoodAlert => item !== null)
    : []
  const macroBalance = Array.isArray(cached.macroBalance)
    ? cached.macroBalance.map(parseMacroBalanceItem).filter((item): item is MacroBalanceItem => item !== null)
    : []
  const savedSuggestions = Array.isArray(cached.savedSuggestions)
    ? cached.savedSuggestions.map(parseSavedMealSuggestion).filter((item): item is SavedMealSuggestion => item !== null)
    : []

  return {
    mealCount: Math.max(0, toSafeNumber(cached.mealCount)),
    calorieGoal: Number.isFinite(Number(cached.calorieGoal)) ? Math.max(0, Math.round(Number(cached.calorieGoal))) : null,
    calorieTrend,
    foodAlerts,
    macroBalance: macroBalance.length > 0 ? macroBalance : defaultMacroBalance,
    savedSuggestions,
  } satisfies InsightCachePayload
}

function readSuggestionCache() {
  const cached = readSessionCache<unknown>(SUGGESTION_CACHE_KEY)
  if (!isRecord(cached)) return null

  const mealSuggestions = Array.isArray(cached.mealSuggestions)
    ? cached.mealSuggestions.map(parseMealSuggestion).filter((item): item is MealSuggestion => item !== null)
    : []

  return {
    mealSuggestions,
    suggestionSource: typeof cached.suggestionSource === "string" ? cached.suggestionSource : "",
    suggestionGeneratedAt: isValidDateString(cached.suggestionGeneratedAt) ? cached.suggestionGeneratedAt : null,
    suggestionStale: Boolean(cached.suggestionStale),
    suggestionError: typeof cached.suggestionError === "string" ? cached.suggestionError : null,
  } satisfies SuggestionCachePayload
}

function formatGeneratedAtLabel(value: string | null) {
  if (!isValidDateString(value)) return null
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
}

export default function HealthInsightClient() {
  const initialInsightCache = readInsightCache()
  const initialSuggestionCache = readSuggestionCache()
  const [loading, setLoading] = useState(!initialInsightCache)
  const [suggestionLoading, setSuggestionLoading] = useState(!initialSuggestionCache)
  const [refreshing, setRefreshing] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [calorieTrend, setCalorieTrend] = useState<CalorieTrendPoint[]>(initialInsightCache?.calorieTrend ?? [])
  const [foodAlerts, setFoodAlerts] = useState<FoodAlert[]>(initialInsightCache?.foodAlerts ?? [])
  const [macroBalance, setMacroBalance] = useState<MacroBalanceItem[]>(initialInsightCache?.macroBalance ?? defaultMacroBalance)
  const [mealSuggestions, setMealSuggestions] = useState<MealSuggestion[]>(initialSuggestionCache?.mealSuggestions ?? [])
  const [savedSuggestions, setSavedSuggestions] = useState<SavedMealSuggestion[]>(initialInsightCache?.savedSuggestions ?? [])
  const [suggestionSource, setSuggestionSource] = useState(initialSuggestionCache?.suggestionSource ?? "")
  const [suggestionGeneratedAt, setSuggestionGeneratedAt] = useState<string | null>(initialSuggestionCache?.suggestionGeneratedAt ?? null)
  const [suggestionStale, setSuggestionStale] = useState(initialSuggestionCache?.suggestionStale ?? false)
  const [suggestionError, setSuggestionError] = useState<string | null>(initialSuggestionCache?.suggestionError ?? null)
  const [mealCount, setMealCount] = useState(initialInsightCache?.mealCount ?? 0)
  const [calorieGoal, setCalorieGoal] = useState<number | null>(initialInsightCache?.calorieGoal ?? null)
  const [convertingMeal, setConvertingMeal] = useState<SavedMealSuggestion | null>(null)
  const initialLoadStarted = useRef(false)
  const hasInsightData = useRef(Boolean(initialInsightCache))
  const hasSuggestionData = useRef(Boolean(initialSuggestionCache))

  const applySuggestionPayload = useCallback((payload: SuggestionPayload) => {
    setMealSuggestions(payload.suggestions ?? [])
    setSuggestionSource(payload.source ?? "")
    setSuggestionGeneratedAt(payload.generatedAt ?? null)
    setSuggestionStale(Boolean(payload.isStale))
    setSuggestionError(payload.error ?? null)
    writeSessionCache<SuggestionCachePayload>(SUGGESTION_CACHE_KEY, {
      mealSuggestions: payload.suggestions ?? [],
      suggestionSource: payload.source ?? "",
      suggestionGeneratedAt: payload.generatedAt ?? null,
      suggestionStale: Boolean(payload.isStale),
      suggestionError: payload.error ?? null,
    })
  }, [])

  const loadSuggestionData = useCallback(async (force = false) => {
    if (force) setRefreshing(true)
    else if (!hasSuggestionData.current) setSuggestionLoading(true)
    setSuggestionError(null)

    try {
      const response = await fetch("/api/meal-suggestions", { method: force ? "POST" : "GET" })
      const payload = (await response.json().catch(() => ({}))) as SuggestionPayload
      if (!response.ok) throw new Error(parseApiError(payload, "โหลดคำแนะนำไม่สำเร็จ"))

      applySuggestionPayload(payload)
      hasSuggestionData.current = true
      setSuggestionLoading(false)
    } catch (error) {
      setSuggestionError(error instanceof Error ? error.message : "โหลดคำแนะนำไม่สำเร็จ")
    } finally {
      setSuggestionLoading(false)
      setRefreshing(false)
    }
  }, [applySuggestionPayload])

  const loadInsightData = useCallback(async () => {
    if (!hasInsightData.current) setLoading(true)
    setPageError(null)
    const dateKeys = getSevenDayDateKeys()
    const dateRange = `from=${dateKeys[0]}&to=${dateKeys[6]}&limit=500`

    let serverData: HealthInsightData | null = null

    try {
      const response = await fetch(`/api/health-insight-data?${dateRange}`)
      const data = await response.json().catch(() => ({})) as HealthInsightData
      if (!response.ok) throw new Error(parseApiError(data, "โหลดข้อมูลวิเคราะห์ไม่สำเร็จ"))
      serverData = data
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "โหลดข้อมูลวิเคราะห์ไม่สำเร็จ")
    }

    const allMeals = serverData?.meals ?? readMealEntries()
    const recentMeals = allMeals.filter((meal) => meal.date >= dateKeys[0] && meal.date <= dateKeys[6])
    const waterLogs = serverData?.waterLogs ?? readWaterLogs()
    const goal = serverData ? getCalorieGoal(serverData) : calorieGoal
    const todayWaterMl = waterLogs
      .filter((log) => log.date === dateKeys[6])
      .reduce((sum, log) => sum + log.amount, 0)

    const nextCalorieTrend = buildCalorieTrend(recentMeals, goal)
    const nextMacroBalance = buildMacroBalance(recentMeals)
    setMealCount(recentMeals.length)
    setCalorieGoal(goal)
    setCalorieTrend(nextCalorieTrend)
    setMacroBalance(nextMacroBalance)

    const nextSavedSuggestions = serverData?.savedSuggestions ?? savedSuggestions
    if (serverData?.savedSuggestions) {
      setSavedSuggestions(serverData.savedSuggestions)
    }

    const alerts: FoodAlert[] = []
    if (recentMeals.length > 0) {
      const totalProtein = recentMeals.reduce((sum, meal) => sum + meal.protein, 0)
      const avgProtein = totalProtein / recentMeals.length
      alerts.push({
        id: "protein",
        icon: "protein",
        title: "โปรตีน",
        description: avgProtein < 20 ? "โปรตีนเฉลี่ยต่อมื้อใน 7 วันยังต่ำกว่า 20g" : "โปรตีนเฉลี่ยต่อมื้อใน 7 วันอยู่ในเกณฑ์ดี",
        colorClass: avgProtein < 20 ? "bg-rose-50" : "bg-emerald-50",
        iconClass: avgProtein < 20 ? "text-red-500" : "text-emerald-500",
      })
    }
    alerts.push({
      id: "water",
      icon: "water",
      title: "น้ำวันนี้",
      description: todayWaterMl > 0 ? `บันทึกแล้ว ${todayWaterMl.toLocaleString()} ml` : "ยังไม่มีข้อมูลน้ำดื่มวันนี้",
      colorClass: todayWaterMl > 0 ? "bg-emerald-50" : "bg-sky-50",
      iconClass: todayWaterMl > 0 ? "text-emerald-500" : "text-sky-500",
    })
    setFoodAlerts(alerts)
    writeSessionCache<InsightCachePayload>(INSIGHT_CACHE_KEY, {
      mealCount: recentMeals.length,
      calorieGoal: goal,
      calorieTrend: nextCalorieTrend,
      foodAlerts: alerts,
      macroBalance: nextMacroBalance,
      savedSuggestions: nextSavedSuggestions,
    })
    hasInsightData.current = true
    setLoading(false)
  }, [calorieGoal, savedSuggestions])

  useEffect(() => {
    if (initialLoadStarted.current) return
    initialLoadStarted.current = true
    void loadInsightData()
    void loadSuggestionData()
  }, [loadInsightData, loadSuggestionData])

  useEffect(() => {
    if (loading) return
    writeSessionCache<InsightCachePayload>(INSIGHT_CACHE_KEY, {
      mealCount,
      calorieGoal,
      calorieTrend,
      foodAlerts,
      macroBalance,
      savedSuggestions,
    })
  }, [loading, mealCount, calorieGoal, calorieTrend, foodAlerts, macroBalance, savedSuggestions])

  useEffect(() => {
    if (suggestionLoading) return
    writeSessionCache<SuggestionCachePayload>(SUGGESTION_CACHE_KEY, {
      mealSuggestions,
      suggestionSource,
      suggestionGeneratedAt,
      suggestionStale,
      suggestionError,
    })
  }, [suggestionLoading, mealSuggestions, suggestionSource, suggestionGeneratedAt, suggestionStale, suggestionError])

  const savedNames = useMemo(
    () => new Set(savedSuggestions.map((suggestion) => normalizedName(suggestion.name))),
    [savedSuggestions],
  )

  const saveSuggestion = async (meal: MealSuggestion) => {
    setNotice(null)
    const response = await fetch("/api/saved-meal-suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(meal),
    }).catch(() => null)
    if (!response) {
      setPageError("เชื่อมต่อระบบบันทึกเมนูไม่สำเร็จ")
      return
    }
    const data = (await response.json().catch(() => ({}))) as { suggestion?: SavedMealSuggestion; error?: string }
    if (!response.ok || !data.suggestion) {
      setPageError(parseApiError(data, "บันทึกเมนูไม่สำเร็จ"))
      return
    }
    setSavedSuggestions((current) => [
      data.suggestion!,
      ...current.filter((item) => item.id !== data.suggestion!.id),
    ])
    setNotice(`บันทึก “${meal.name}” ไว้แล้ว`)
  }

  const removeSavedSuggestion = async (id: string) => {
    const response = await fetch(`/api/saved-meal-suggestions/${id}`, { method: "DELETE" }).catch(() => null)
    if (!response?.ok) {
      setPageError("ยกเลิกการบันทึกไม่สำเร็จ")
      return
    }
    setSavedSuggestions((current) => current.filter((item) => item.id !== id))
  }

  const consumeSavedSuggestion = async (meal: SavedMealSuggestion, form: ConvertMealForm) => {
    const response = await fetch(`/api/saved-meal-suggestions/${meal.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    }).catch(() => null)
    if (!response) throw new Error("เชื่อมต่อระบบบันทึกมื้ออาหารไม่สำเร็จ")
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(parseApiError(data, "เพิ่มมื้ออาหารไม่สำเร็จ"))

    setConvertingMeal(null)
    setSavedSuggestions((current) => current.filter((item) => item.id !== meal.id))
    setNotice(`เพิ่ม “${form.name}” ลงในประวัติมื้ออาหารแล้ว`)
    notifyMealHistoryUpdated()
    await loadInsightData()
  }

  if (loading) return <InsightSkeleton />

  return (
    <div className="mx-auto max-w-7xl space-y-5 text-neutral-900">
      {pageError && <StatusMessage tone="error" message={pageError} onRetry={() => void loadInsightData()} />}
      {notice && <StatusMessage tone="success" message={notice} onClose={() => setNotice(null)} />}

      <InsightBanner mealCount={mealCount} />

      {mealCount === 0 ? (
        <EmptyInsightState savedSuggestions={savedSuggestions} onConvert={setConvertingMeal} onRemove={removeSavedSuggestion} />
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <main className="space-y-5">
            <CalorieTrendCard calorieGoal={calorieGoal} calorieTrend={calorieTrend} />
            <MealSuggestionsCard
              savedNames={savedNames}
              macroBalance={macroBalance}
              mealSuggestions={mealSuggestions}
              suggestionSource={suggestionSource}
              generatedAt={suggestionGeneratedAt}
              isStale={suggestionStale}
              error={suggestionError}
              loading={suggestionLoading}
              refreshing={refreshing}
              onRefresh={() => void loadSuggestionData(true)}
              onSave={saveSuggestion}
            />
            <SavedSuggestionsCard suggestions={savedSuggestions} onConvert={setConvertingMeal} onRemove={removeSavedSuggestion} />
          </main>

          <FoodAlertsPanel foodAlerts={foodAlerts} />
        </div>
      )}

      {convertingMeal && (
        <ConvertMealModal
          meal={convertingMeal}
          onClose={() => setConvertingMeal(null)}
          onSubmit={(form) => consumeSavedSuggestion(convertingMeal, form)}
        />
      )}
    </div>
  )
}

function InsightBanner({ mealCount }: { mealCount: number }) {
  const hasMeals = mealCount > 0
  return (
    <section className="grid gap-4 rounded-2xl bg-emerald-50 p-5 shadow-sm ring-1 ring-emerald-100 lg:grid-cols-[auto_1fr_auto] lg:items-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#2EC78F] shadow-sm">
        <Bot className="h-6 w-6" />
      </div>
      <div>
        <h2 className="text-base font-extrabold text-[#2EC78F]">{hasMeals ? "สรุปจากข้อมูลจริงย้อนหลัง 7 วัน" : "เริ่มสร้างข้อมูลวิเคราะห์ได้เลย"}</h2>
        <p className="mt-1 text-sm font-medium leading-6 text-emerald-700">
          {hasMeals ? `มีมื้ออาหารในช่วง 7 วัน ${mealCount} รายการ ระบบใช้ข้อมูลนี้สร้างแนวโน้มและคำแนะนำ` : "ยังไม่มีมื้ออาหารในช่วง 7 วัน ลองสแกนอาหารเพื่อเริ่มวิเคราะห์"}
        </p>
      </div>
      <div className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#2EC78F] px-6 text-sm font-extrabold text-white">
        <Flame className="h-4 w-4" />
        {hasMeals ? `${mealCount} มื้อ` : "ยังไม่มีข้อมูล"}
      </div>
    </section>
  )
}

function CalorieTrendCard({ calorieGoal, calorieTrend }: { calorieGoal: number | null; calorieTrend: CalorieTrendPoint[] }) {
  const maxCalories = Math.max(calorieGoal ? calorieGoal * 1.25 : 0, ...calorieTrend.map((item) => item.calories), 1)
  const targetLineBottom = calorieGoal ? Math.min(chartHeight, (calorieGoal / maxCalories) * chartHeight) : null
  const hasCalories = calorieTrend.some((item) => item.calories > 0)
  const formatter = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short" })

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold">แนวโน้มแคลอรี่ 7 วัน</h2>
          <p className="mt-1 text-xs font-semibold text-neutral-400">
            {calorieGoal ? `เป้าหมาย ${calorieGoal.toLocaleString()} kcal ต่อวัน` : "ยังไม่มีเป้าหมายแคลอรี่"}
          </p>
        </div>
        <span className={`rounded-full px-4 py-1 text-xs font-bold ${calorieTrend.some((item) => item.status === "over") ? "bg-orange-50 text-orange-500" : "bg-emerald-50 text-emerald-600"}`}>
          {!calorieGoal ? "ยังไม่ตั้งเป้า" : calorieTrend.some((item) => item.status === "over") ? "มีวันที่เกิน" : "อยู่ในเป้า"}
        </span>
      </div>

      <div className="relative mt-6">
        {!hasCalories && (
          <div className="flex h-[150px] items-center justify-center rounded-2xl bg-neutral-50 text-sm font-semibold text-neutral-400">
            ยังไม่มีข้อมูลแคลอรี่สำหรับช่วง 7 วันนี้
          </div>
        )}
        {hasCalories && (
          <div className="relative h-[150px]">
            {targetLineBottom !== null && (
              <div className="absolute inset-x-0 border-t border-dashed border-orange-300" style={{ bottom: `${targetLineBottom}px` }}>
                <span className="absolute right-0 -top-5 text-[10px] font-bold text-orange-400">เป้าหมาย</span>
              </div>
            )}
            <div className="relative z-10 flex h-full items-end justify-between gap-3">
              {calorieTrend.map((item) => (
                <div key={item.date} className="flex min-w-0 flex-1 flex-col items-center">
                  <div
                    className={`w-full max-w-14 rounded-t-md ${item.status === "over" ? "bg-orange-400" : item.status === "empty" ? "bg-neutral-100" : "bg-[#2EC78F]"}`}
                    style={{ height: item.calories === 0 ? "6px" : `${Math.max(16, (item.calories / maxCalories) * chartHeight)}px` }}
                    aria-label={`${item.day} ${item.calories} kcal`}
                    title={`${formatter.format(new Date(`${item.date}T12:00:00`))}: ${Math.round(item.calories)} kcal`}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="mt-3 flex justify-between gap-3">
          {calorieTrend.map((item) => (
            <span key={item.date} className="min-w-0 flex-1 text-center text-xs font-bold text-neutral-400">{item.day}</span>
          ))}
        </div>
      </div>
    </section>
  )
}

function FoodAlertsPanel({ foodAlerts }: { foodAlerts: FoodAlert[] }) {
  return (
    <aside className="space-y-4">
      <h2 className="text-base font-extrabold">แจ้งเตือนสารอาหาร</h2>
      {foodAlerts.map((alert) => {
        const Icon = FOOD_ALERT_ICONS[alert.icon]
        return (
          <article key={alert.id} className="grid grid-cols-[48px_1fr] items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${alert.colorClass}`}>
              <Icon className={`h-6 w-6 ${alert.iconClass}`} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-extrabold text-neutral-900">{alert.title}</h3>
              <p className="mt-1 text-xs font-semibold leading-5 text-neutral-500">{alert.description}</p>
            </div>
          </article>
        )
      })}
    </aside>
  )
}

function MealSuggestionsCard({
  savedNames,
  macroBalance,
  mealSuggestions,
  suggestionSource,
  generatedAt,
  isStale,
  error,
  loading,
  refreshing,
  onRefresh,
  onSave,
}: {
  savedNames: Set<string>
  macroBalance: MacroBalanceItem[]
  mealSuggestions: MealSuggestion[]
  suggestionSource: string
  generatedAt: string | null
  isStale: boolean
  error: string | null
  loading: boolean
  refreshing: boolean
  onRefresh: () => void
  onSave: (meal: MealSuggestion) => void
}) {
  const generatedLabel = formatGeneratedAtLabel(generatedAt)

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-400" />
            <h2 className="text-base font-extrabold">มื้อถัดไปที่แนะนำ</h2>
          </div>
          <p className="mt-1 text-xs font-semibold text-neutral-400">
            {generatedLabel ? `สร้างล่าสุด ${generatedLabel}${suggestionSource.startsWith("cache") ? " · ใช้ข้อมูลที่บันทึกไว้" : ""}` : "ยังไม่มีคำแนะนำที่บันทึกไว้"}
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading || refreshing}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-emerald-200 px-4 text-xs font-extrabold text-emerald-600 hover:bg-emerald-50 disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading || refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "กำลังสร้าง..." : loading ? "กำลังโหลด..." : "สร้างคำแนะนำใหม่"}
        </button>
      </div>

      <div className="mt-4 inline-flex flex-wrap items-center gap-3 rounded-full bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-600">
        {macroBalance.map((macro) => <span key={macro.label}>{macro.label} {macro.value}</span>)}
      </div>

      {(refreshing || isStale || error) && (
        <div className={`mt-4 flex items-start gap-2 rounded-xl px-4 py-3 text-xs font-semibold ${refreshing || (isStale && !error) ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"}`}>
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {refreshing
              ? "กำลังสร้างคำแนะนำใหม่ กรุณารอสักครู่"
              : error
                ? error
                : "กำลังแสดงคำแนะนำที่บันทึกไว้ก่อนหน้า กดสร้างคำแนะนำใหม่เมื่อต้องการอัปเดต"}
          </span>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {loading && mealSuggestions.length === 0 && (
          <>
            <SuggestionSkeleton />
            <SuggestionSkeleton />
            <SuggestionSkeleton />
          </>
        )}
        {!loading && mealSuggestions.length === 0 && (
          <div className="rounded-xl bg-neutral-50 p-4 text-sm font-semibold text-neutral-500">
            ยังไม่มีคำแนะนำที่บันทึกไว้ กด “สร้างคำแนะนำใหม่” เมื่อต้องการให้ AI สร้างให้
          </div>
        )}
        {mealSuggestions.map((meal) => {
          const isSaved = savedNames.has(normalizedName(meal.name))
          return (
            <article key={meal.id} className="grid gap-3 rounded-xl bg-neutral-50 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <h3 className="text-sm font-extrabold">{meal.name}</h3>
                <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold">
                  <span className="text-orange-500">{meal.calories} kcal</span>
                  <span className="text-emerald-600">โปรตีน {meal.protein}g</span>
                  <span className="text-sky-600">คาร์บ {meal.carbs}g</span>
                  <span className="text-amber-600">ไขมัน {meal.fat}g</span>
                </div>
                {meal.reason && <p className="mt-2 text-xs font-medium leading-5 text-neutral-500">{meal.reason}</p>}
              </div>
              <button
                type="button"
                onClick={() => void onSave(meal)}
                disabled={isSaved}
                className={`inline-flex h-10 items-center justify-center gap-2 rounded-full px-5 text-sm font-extrabold transition-colors ${isSaved ? "bg-emerald-50 text-[#2EC78F] ring-1 ring-emerald-200" : "bg-[#2EC78F] text-white hover:bg-[#05b474]"}`}
              >
                {isSaved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                {isSaved ? "บันทึกแล้ว" : "บันทึก"}
              </button>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function SuggestionSkeleton() {
  return (
    <div className="animate-pulse rounded-xl bg-neutral-50 p-4">
      <div className="h-4 w-2/5 rounded bg-neutral-200" />
      <div className="mt-3 h-3 w-3/5 rounded bg-neutral-200" />
      <div className="mt-3 h-3 w-full rounded bg-neutral-200" />
    </div>
  )
}

function SavedSuggestionsCard({
  suggestions,
  onConvert,
  onRemove,
}: {
  suggestions: SavedMealSuggestion[]
  onConvert: (meal: SavedMealSuggestion) => void
  onRemove: (id: string) => void
}) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div className="flex items-center gap-2">
        <Save className="h-4 w-4 text-emerald-500" />
        <h2 className="text-base font-extrabold">เมนูที่บันทึกไว้</h2>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-600">{suggestions.length}</span>
      </div>
      {suggestions.length === 0 ? (
        <div className="mt-4 rounded-xl bg-neutral-50 p-4 text-sm font-semibold text-neutral-500">
          กดบันทึกจากคำแนะนำด้านบนเพื่อเก็บเมนูที่สนใจ
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {suggestions.map((meal) => (
            <article key={meal.id} className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
              <h3 className="font-extrabold text-neutral-900">{meal.name}</h3>
              <p className="mt-1 text-xs font-bold text-orange-500">{meal.calories} kcal · โปรตีน {meal.protein}g</p>
              {meal.reason && <p className="mt-2 text-xs leading-5 text-neutral-500">{meal.reason}</p>}
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => onConvert(meal)} className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-[#2EC78F] px-3 text-xs font-extrabold text-white hover:bg-[#05b474]">
                  <Plus className="h-3.5 w-3.5" />
                  เพิ่มเป็นมื้อ
                </button>
                <button type="button" onClick={() => void onRemove(meal.id)} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-rose-200 text-rose-500 hover:bg-rose-50" aria-label={`ลบ ${meal.name}`}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function EmptyInsightState({
  savedSuggestions,
  onConvert,
  onRemove,
}: {
  savedSuggestions: SavedMealSuggestion[]
  onConvert: (meal: SavedMealSuggestion) => void
  onRemove: (id: string) => void
}) {
  return (
    <div className="space-y-5">
      <section className="flex flex-col items-center rounded-2xl bg-white px-6 py-12 text-center shadow-sm ring-1 ring-black/5">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500">
          <Sparkles className="h-8 w-8" />
        </div>
        <h2 className="mt-5 text-xl font-extrabold">ยังไม่มีข้อมูลสำหรับวิเคราะห์</h2>
        <p className="mt-2 max-w-md text-sm font-medium leading-6 text-neutral-500">
          สแกนอาหารอย่างน้อยหนึ่งมื้อ แล้วระบบจะเริ่มสร้างกราฟ แจ้งเตือน และคำแนะนำจากข้อมูลจริงของคุณ
        </p>
        <Link href="/scan" className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#2EC78F] px-6 text-sm font-extrabold text-white hover:bg-[#05b474]">
          <Plus className="h-4 w-4" />
          ไปสแกนอาหาร
        </Link>
      </section>
      {savedSuggestions.length > 0 && <SavedSuggestionsCard suggestions={savedSuggestions} onConvert={onConvert} onRemove={onRemove} />}
    </div>
  )
}

type ConvertMealForm = {
  name: string
  calories: number
  protein: number
  carbs: number
  fat: number
  reason: string
  date: string
  time: string
  mealCategory: MealCategory
}

function ConvertMealModal({
  meal,
  onClose,
  onSubmit,
}: {
  meal: SavedMealSuggestion
  onClose: () => void
  onSubmit: (form: ConvertMealForm) => Promise<void>
}) {
  const now = new Date()
  const currentTime = now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", hour12: false })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: meal.name,
    calories: String(meal.calories),
    protein: String(meal.protein),
    carbs: String(meal.carbs),
    fat: String(meal.fat),
    reason: meal.reason,
    date: getLocalDateKey(now),
    time: currentTime,
    mealCategory: getTimeBasedMealCategory(currentTime) as string,
  })

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }))

  const submit = async () => {
    if (!form.name.trim() || !isMealCategory(form.mealCategory)) return
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        name: form.name.trim(),
        calories: Number(form.calories) || 0,
        protein: Number(form.protein) || 0,
        carbs: Number(form.carbs) || 0,
        fat: Number(form.fat) || 0,
        reason: form.reason,
        date: form.date,
        time: form.time,
        mealCategory: form.mealCategory,
      })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "เพิ่มมื้ออาหารไม่สำเร็จ")
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-3 backdrop-blur-sm sm:items-center" role="presentation" onClick={onClose}>
      <section className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="convert-meal-title" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-emerald-600">เมนูที่บันทึกไว้</p>
            <h2 id="convert-meal-title" className="mt-1 text-xl font-extrabold">เพิ่มเป็นมื้ออาหาร</h2>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 text-neutral-500" aria-label="ปิด">
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && <div className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <FormField label="ชื่ออาหาร" value={form.name} onChange={(value) => update("name", value)} className="sm:col-span-2" />
          <FormField label="แคลอรี่" value={form.calories} onChange={(value) => update("calories", value)} type="number" />
          <FormField label="โปรตีน (g)" value={form.protein} onChange={(value) => update("protein", value)} type="number" />
          <FormField label="คาร์บ (g)" value={form.carbs} onChange={(value) => update("carbs", value)} type="number" />
          <FormField label="ไขมัน (g)" value={form.fat} onChange={(value) => update("fat", value)} type="number" />
          <FormField label="วันที่" value={form.date} onChange={(value) => update("date", value)} type="date" />
          <FormField label="เวลา" value={form.time} onChange={(value) => update("time", value)} type="time" />
          <label className="block sm:col-span-2">
            <span className="text-xs font-bold text-neutral-500">หมวดมื้ออาหาร</span>
            <select value={form.mealCategory} onChange={(event) => update("mealCategory", event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-emerald-400">
              {MEAL_CATEGORIES.map((category) => <option key={category} value={category}>{MEAL_CATEGORY_LABELS[category]}</option>)}
            </select>
          </label>
        </div>

        <div className="mt-5 flex gap-3">
          <button type="button" onClick={() => void submit()} disabled={submitting} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[#2EC78F] px-5 text-sm font-extrabold text-white hover:bg-[#05b474] disabled:opacity-60">
            {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {submitting ? "กำลังเพิ่ม..." : "ยืนยันเพิ่มมื้อ"}
          </button>
          <button type="button" onClick={onClose} disabled={submitting} className="h-11 rounded-full border border-neutral-200 px-5 text-sm font-extrabold text-neutral-600 hover:bg-neutral-50">ยกเลิก</button>
        </div>
      </section>
    </div>
  )
}

function FormField({
  label,
  value,
  onChange,
  type = "text",
  className = "",
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  className?: string
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs font-bold text-neutral-500">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} type={type} className="mt-1 h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-emerald-400" />
    </label>
  )
}

function StatusMessage({
  tone,
  message,
  onRetry,
  onClose,
}: {
  tone: "error" | "success"
  message: string
  onRetry?: () => void
  onClose?: () => void
}) {
  return (
    <div className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-semibold ${tone === "error" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
      <span>{message}</span>
      {onRetry && <button type="button" onClick={onRetry} className="font-extrabold underline">ลองใหม่</button>}
      {onClose && <button type="button" onClick={onClose} aria-label="ปิด"><X className="h-4 w-4" /></button>}
    </div>
  )
}

function InsightSkeleton() {
  return (
    <div className="mx-auto max-w-7xl animate-pulse space-y-5">
      <div className="h-28 rounded-2xl bg-emerald-50" />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <div className="h-64 rounded-2xl bg-neutral-100" />
          <div className="h-80 rounded-2xl bg-neutral-100" />
        </div>
        <div className="h-40 rounded-2xl bg-neutral-100" />
      </div>
    </div>
  )
}
