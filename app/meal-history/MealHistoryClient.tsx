"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  Download,
  Flame,
  PencilLine,
  Plus,
  Save,
  Scale,
  Trash2,
  Trophy,
  Utensils,
  X,
} from "lucide-react"
import {
  getLocalDateKey,
  getTimeBasedMealCategory,
  isMealCategory,
  MEAL_HISTORY_UPDATED_EVENT,
  MEAL_CATEGORIES,
  MEAL_CATEGORY_LABELS,
  notifyMealHistoryUpdated,
  readMealEntries,
  resolveMealCategory,
  type MealCategory,
} from "@/lib/user-data"

type ViewMode = "day" | "week" | "month"
type DayMeal = {
  id: string
  icon: string
  name: string
  time: string
  date: string
  calories: number
  tone: string
  protein?: number
  carbs?: number
  fat?: number
  source?: string
  confidence?: number
  note?: string
  mealCategory: MealCategory
}

type WeekDaySummary = {
  day: string
  full: string
  meals: number
  calories: number
  status: "good" | "warn" | "bad" | "empty"
}

type MonthDaySummary = {
  day: number
  entries: number
  calories: number
  status: "good" | "warn" | "bad" | "empty"
  isToday: boolean
}

type NutritionTargets = {
  calories: number
  protein: number
  carbs: number
  fat: number
}

type MealHistoryCachePayload = {
  historyMeals: DayMeal[]
  targets: NutritionTargets | null
}

type AppSettingsPayload = {
  settings?: {
    healthGoal?: {
      dailyCalories?: number
      currentWeightKg?: number
    }
  } | null
}

const MEAL_HISTORY_CACHE_KEY = "scanzapp.meal-history.cache.v1"
const MEAL_HISTORY_CACHE_MAX_AGE_MS = 5 * 60 * 1000

function getCalorieStatus(calories: number, targetCalories?: number): WeekDaySummary["status"] {
  if (calories === 0) return "empty"
  if (!targetCalories || targetCalories <= 0) return "good"
  if (calories > targetCalories * 1.2) return "bad"
  if (calories > targetCalories) return "warn"
  return "good"
}

function deriveTargets(payload: AppSettingsPayload): NutritionTargets | null {
  const dailyCalories = Number(payload.settings?.healthGoal?.dailyCalories)
  const weightKg = Number(payload.settings?.healthGoal?.currentWeightKg)
  if (!Number.isFinite(dailyCalories) || dailyCalories <= 0) return null

  const protein = Number.isFinite(weightKg) && weightKg > 0 ? Math.round(weightKg * 1.9) : 0
  const fat = Number.isFinite(weightKg) && weightKg > 0 ? Math.round(weightKg * 0.85) : 0
  const caloriesForCarbs = dailyCalories - protein * 4 - fat * 9

  return {
    calories: Math.round(dailyCalories),
    protein,
    fat,
    carbs: protein > 0 && fat > 0 ? Math.max(0, Math.round(caloriesForCarbs / 4)) : 0,
  }
}

function readHistoryCache() {
  if (typeof window === "undefined") return null
  try {
    const raw = window.sessionStorage.getItem(MEAL_HISTORY_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { savedAt?: number; data?: MealHistoryCachePayload }
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > MEAL_HISTORY_CACHE_MAX_AGE_MS) return null
    return parsed.data ?? null
  } catch {
    return null
  }
}

function writeHistoryCache(data: MealHistoryCachePayload) {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.setItem(MEAL_HISTORY_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data }))
  } catch {
    return
  }
}

function buildWeekDays(meals: DayMeal[], targetCalories?: number): WeekDaySummary[] {
  const dayLabels = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"]
  const fullDayLabels = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัส", "ศุกร์", "เสาร์"]
  const formatter = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short" })
  const today = new Date()

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (6 - index))
    const dateKey = getLocalDateKey(date)
    const dayMeals = meals.filter((meal) => meal.date === dateKey)
    const calories = dayMeals.reduce((sum, meal) => sum + meal.calories, 0)
    const status = getCalorieStatus(calories, targetCalories)

    return {
      day: dayLabels[date.getDay()],
      full: `${fullDayLabels[date.getDay()]} ${formatter.format(date)}`,
      meals: dayMeals.length,
      calories,
      status,
    }
  })
}

function getCurrentMonthLabel() {
  return new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric" }).format(new Date())
}

function buildMonthDays(meals: DayMeal[], targetCalories?: number): MonthDaySummary[] {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const todayKey = getLocalDateKey(today)

  return Array.from({ length: daysInMonth }, (_, index) => {
    const date = new Date(year, month, index + 1)
    const dateKey = getLocalDateKey(date)
    const dayMeals = meals.filter((meal) => meal.date === dateKey)
    const calories = dayMeals.reduce((sum, meal) => sum + meal.calories, 0)
    const status = getCalorieStatus(calories, targetCalories)

    return {
      day: index + 1,
      entries: dayMeals.length,
      calories,
      status,
      isToday: dateKey === todayKey,
    }
  })
}

export default function MealHistoryClient() {
  const initialCache = readHistoryCache()
  const [activeView, setActiveView] = useState<ViewMode>("day")
  const [selectedMeal, setSelectedMeal] = useState<DayMeal | null>(null)
  const [historyMeals, setHistoryMeals] = useState<DayMeal[]>(initialCache?.historyMeals ?? [])
  const [addingMeal, setAddingMeal] = useState(false)
  const [targets, setTargets] = useState<NutritionTargets | null>(initialCache?.targets ?? null)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const todayKey = getLocalDateKey()

  const loadHistoryData = useCallback(async () => {
    const now = new Date()
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - 6)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const rangeStart = getLocalDateKey(weekStart < monthStart ? weekStart : monthStart)
    const convertMeals = (items: ReturnType<typeof readMealEntries>) => items.map((item, index) => ({
      id: item.id || `meal-${index}`,
      icon: "🍽️",
      name: item.name,
      time: item.time,
      date: item.date,
      calories: item.calories,
      tone: item.calories > 420 ? "warn" : "good",
      protein: item.protein,
      carbs: item.carbs,
      fat: item.fat,
      source: item.source,
      confidence: item.confidence,
      note: item.note,
      mealCategory: resolveMealCategory(item),
    }))

    const [mealResult, settingsResult] = await Promise.allSettled([
      fetch(`/api/meals?from=${rangeStart}&to=${getLocalDateKey(now)}&limit=500`).then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as { meals?: ReturnType<typeof readMealEntries> }
        if (!response.ok) throw new Error("api")
        return data.meals ?? []
      }),
      fetch("/api/settings").then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as AppSettingsPayload
        if (!response.ok) throw new Error("settings")
        return data
      }),
    ])

    const loadedMeals = mealResult.status === "fulfilled" ? mealResult.value : []
    const nextHistoryMeals = convertMeals(loadedMeals)
    const nextTargets = settingsResult.status === "fulfilled" ? deriveTargets(settingsResult.value) : null
    setHistoryMeals(nextHistoryMeals)
    setTargets(nextTargets)
    setHistoryError(mealResult.status === "fulfilled" ? null : "โหลดมื้ออาหารจากเซิร์ฟเวอร์ไม่สำเร็จ กรุณาลองรีเฟรชอีกครั้ง")
    writeHistoryCache({ historyMeals: nextHistoryMeals, targets: nextTargets })
  }, [])

  useEffect(() => {
    void loadHistoryData()
  }, [loadHistoryData])

  useEffect(() => {
    const handleFocus = () => {
      void loadHistoryData()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadHistoryData()
      }
    }

    const handlePageShow = () => {
      void loadHistoryData()
    }

    window.addEventListener("focus", handleFocus)
    window.addEventListener("pageshow", handlePageShow)
    window.addEventListener(MEAL_HISTORY_UPDATED_EVENT, handleFocus)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      window.removeEventListener("focus", handleFocus)
      window.removeEventListener("pageshow", handlePageShow)
      window.removeEventListener(MEAL_HISTORY_UPDATED_EVENT, handleFocus)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [loadHistoryData])

  useEffect(() => {
    writeHistoryCache({ historyMeals, targets })
  }, [historyMeals, targets])

  const todayMeals = historyMeals.filter((meal) => meal.date === todayKey)
  const dailyCalories = todayMeals.reduce((total, meal) => total + meal.calories, 0)
  const weekDays = useMemo(() => buildWeekDays(historyMeals, targets?.calories), [historyMeals, targets])
  const monthDays = useMemo(() => buildMonthDays(historyMeals, targets?.calories), [historyMeals, targets])
  const weeklyCalories = weekDays.reduce((total, day) => total + day.calories, 0)
  const daysWithMeals = weekDays.filter((day) => day.meals > 0).length
  const averageCalories = daysWithMeals > 0 ? Math.round(weeklyCalories / daysWithMeals) : 0

  const handleDeleteMeal = async (mealId: string) => {
    const previousMeals = historyMeals
    setHistoryMeals((current) => current.filter((meal) => meal.id !== mealId))
    if (selectedMeal?.id === mealId) setSelectedMeal(null)
    setHistoryError(null)

    try {
      const response = await fetch(`/api/meals/${mealId}`, { method: "DELETE" })
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(payload?.error || "ลบมื้ออาหารไม่สำเร็จ")
      }
      notifyMealHistoryUpdated()
    } catch (error) {
      setHistoryMeals(previousMeals)
      if (selectedMeal?.id === mealId) {
        const restored = previousMeals.find((meal) => meal.id === mealId) ?? null
        setSelectedMeal(restored)
      }
      setHistoryError(error instanceof Error ? error.message : "ลบมื้ออาหารไม่สำเร็จ")
    }
  }

  const handleUpdateMeal = async (updatedMeal: DayMeal) => {
    const previousMeals = historyMeals
    const previousSelectedMeal = selectedMeal
    setHistoryMeals((current) => current.map((meal) => (meal.id === updatedMeal.id ? updatedMeal : meal)))
    setSelectedMeal(updatedMeal)
    setHistoryError(null)

    try {
      const response = await fetch(`/api/meals/${updatedMeal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: updatedMeal.name,
          calories: updatedMeal.calories,
          protein: updatedMeal.protein ?? 0,
          carbs: updatedMeal.carbs ?? 0,
          fat: updatedMeal.fat ?? 0,
          time: updatedMeal.time,
          date: updatedMeal.date,
          source: updatedMeal.source ?? "scan",
          confidence: updatedMeal.confidence,
          note: updatedMeal.note,
          mealCategory: updatedMeal.mealCategory,
        }),
      })
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(payload?.error || "อัปเดตมื้ออาหารไม่สำเร็จ")
      }
      notifyMealHistoryUpdated()
    } catch (error) {
      setHistoryMeals(previousMeals)
      setSelectedMeal(previousSelectedMeal)
      setHistoryError(error instanceof Error ? error.message : "อัปเดตมื้ออาหารไม่สำเร็จ")
    }
  }

  const handleAddManualMeal = async (meal: DayMeal) => {
    const previousMeals = historyMeals
    setHistoryMeals((current) => [meal, ...current])
    setHistoryError(null)

    try {
      const response = await fetch("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: meal.id,
          name: meal.name,
          calories: meal.calories,
          protein: meal.protein ?? 0,
          carbs: meal.carbs ?? 0,
          fat: meal.fat ?? 0,
          time: meal.time,
          date: meal.date,
          source: "manual",
          confidence: meal.confidence,
          note: meal.note,
          mealCategory: meal.mealCategory,
        }),
      })
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(payload?.error || "บันทึกมื้ออาหารไม่สำเร็จ")
      }
      notifyMealHistoryUpdated()
      setAddingMeal(false)
    } catch (error) {
      setHistoryMeals(previousMeals)
      setHistoryError(error instanceof Error ? error.message : "บันทึกมื้ออาหารไม่สำเร็จ")
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 text-neutral-900">
      {historyError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {historyError}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ViewTabs activeView={activeView} onChange={setActiveView} />
        <button
          type="button"
          onClick={() => setAddingMeal(true)}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4" />
          เพิ่มมื้อเอง
        </button>
      </div>

      {activeView === "day" && <DailyView meals={todayMeals} dailyCalories={dailyCalories} targets={targets} onSelectMeal={setSelectedMeal} onDeleteMeal={handleDeleteMeal} />}
      {activeView === "week" && <WeeklyView averageCalories={averageCalories} weekDays={weekDays} targetCalories={targets?.calories} />}
      {activeView === "month" && <MonthlyView monthDays={monthDays} targetCalories={targets?.calories} />}

      {selectedMeal && <MealDetailModal meal={selectedMeal} onClose={() => setSelectedMeal(null)} onDelete={handleDeleteMeal} onUpdate={handleUpdateMeal} />}
      {addingMeal && <ManualMealModal onClose={() => setAddingMeal(false)} onAdd={handleAddManualMeal} />}
    </div>
  )
}

function ViewTabs({ activeView, onChange }: { activeView: ViewMode; onChange: (view: ViewMode) => void }) {
  const tabs: { value: ViewMode; label: string }[] = [
    { value: "day", label: "วันนี้" },
    { value: "week", label: "สัปดาห์" },
    { value: "month", label: "เดือน" },
  ]

  return (
    <div className="grid w-full max-w-[430px] grid-cols-3 rounded-full bg-white p-1 shadow-sm ring-1 ring-black/5">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onChange(tab.value)}
          className={`h-10 rounded-full text-sm font-bold transition-colors ${
            activeView === tab.value ? "bg-[#2EC78F] text-white shadow-sm" : "text-neutral-500 hover:bg-neutral-50"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

function DailyView({
  meals,
  dailyCalories,
  targets,
  onSelectMeal,
  onDeleteMeal,
}: {
  meals: DayMeal[]
  dailyCalories: number
  targets: NutritionTargets | null
  onSelectMeal: (meal: DayMeal) => void
  onDeleteMeal: (mealId: string) => void
}) {
  const percent = targets?.calories ? Math.round((dailyCalories / targets.calories) * 100) : null
  const totalProtein = meals.reduce((sum, meal) => sum + (meal.protein ?? 0), 0)
  const advice = meals.length === 0
    ? "ยังไม่มีข้อมูลมื้ออาหารสำหรับสร้างข้อเสนอแนะ"
    : targets?.protein && totalProtein < targets.protein
      ? "โปรตีนวันนี้ยังต่ำกว่าเป้าหมายที่ตั้งไว้ ลองเพิ่มแหล่งโปรตีนในมื้อถัดไป"
      : "สรุปนี้คำนวณจากมื้ออาหารที่คุณบันทึกจริงในวันนี้"

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <main className="space-y-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px]">
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-extrabold">วันนี้</h2>
                <p className="text-sm text-neutral-500">รวม {dailyCalories.toLocaleString()} kcal จาก {meals.length} มื้อ</p>
              </div>
              {percent !== null && <span className="text-sm font-extrabold text-[#2EC78F]">{percent}%</span>}
            </div>
            {percent !== null && (
              <div className="mt-4 h-2 rounded-full bg-neutral-100">
                <div className="h-full rounded-full bg-[#2EC78F]" style={{ width: `${Math.min(percent, 100)}%` }} />
              </div>
            )}
          </section>

          <div className="grid content-start gap-3">
            <ExportButton label="ส่งออก PDF" />
            <ExportButton label="ส่งออก CSV" />
          </div>
        </div>

        <section>
          <h2 className="text-base font-extrabold">มื้ออาหารวันนี้</h2>
          <div className="mt-3 space-y-3">
            {meals.length === 0 && (
              <div className="rounded-2xl bg-white p-5 text-sm font-medium text-neutral-500 shadow-sm ring-1 ring-black/5">
                ยังไม่มีมื้ออาหารที่บันทึกไว้ ลองสแกนอาหารจากหน้าสแกนอาหารเพื่อเริ่มสร้างประวัติจริง
              </div>
            )}
            {meals.map((meal) => (
              <article
                key={meal.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectMeal(meal)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    onSelectMeal(meal)
                  }
                }}
                className="grid cursor-pointer grid-cols-[42px_1fr_auto_28px] items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#2EC78F]/40"
                aria-label={`ดูรายละเอียด ${meal.name}`}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-50 text-xl">{meal.icon}</div>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-extrabold">{meal.name}</h3>
                  <p className="text-xs font-medium text-neutral-400">{meal.date} · {meal.time}</p>
                </div>
                <p className={`text-sm font-extrabold ${meal.tone === "warn" ? "text-orange-500" : "text-[#2EC78F]"}`}>{meal.calories} kcal</p>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    onDeleteMeal(meal.id)
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-50 text-neutral-300 hover:bg-rose-50 hover:text-rose-500"
                  aria-label={`ลบ ${meal.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </article>
            ))}
          </div>
        </section>
      </main>

      <aside className="space-y-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h2 className="text-base font-extrabold">สรุปโภชนาการ</h2>
        <div className="rounded-2xl bg-emerald-50 p-5">
          <p className="flex items-center gap-2 text-xs font-bold text-[#2EC78F]">
            <Flame className="h-4 w-4 text-orange-500" />
            แคลอรี่วันนี้
          </p>
          <div className="mt-1 flex items-end gap-2">
            <span className="text-3xl font-black text-[#2EC78F]">{dailyCalories.toLocaleString()}</span>
            <span className="pb-1 text-sm font-semibold text-neutral-500">
              {targets?.calories ? `/ ${targets.calories.toLocaleString()} kcal` : "kcal"}
            </span>
          </div>
        </div>
        <MacroSummary meals={meals} targets={targets} />
        <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-700">
          <p className="font-extrabold">ข้อสังเกตจากข้อมูลจริง</p>
          <p className="mt-2 text-xs leading-5">{advice}</p>
        </div>
      </aside>
    </div>
  )
}

function WeeklyView({ averageCalories, weekDays, targetCalories }: { averageCalories: number; weekDays: WeekDaySummary[]; targetCalories?: number }) {
  const maxCalories = Math.max(targetCalories ? targetCalories * 1.25 : 0, ...weekDays.map((day) => day.calories), 1)
  const chartHeight = 150
  const targetLineBottom = targetCalories ? (targetCalories / maxCalories) * chartHeight : null
  const totalMeals = weekDays.reduce((sum, day) => sum + day.meals, 0)
  const trackedDays = weekDays.filter((day) => day.meals > 0)
  const onTargetDays = targetCalories ? trackedDays.filter((day) => day.calories <= targetCalories).length : 0
  const consistency = targetCalories && trackedDays.length > 0 ? Math.round((onTargetDays / trackedDays.length) * 100) : null

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.95fr)]">
      <main className="space-y-5">
        <section className="grid gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:grid-cols-3">
          <StatBlock label="สรุปสัปดาห์นี้" value={averageCalories.toLocaleString()} helper="kcal เฉลี่ยต่อวันที่มีข้อมูล" />
          <StatBlock label="มื้อทั้งหมด" value={totalMeals.toLocaleString()} helper="มื้อ" />
          <StatBlock label="เข้าเป้า" value={consistency !== null ? `${consistency}%` : "ยังไม่มีเป้าหมาย"} helper="วันที่มีข้อมูล" valueClassName="text-[#2EC78F]" />
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <h2 className="text-sm font-extrabold">แคลอรี่รายวัน (สัปดาห์)</h2>
          <p className="mt-1 text-xs text-neutral-400">{targetCalories ? `เป้าหมาย ${targetCalories.toLocaleString()} kcal` : "ยังไม่มีเป้าหมายแคลอรี่"}</p>
          <div className="relative mt-6">
            <div className="relative h-[150px]">
              {targetLineBottom !== null && <div className="absolute inset-x-0 border-t border-red-200" style={{ bottom: `${targetLineBottom}px` }} />}
              <div className="relative flex h-full items-end justify-between gap-4">
                {weekDays.map((item) => (
                  <div key={item.day} className="flex min-w-0 flex-1 flex-col items-center">
                    <span className={`mb-2 text-[10px] font-bold ${item.status === "empty" ? "text-neutral-300" : item.status === "warn" || item.status === "bad" ? "text-orange-400" : "text-[#2EC78F]"}`}>
                      {item.calories}
                    </span>
                    <div
                      className={`w-full max-w-12 rounded-md ${item.status === "empty" ? "bg-neutral-200" : item.status === "warn" || item.status === "bad" ? "bg-orange-400" : "bg-[#2EC78F]"}`}
                      style={{ height: `${item.calories === 0 ? 12 : Math.max(44, (item.calories / maxCalories) * chartHeight)}px` }}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-3 flex justify-between gap-4">
              {weekDays.map((item) => (
                <span key={item.day} className="min-w-0 flex-1 text-center text-xs font-bold text-neutral-400">
                  {item.day}
                </span>
              ))}
            </div>
          </div>
        </section>
      </main>

      <aside className="space-y-5">
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <h2 className="text-sm font-extrabold">รายละเอียดรายวัน</h2>
          <div className="mt-4 space-y-2">
            {weekDays.map((item) => (
              <div key={item.full} className="grid grid-cols-[24px_1fr_40px_80px] items-center gap-3 rounded-lg bg-emerald-50/45 px-3 py-2 text-xs">
                <StatusIcon status={item.status} />
                <span className="font-semibold text-neutral-600">{item.full}</span>
                <span className="text-center font-semibold text-neutral-500">{item.meals}</span>
                <span className={`text-right font-extrabold ${item.status === "empty" ? "text-neutral-300" : item.status === "warn" || item.status === "bad" ? "text-orange-500" : "text-[#2EC78F]"}`}>{item.calories} kcal</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <h2 className="text-sm font-extrabold">มาโครนิวเทรียนต์เฉลี่ยต่อวัน</h2>
          <p className="mt-3 text-sm font-medium leading-6 text-neutral-500">
            ระบบจะแสดงมาโครจากมื้ออาหารจริงในแท็บวันนี้และรายละเอียดของแต่ละมื้อ
          </p>
        </section>
      </aside>
    </div>
  )
}

function MonthlyView({ monthDays, targetCalories }: { monthDays: MonthDaySummary[]; targetCalories?: number }) {
  const trackedDays = monthDays.filter((item) => item.entries > 0)
  const totalCalories = monthDays.reduce((sum, item) => sum + item.calories, 0)
  const totalMeals = monthDays.reduce((sum, item) => sum + item.entries, 0)
  const onTargetDays = targetCalories ? trackedDays.filter((item) => item.calories <= targetCalories).length : 0
  const averageCalories = trackedDays.length > 0 ? Math.round(totalCalories / trackedDays.length) : 0
  const monthSummary = [
    { icon: Flame, label: "แคลอรี่เฉลี่ย/วัน", value: `${averageCalories.toLocaleString()} kcal`, bg: "bg-amber-50", color: "text-orange-500" },
    { icon: Utensils, label: "มื้ออาหารทั้งหมด", value: `${totalMeals.toLocaleString()} มื้อ`, bg: "bg-emerald-50", color: "text-emerald-500" },
    { icon: Trophy, label: "วันที่ทำสำเร็จ", value: targetCalories ? `${onTargetDays}/${trackedDays.length} วัน` : "ยังไม่มีเป้าหมาย", bg: "bg-emerald-50", color: "text-amber-500" },
    { icon: Scale, label: "วันที่มีข้อมูล", value: `${trackedDays.length}/${monthDays.length} วัน`, bg: "bg-slate-50", color: "text-slate-500" },
  ]

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
      <main className="space-y-4">
        <div className="flex w-full max-w-[360px] items-center justify-between rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-black/5">
          <button type="button" className="text-neutral-400 hover:text-neutral-700" aria-label="เดือนก่อนหน้า">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h2 className="text-sm font-extrabold">{getCurrentMonthLabel()}</h2>
          <button type="button" className="text-neutral-400 hover:text-neutral-700" aria-label="เดือนถัดไป">
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <h2 className="text-sm font-extrabold">ปฏิทินบันทึกมื้ออาหาร</h2>
          <div className="mt-4 grid grid-cols-7 gap-2 text-center text-xs font-bold text-neutral-500">
            {["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-2">
            {monthDays.map((item) => (
              <button
                key={item.day}
                type="button"
                className={`min-h-[58px] rounded-lg bg-neutral-50 p-2 text-left ring-1 ring-transparent transition-colors hover:bg-neutral-100 ${
                  item.isToday ? "ring-[#2EC78F]" : ""
                }`}
              >
                <span className="text-xs font-bold text-neutral-500">{item.day}</span>
                {item.entries > 0 && <p className="mt-1 text-[10px] font-semibold text-neutral-400">{item.entries} มื้อ</p>}
                <span
                  className={`mt-1 block h-1 rounded-full ${
                    item.status === "good"
                      ? "bg-[#2EC78F]"
                      : item.status === "warn"
                        ? "bg-orange-400"
                        : item.status === "bad"
                          ? "bg-red-500"
                          : "bg-transparent"
                  }`}
                />
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-xs font-semibold text-neutral-500">
            <Legend color="bg-[#2EC78F]" label="ดี" />
            <Legend color="bg-orange-400" label="เกินเป้า" />
            <Legend color="bg-red-500" label="เกินมาก" />
            <Legend color="bg-white ring-1 ring-neutral-300" label="ยังไม่มีข้อมูล" />
          </div>
        </section>
      </main>

      <aside className="space-y-4">
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <h2 className="text-sm font-extrabold">สรุปเดือนนี้</h2>
          <p className="mt-1 text-xs font-semibold text-neutral-400">จากข้อมูลที่บันทึกจริง</p>
          <div className="mt-4 space-y-3">
            {monthSummary.map((item) => {
              const Icon = item.icon
              return (
                <div key={item.label} className={`grid grid-cols-[34px_1fr] items-center gap-3 rounded-xl p-4 ${item.bg}`}>
                  <Icon className={`h-5 w-5 ${item.color}`} />
                  <div>
                    <p className="text-xs font-semibold text-neutral-400">{item.label}</p>
                    <p className="text-xl font-black">{item.value}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
        <ExportButton label="ส่งออกรายงานเดือน (PDF)" full />
      </aside>
    </div>
  )
}

function MealDetailModal({
  meal,
  onClose,
  onDelete,
  onUpdate,
}: {
  meal: DayMeal
  onClose: () => void
  onDelete: (mealId: string) => void
  onUpdate: (meal: DayMeal) => void
}) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    name: meal.name,
    calories: String(meal.calories),
    protein: String(meal.protein ?? 0),
    carbs: String(meal.carbs ?? 0),
    fat: String(meal.fat ?? 0),
    date: meal.date,
    time: meal.time,
    note: meal.note ?? "",
    mealCategory: meal.mealCategory as string,
  })
  const detail = {
    protein: meal.protein ?? 0,
    carbs: meal.carbs ?? 0,
    fat: meal.fat ?? 0,
    portion: "1 จาน",
    source: meal.source === "scan" ? "สแกนจากภาพ" : "บันทึกด้วยมือ",
    ingredients: ["ไม่ระบุส่วนประกอบ"],
    note: meal.note ?? "ยังไม่มีคำแนะนำเพิ่มเติมสำหรับมื้อนี้",
  }
  const macros = [
    { label: "โปรตีน", value: detail.protein, unit: "g", color: "bg-emerald-400" },
    { label: "คาร์บ", value: detail.carbs, unit: "g", color: "bg-blue-500" },
    { label: "ไขมัน", value: detail.fat, unit: "g", color: "bg-orange-400" },
  ]
  const maxMacro = Math.max(...macros.map((macro) => macro.value), 1)

  const updateField = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const saveChanges = () => {
    const nextMeal: DayMeal = {
      ...meal,
      name: form.name.trim() || meal.name,
      calories: Number(form.calories) || 0,
      protein: Number(form.protein) || 0,
      carbs: Number(form.carbs) || 0,
      fat: Number(form.fat) || 0,
      date: form.date,
      time: form.time,
      note: form.note.trim(),
      mealCategory: isMealCategory(form.mealCategory) ? form.mealCategory : resolveMealCategory(meal),
    }
    onUpdate(nextMeal)
    setEditing(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-3 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-labelledby="meal-detail-title">
      <div className="w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-neutral-100 p-5">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-3xl">{meal.icon}</div>
            <div className="min-w-0">
              <h2 id="meal-detail-title" className="truncate text-xl font-black text-neutral-950">{meal.name}</h2>
              <p className="mt-1 flex items-center gap-1 text-sm font-semibold text-neutral-400">
                <Clock className="h-4 w-4" />
                {meal.time} · {detail.portion}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={() => setEditing((current) => !current)} className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-50 text-neutral-400 hover:bg-emerald-50 hover:text-emerald-600" aria-label="แก้ไขมื้ออาหาร">
              <PencilLine className="h-4 w-4" />
            </button>
            <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-50 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700" aria-label="ปิดรายละเอียดมื้ออาหาร">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="space-y-5 p-5">
          {editing && (
            <section className="grid gap-3 rounded-2xl bg-neutral-50 p-4 sm:grid-cols-2">
              <EditField label="ชื่ออาหาร" value={form.name} onChange={(value) => updateField("name", value)} className="sm:col-span-2" />
              <EditField label="แคลอรี่" value={form.calories} onChange={(value) => updateField("calories", value)} type="number" />
              <EditField label="โปรตีน (g)" value={form.protein} onChange={(value) => updateField("protein", value)} type="number" />
              <EditField label="คาร์บ (g)" value={form.carbs} onChange={(value) => updateField("carbs", value)} type="number" />
              <EditField label="ไขมัน (g)" value={form.fat} onChange={(value) => updateField("fat", value)} type="number" />
              <EditField label="วันที่" value={form.date} onChange={(value) => updateField("date", value)} type="date" />
              <EditField label="เวลา" value={form.time} onChange={(value) => updateField("time", value)} type="time" />
              <MealCategoryField value={form.mealCategory} onChange={(value) => updateField("mealCategory", value)} />
              <label className="block sm:col-span-2">
                <span className="text-xs font-bold text-neutral-500">โน้ต</span>
                <textarea
                  value={form.note}
                  onChange={(event) => updateField("note", event.target.value)}
                  className="mt-1 min-h-20 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400"
                />
              </label>
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <button type="button" onClick={saveChanges} className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700">
                  <Save className="h-4 w-4" />
                  บันทึก
                </button>
                <button type="button" onClick={() => setEditing(false)} className="inline-flex h-10 items-center justify-center rounded-full border border-neutral-200 px-4 text-sm font-bold text-neutral-600 hover:bg-white">
                  ยกเลิก
                </button>
              </div>
            </section>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-emerald-50 p-4">
              <p className="text-xs font-bold text-emerald-600">แคลอรี่</p>
              <p className="mt-1 text-2xl font-black text-[#2EC78F]">{meal.calories}</p>
              <p className="text-xs font-semibold text-neutral-500">kcal</p>
            </div>
            <InfoTile label="ที่มา" value={detail.source} />
            <InfoTile label="หมวดมื้อ" value={MEAL_CATEGORY_LABELS[meal.mealCategory]} />
          </div>

          {meal.mealCategory === "special" && (
            <section className="rounded-2xl bg-violet-50 p-4 text-sm text-violet-700">
              <h3 className="font-extrabold">มื้อพิเศษ</h3>
              <p className="mt-1 leading-6">มื้อนี้ถูกบันทึกในช่วง 22:00–04:59 ซึ่งอยู่นอกช่วงเวลาของสามมื้อหลัก</p>
            </section>
          )}

          <section>
            <h3 className="text-sm font-extrabold text-neutral-950">สารอาหารหลัก</h3>
            <div className="mt-3 space-y-3">
              {macros.map((macro) => (
                <div key={macro.label} className="grid grid-cols-[64px_1fr_52px] items-center gap-3 text-sm">
                  <span className="font-semibold text-neutral-500">{macro.label}</span>
                  <div className="h-2 rounded-full bg-neutral-100">
                    <div className={`h-full rounded-full ${macro.color}`} style={{ width: `${Math.max(8, (macro.value / maxMacro) * 100)}%` }} />
                  </div>
                  <span className="text-right font-extrabold text-neutral-800">{macro.value}{macro.unit}</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-extrabold text-neutral-950">ส่วนประกอบที่ตรวจพบ</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {detail.ingredients.map((ingredient) => (
                <span key={ingredient} className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold text-neutral-600">
                  {ingredient}
                </span>
              ))}
            </div>
          </section>

          <section className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-700">
            <h3 className="font-extrabold">ข้อเสนอแนะจาก ScanZapp AI</h3>
            <p className="mt-2 leading-6">{detail.note}</p>
          </section>

          <button
            type="button"
            onClick={() => onDelete(meal.id)}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-rose-200 text-sm font-bold text-rose-500 hover:bg-rose-50"
          >
            <Trash2 className="h-4 w-4" />
            ลบมื้อนี้
          </button>
        </div>
      </div>
    </div>
  )
}

function ManualMealModal({ onClose, onAdd }: { onClose: () => void; onAdd: (meal: DayMeal) => Promise<void> }) {
  const now = new Date()
  const [form, setForm] = useState({
    name: "",
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
    date: getLocalDateKey(now),
    time: now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", hour12: false }),
    note: "",
    mealCategory: getTimeBasedMealCategory(
      now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", hour12: false }),
    ) as string,
  })

  const updateField = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const submit = async () => {
    const name = form.name.trim()
    if (!name) return

    await onAdd({
      id: `manual-${Date.now()}`,
      icon: "🍽️",
      name,
      time: form.time,
      date: form.date,
      calories: Number(form.calories) || 0,
      tone: Number(form.calories) > 420 ? "warn" : "good",
      protein: Number(form.protein) || 0,
      carbs: Number(form.carbs) || 0,
      fat: Number(form.fat) || 0,
      source: "manual",
      confidence: 100,
      note: form.note.trim(),
      mealCategory: isMealCategory(form.mealCategory) ? form.mealCategory : getTimeBasedMealCategory(form.time),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-3 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-labelledby="manual-meal-title">
      <div className="w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-neutral-100 p-5">
          <div>
            <h2 id="manual-meal-title" className="text-xl font-black text-neutral-950">เพิ่มมื้ออาหารเอง</h2>
            <p className="mt-1 text-sm font-semibold text-neutral-400">บันทึกข้อมูลโภชนาการโดยไม่ต้องสแกนภาพ</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-50 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700" aria-label="ปิดฟอร์มเพิ่มมื้ออาหาร">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-2">
          <EditField label="ชื่ออาหาร" value={form.name} onChange={(value) => updateField("name", value)} className="sm:col-span-2" />
          <EditField label="แคลอรี่" value={form.calories} onChange={(value) => updateField("calories", value)} type="number" />
          <EditField label="โปรตีน (g)" value={form.protein} onChange={(value) => updateField("protein", value)} type="number" />
          <EditField label="คาร์บ (g)" value={form.carbs} onChange={(value) => updateField("carbs", value)} type="number" />
          <EditField label="ไขมัน (g)" value={form.fat} onChange={(value) => updateField("fat", value)} type="number" />
          <EditField label="วันที่" value={form.date} onChange={(value) => updateField("date", value)} type="date" />
          <EditField label="เวลา" value={form.time} onChange={(value) => updateField("time", value)} type="time" />
          <MealCategoryField value={form.mealCategory} onChange={(value) => updateField("mealCategory", value)} />
          <label className="block sm:col-span-2">
            <span className="text-xs font-bold text-neutral-500">โน้ต</span>
            <textarea
              value={form.note}
              onChange={(event) => updateField("note", event.target.value)}
              className="mt-1 min-h-20 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400"
            />
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button type="button" onClick={() => void submit()} className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700">
              <Save className="h-4 w-4" />
              บันทึกมื้ออาหาร
            </button>
            <button type="button" onClick={onClose} className="inline-flex h-10 items-center justify-center rounded-full border border-neutral-200 px-4 text-sm font-bold text-neutral-600 hover:bg-neutral-50">
              ยกเลิก
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function MealCategoryField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-neutral-500">หมวดมื้ออาหาร</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-emerald-400"
      >
        {MEAL_CATEGORIES.map((category) => (
          <option key={category} value={category}>
            {MEAL_CATEGORY_LABELS[category]}
          </option>
        ))}
      </select>
    </label>
  )
}

function EditField({
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
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        className="mt-1 h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-emerald-400"
      />
    </label>
  )
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-neutral-50 p-4">
      <p className="text-xs font-bold text-neutral-400">{label}</p>
      <p className="mt-1 text-base font-black text-neutral-900">{value}</p>
    </div>
  )
}

function MacroSummary({ meals, targets, compact = false }: { meals: DayMeal[]; targets: NutritionTargets | null; compact?: boolean }) {
  const rows = [
    {
      label: "โปรตีน",
      current: meals.reduce((sum, meal) => sum + (meal.protein ?? 0), 0),
      target: targets?.protein,
      color: "bg-emerald-400",
    },
    {
      label: "คาร์โบไฮเดรต",
      current: meals.reduce((sum, meal) => sum + (meal.carbs ?? 0), 0),
      target: targets?.carbs,
      color: "bg-blue-500",
    },
    {
      label: "ไขมัน",
      current: meals.reduce((sum, meal) => sum + (meal.fat ?? 0), 0),
      target: targets?.fat,
      color: "bg-orange-400",
    },
  ]

  return (
    <div className={compact ? "mt-4 space-y-3" : "space-y-3"}>
      {rows.map((item) => {
        const hasTarget = Boolean(item.target && item.target > 0)
        const width = hasTarget ? Math.min(100, (item.current / Number(item.target)) * 100) : meals.length > 0 ? 100 : 0

        return (
        <div key={item.label}>
          <div className="mb-1 flex items-center justify-between gap-2 text-xs font-semibold">
            <span className="text-neutral-600">{item.label}</span>
            <span className="text-neutral-500">
              {Math.round(item.current)}g{hasTarget ? ` / ${item.target}g` : ""}
            </span>
          </div>
          <div className="h-2 rounded-full bg-neutral-100">
            <div className={`h-full rounded-full ${item.color}`} style={{ width: `${width}%` }} />
          </div>
        </div>
        )
      })}
    </div>
  )
}

function ExportButton({ label, full = false }: { label: string; full?: boolean }) {
  return (
    <button
      type="button"
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[#2EC78F] bg-white px-5 text-sm font-bold text-[#2EC78F] transition-colors hover:bg-emerald-50 ${
        full ? "w-full" : ""
      }`}
    >
      <Download className="h-4 w-4" />
      {label}
    </button>
  )
}

function StatBlock({ label, value, helper, valueClassName = "text-neutral-900" }: { label: string; value: string; helper: string; valueClassName?: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-neutral-400">{label}</p>
      <p className={`mt-1 text-2xl font-black ${valueClassName}`}>{value}</p>
      <p className="text-xs font-semibold text-neutral-400">{helper}</p>
    </div>
  )
}

function StatusIcon({ status }: { status: string }) {
  if (status === "bad") return <Trash2 className="h-4 w-4 text-red-500" />
  if (status === "warn") return <AlertTriangle className="h-4 w-4 text-neutral-900" />
  if (status === "empty") return <Clock className="h-4 w-4 text-neutral-300" />
  return (
    <span className="flex h-4 w-4 items-center justify-center rounded-sm bg-green-500 text-white">
      <Check className="h-3 w-3" />
    </span>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`h-3 w-3 rounded-sm ${color}`} />
      {label}
    </span>
  )
}
