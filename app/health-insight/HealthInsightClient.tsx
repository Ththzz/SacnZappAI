"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Beef,
  Bot,
  Check,
  Droplets,
  Flame,
  Lightbulb,
  Save,
} from "lucide-react"
import { getLocalDateKey, readMealEntries, readWaterLogs, type MealEntry } from "@/lib/user-data"

type TrendStatus = "good" | "over"

type CalorieTrendPoint = {
  day: string
  calories: number
  status: TrendStatus
}

type FoodAlert = {
  id: string
  icon: typeof Beef
  title: string
  description: string
  colorClass: string
  iconClass: string
}

type MealSuggestion = {
  id: string
  name: string
  caloriesDelta: number
  protein: number
}

type MacroBalanceItem = {
  label: string
  value: string
}

const calorieGoal = 1800
const chartMaxCalories = 2200
const chartHeight = 150

const mealSuggestions: MealSuggestion[] = [
  { id: "egg-rice", name: "ไข่เจียว + สลัดผัก + ข้าวกล้อง", caloriesDelta: 420, protein: 32 },
  { id: "yogurt", name: "โยเกิร์ตกรีก + ผลไม้สด", caloriesDelta: 220, protein: 18 },
  { id: "salmon", name: "ปลาแซลมอนนึ่ง + ผักอบ", caloriesDelta: 380, protein: 28 },
]

const defaultMacroBalance: MacroBalanceItem[] = [
  { label: "คาร์บ", value: "0%" },
  { label: "โปรตีน", value: "0%" },
  { label: "ไขมัน", value: "0%" },
]

function buildCalorieTrend(meals: MealEntry[]): CalorieTrendPoint[] {
  const byDate = new Map<string, number>()
  meals.forEach((meal) => {
    byDate.set(meal.date, (byDate.get(meal.date) ?? 0) + meal.calories)
  })

  const dayLabels = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"]

  return [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-7)
    .map(([date, calories]) => {
      const day = new Date(`${date}T00:00:00`).getDay()
      return {
        day: dayLabels[day],
        calories,
        status: calories > calorieGoal ? "over" as const : "good" as const,
      }
    })
}

function buildMacroBalance(meals: MealEntry[]): MacroBalanceItem[] {
  const proteinCalories = meals.reduce((sum, meal) => sum + meal.protein * 4, 0)
  const carbCalories = meals.reduce((sum, meal) => sum + meal.carbs * 4, 0)
  const fatCalories = meals.reduce((sum, meal) => sum + meal.fat * 9, 0)
  const total = proteinCalories + carbCalories + fatCalories

  if (total <= 0) return defaultMacroBalance

  return [
    { label: "คาร์บ", value: `${Math.round((carbCalories / total) * 100)}%` },
    { label: "โปรตีน", value: `${Math.round((proteinCalories / total) * 100)}%` },
    { label: "ไขมัน", value: `${Math.round((fatCalories / total) * 100)}%` },
  ]
}

export default function HealthInsightClient() {
  const [savedMealIds, setSavedMealIds] = useState<string[]>([])
  const [calorieTrend, setCalorieTrend] = useState<CalorieTrendPoint[]>([])
  const [foodAlerts, setFoodAlerts] = useState<FoodAlert[]>([])
  const [macroBalance, setMacroBalance] = useState<MacroBalanceItem[]>(defaultMacroBalance)
  const [mealCount, setMealCount] = useState(0)

  const savedCount = savedMealIds.length
  const targetLineBottom = useMemo(() => (calorieGoal / chartMaxCalories) * chartHeight, [])

  useEffect(() => {
    const meals = readMealEntries()
    const waterLogs = readWaterLogs()
    const todayKey = getLocalDateKey()
    const todayWaterMl = waterLogs
      .filter((log) => log.date === todayKey)
      .reduce((sum, log) => sum + log.amount, 0)

    setMealCount(meals.length)
    setCalorieTrend(buildCalorieTrend(meals))
    setMacroBalance(buildMacroBalance(meals))

    if (meals.length === 0 && todayWaterMl === 0) {
      setFoodAlerts([])
      return
    }

    const alerts: FoodAlert[] = []
    const totalProtein = meals.reduce((sum, meal) => sum + meal.protein, 0)
    const avgProtein = meals.length > 0 ? totalProtein / meals.length : 0

    if (meals.length > 0) {
      alerts.push({
        id: "protein",
        icon: Beef,
        title: "โปรตีน",
        description: avgProtein < 20 ? "ต่ำกว่าเป้าหมายเฉลี่ยต่อมื้อ ลองเพิ่มไข่หรือปลา" : "โปรตีนอยู่ในเกณฑ์ดี รักษาความสม่ำเสมอ",
        colorClass: avgProtein < 20 ? "bg-rose-50" : "bg-emerald-50",
        iconClass: avgProtein < 20 ? "text-red-500" : "text-emerald-500",
      })
    }

    alerts.push({
      id: "water",
      icon: Droplets,
      title: "น้ำ",
      description: todayWaterMl >= 2000 ? "ดื่มน้ำครบเป้าหมายวันนี้แล้ว" : `วันนี้ยังขาดน้ำอีก ${Math.ceil((2000 - todayWaterMl) / 250)} แก้ว`,
      colorClass: todayWaterMl >= 2000 ? "bg-emerald-50" : "bg-sky-50",
      iconClass: todayWaterMl >= 2000 ? "text-emerald-500" : "text-sky-500",
    })

    setFoodAlerts(alerts)
  }, [])

  const handleSaveMeal = (mealId: string) => {
    setSavedMealIds((current) =>
      current.includes(mealId)
        ? current.filter((id) => id !== mealId)
        : [...current, mealId],
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 text-neutral-900">
      <InsightBanner savedCount={savedCount} mealCount={mealCount} />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <main className="space-y-5">
          <CalorieTrendCard targetLineBottom={targetLineBottom} calorieTrend={calorieTrend} />
          <MealSuggestionsCard savedMealIds={savedMealIds} macroBalance={macroBalance} onSaveMeal={handleSaveMeal} />
        </main>

        <FoodAlertsPanel foodAlerts={foodAlerts} />
      </div>
    </div>
  )
}

function InsightBanner({ savedCount, mealCount }: { savedCount: number; mealCount: number }) {
  const hasMeals = mealCount > 0

  return (
    <section className="grid gap-4 rounded-2xl bg-emerald-50 p-5 shadow-sm ring-1 ring-emerald-100 lg:grid-cols-[auto_1fr_auto] lg:items-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#2EC78F] shadow-sm">
        <Bot className="h-6 w-6" />
      </div>
      <div>
        <h2 className="text-base font-extrabold text-[#2EC78F]">{hasMeals ? "สรุปจากข้อมูลจริงของคุณ" : "เริ่มสร้างข้อมูลวิเคราะห์ได้เลย"}</h2>
        <p className="mt-1 text-sm font-medium leading-6 text-emerald-700">
          {hasMeals ? `มีมื้ออาหารที่บันทึกไว้ ${mealCount} รายการ ระบบจะใช้ข้อมูลนี้ประเมินแนวโน้มและคำแนะนำ` : "ยังไม่มีมื้ออาหารที่บันทึกไว้ ลองสแกนอาหารก่อนเพื่อให้คำแนะนำแม่นขึ้น"}
          {savedCount > 0 ? ` บันทึกเมนูแนะนำไว้แล้ว ${savedCount} รายการ` : ""}
        </p>
      </div>
      <div className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#2EC78F] px-6 text-sm font-extrabold text-white">
        <Flame className="h-4 w-4" />
        {hasMeals ? `${mealCount} มื้อ` : "ยังไม่มีข้อมูล"}
      </div>
    </section>
  )
}

function CalorieTrendCard({ targetLineBottom, calorieTrend }: { targetLineBottom: number; calorieTrend: CalorieTrendPoint[] }) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold">แนวโน้มแคลอรี่ 7 วัน</h2>
          <p className="mt-1 text-xs font-semibold text-neutral-400">เป้าหมาย 1,800 kcal</p>
        </div>
        <span className="rounded-full bg-orange-50 px-4 py-1 text-xs font-bold text-orange-500">
          {calorieTrend.some((item) => item.status === "over") ? "มีวันที่เกิน" : "อยู่ในเป้า"}
        </span>
      </div>

      <div className="relative mt-6">
        {calorieTrend.length === 0 && (
          <div className="flex h-[150px] items-center justify-center rounded-2xl bg-neutral-50 text-sm font-semibold text-neutral-400">
            ยังไม่มีข้อมูลแคลอรี่สำหรับแสดงแนวโน้ม
          </div>
        )}
        {calorieTrend.length > 0 && <div className="relative h-[150px]">
          <div className="absolute inset-x-0 border-t border-orange-300" style={{ bottom: `${targetLineBottom}px` }} />
          <div className="relative z-10 flex h-full items-end justify-between gap-4">
            {calorieTrend.map((item) => (
              <div key={item.day} className="flex min-w-0 flex-1 flex-col items-center">
                <div
                  className={`w-full max-w-14 rounded-md ${item.status === "over" ? "bg-orange-400" : "bg-[#2EC78F]"}`}
                  style={{ height: `${Math.max(48, (item.calories / chartMaxCalories) * chartHeight)}px` }}
                  aria-label={`${item.day} ${item.calories} kcal`}
                />
              </div>
            ))}
          </div>
        </div>}
        {calorieTrend.length > 0 && <div className="mt-3 flex justify-between gap-4">
          {calorieTrend.map((item) => (
            <span key={item.day} className="min-w-0 flex-1 text-center text-xs font-bold text-neutral-400">
              {item.day}
            </span>
          ))}
        </div>}
      </div>
    </section>
  )
}

function FoodAlertsPanel({ foodAlerts }: { foodAlerts: FoodAlert[] }) {
  return (
    <aside className="space-y-4">
      <h2 className="text-base font-extrabold">แจ้งเตือนสารอาหาร</h2>
      {foodAlerts.length === 0 && (
        <article className="rounded-2xl bg-white p-4 text-sm font-semibold text-neutral-500 shadow-sm ring-1 ring-black/5">
          ยังไม่มีข้อมูลเพียงพอสำหรับสร้างแจ้งเตือน
        </article>
      )}
      {foodAlerts.map((alert) => {
        const Icon = alert.icon
        return (
          <article key={alert.id} className="grid grid-cols-[48px_1fr] items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${alert.colorClass}`}>
              <Icon className={`h-6 w-6 ${alert.iconClass}`} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-extrabold text-orange-500">{alert.title}</h3>
              <p className="mt-1 text-xs font-semibold leading-5 text-neutral-500">{alert.description}</p>
            </div>
          </article>
        )
      })}
    </aside>
  )
}

function MealSuggestionsCard({
  savedMealIds,
  macroBalance,
  onSaveMeal,
}: {
  savedMealIds: string[]
  macroBalance: MacroBalanceItem[]
  onSaveMeal: (mealId: string) => void
}) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-slate-400" />
          <h2 className="text-base font-extrabold">มื้อถัดไปที่แนะนำ</h2>
        </div>
        <div className="inline-flex flex-wrap items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-600">
          {macroBalance.map((macro) => (
            <span key={macro.label}>
              {macro.label} {macro.value}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {mealSuggestions.map((meal) => {
          const isSaved = savedMealIds.includes(meal.id)
          return (
            <article key={meal.id} className="grid gap-3 rounded-xl bg-neutral-50 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <h3 className="text-sm font-extrabold">{meal.name}</h3>
                <p className="mt-2 text-xs font-semibold text-orange-400">+{meal.caloriesDelta} kcal</p>
                <p className="text-xs font-semibold text-[#2EC78F]">โปรตีน {meal.protein}g</p>
              </div>
              <button
                type="button"
                onClick={() => onSaveMeal(meal.id)}
                className={`inline-flex h-10 items-center justify-center gap-2 rounded-full px-5 text-sm font-extrabold transition-colors ${
                  isSaved ? "bg-emerald-50 text-[#2EC78F] ring-1 ring-emerald-200" : "bg-[#2EC78F] text-white hover:bg-[#05b474]"
                }`}
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
