"use client"

import { useEffect, useState } from "react"
import { Droplets, Plus, Sun, Target, Utensils } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import {
  getLocalDateKey,
  MEAL_CATEGORY_LABELS,
  readMealEntries,
  readWaterLogs,
  resolveMealCategory,
  type MealCategory,
  type MealEntry,
  type WaterLogEntry,
  writeMealEntries,
  writeWaterLogs,
} from "@/lib/user-data"
import LegacyMealClassifier from "./LegacyMealClassifier"

type DashboardData = {
  meals: MealEntry[]
  waterLogs: WaterLogEntry[]
  calorieGoal: number | null
}

const DASHBOARD_CACHE_KEY = "nutriscan.dashboard.v1"
const SETTINGS_STORAGE_KEY = "nutriscan.settings.v1"
const EMPTY_DASHBOARD: DashboardData = {
  meals: [],
  waterLogs: [],
  calorieGoal: null,
}

export default function General() {
  const [dashboard, setDashboard] = useState<DashboardData>(EMPTY_DASHBOARD)
  const [progressReady, setProgressReady] = useState(false)
  const { meals, waterLogs, calorieGoal } = dashboard

  useEffect(() => {
    const cached = readDashboardCache()
    const localMeals = readMealEntries()
    const localWaterLogs = readWaterLogs()
    const localCalorieGoal = readStoredCalorieGoal()
    const immediateData: DashboardData = {
      meals: localMeals.length > 0 ? localMeals : cached?.meals ?? [],
      waterLogs: localWaterLogs.length > 0 ? localWaterLogs : cached?.waterLogs ?? [],
      calorieGoal: localCalorieGoal ?? cached?.calorieGoal ?? null,
    }
    setDashboard(immediateData)

    const controller = new AbortController()
    let firstFrame = 0
    let secondFrame = 0

    fetch("/api/dashboard", { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json() as Partial<DashboardData>
        if (!response.ok) throw new Error("dashboard")
        return data
      })
      .then((serverData) => {
      if (controller.signal.aborted) return

      const nextData: DashboardData = {
        meals: Array.isArray(serverData.meals) ? serverData.meals : immediateData.meals,
        waterLogs: Array.isArray(serverData.waterLogs) ? serverData.waterLogs : immediateData.waterLogs,
        calorieGoal: typeof serverData.calorieGoal === "number"
          ? serverData.calorieGoal
          : immediateData.calorieGoal,
      }
      setDashboard(nextData)
      window.localStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(nextData))
      writeMealEntries(nextData.meals)
      writeWaterLogs(nextData.waterLogs)

      setProgressReady(false)
      firstFrame = window.requestAnimationFrame(() => {
        secondFrame = window.requestAnimationFrame(() => setProgressReady(true))
      })
      })
      .catch(() => {
        if (controller.signal.aborted) return
        firstFrame = window.requestAnimationFrame(() => {
          secondFrame = window.requestAnimationFrame(() => setProgressReady(true))
        })
      })

    return () => {
      controller.abort()
      window.cancelAnimationFrame(firstFrame)
      window.cancelAnimationFrame(secondFrame)
    }
  }, [])

  const todayKey = getLocalDateKey()
  const todayMeals = meals.filter((meal) => meal.date === todayKey)
  const caloriesConsumed = todayMeals.reduce((sum, meal) => sum + meal.calories, 0)
  const protein = todayMeals.reduce((sum, meal) => sum + meal.protein, 0)
  const fat = todayMeals.reduce((sum, meal) => sum + meal.fat, 0)
  const carbs = todayMeals.reduce((sum, meal) => sum + meal.carbs, 0)
  const waterTotalMl = waterLogs
    .filter((item) => item.date === todayKey)
    .reduce((sum, item) => sum + item.amount, 0)
  const waterCups = Math.round(waterTotalMl / 250)
  const calorieProgress = calorieGoal ? Math.min((caloriesConsumed / calorieGoal) * 100, 100) : 0
  const caloriesLeft = calorieGoal ? calorieGoal - caloriesConsumed : null
  const progressWidth = progressReady ? `${calorieProgress}%` : "0%"

  const nutrientSummary = [
    { label: "โปรตีน", value: `${Math.round(protein)}g` },
    { label: "ไขมัน", value: `${Math.round(fat)}g` },
    { label: "คาร์บ", value: `${Math.round(carbs)}g` },
  ]

  const statCards = [
    {
      icon: <Droplets className="h-3.5 w-3.5 text-sky-500" />,
      label: "น้ำวันนี้",
      value: `${waterCups} แก้ว`,
      accent: "text-sky-500",
    },
    {
      icon: <Utensils className="h-3.5 w-3.5 text-orange-500" />,
      label: "มื้อวันนี้",
      value: `${todayMeals.length} มื้อ`,
      accent: "text-orange-500",
    },
    {
      icon: <Target className="h-3.5 w-3.5 text-emerald-500" />,
      label: "เป้าหมาย",
      value: calorieGoal ? `${Math.round(calorieProgress)}%` : "ยังไม่มี",
      accent: "text-emerald-500",
    },
  ]

  const latestMeals = meals.slice(0, 3).map((meal) => ({
    icon: "🍽️",
    title: meal.name,
    time: meal.time,
    category: MEAL_CATEGORY_LABELS[resolveMealCategory(meal)],
    calories: `${meal.calories} kcal`,
  }))

  const mealSlots = [
    { icon: "🌅", title: "เช้า", category: "breakfast" },
    { icon: "☀️", title: "กลางวัน", category: "lunch" },
    { icon: "🌙", title: "เย็น", category: "dinner" },
    { icon: "+", title: "ของว่าง", category: "snack" },
    { icon: "✨", title: "มื้อพิเศษ", category: "special", description: "มื้อหลักช่วง 22:00–04:59" },
  ].map((slot) => {
    const matchedMeals = todayMeals.filter(
      (meal) => resolveMealCategory(meal) === (slot.category as MealCategory),
    )

    return {
      icon: slot.icon,
      title: slot.title,
      subtitle: matchedMeals.length > 0 ? `${matchedMeals.length} รายการ` : "ยังไม่มีข้อมูล",
      hasData: matchedMeals.length > 0,
      description: slot.description,
    }
  })

  return (
    <div className="w-full space-y-5 sm:space-y-7">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,2.15fr)_minmax(380px,1.15fr)]">
        <Card className="border-0 bg-[#39C88F] py-0 text-white shadow-[0_16px_32px_-24px_rgba(46,199,143,0.78)] ring-0">
          <CardContent className="flex min-h-[138px] flex-col justify-between p-4 sm:min-h-[108px] sm:p-5">
            <div className="space-y-2">
              <p className="text-xs font-normal text-white/80">แคลอรี่วันนี้</p>
              <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="flex items-end gap-1.5">
                  <span className="text-[2.6rem] font-bold leading-none sm:text-[3rem]">{caloriesConsumed.toLocaleString()}</span>
                  <span className="pb-1 text-[0.95rem] font-normal leading-none sm:text-[1.1rem]">
                    {calorieGoal ? `/ ${calorieGoal.toLocaleString()} kcal` : "kcal"}
                  </span>
                </div>

                <div className="grid w-full grid-cols-3 gap-1.5 sm:w-auto sm:gap-2">
                  {nutrientSummary.map((item) => (
                    <div
                      key={item.label}
                      className="inline-flex h-7 min-w-0 items-center justify-center rounded-full bg-white/16 px-2 text-[9px] font-normal text-white sm:min-w-[78px] sm:px-3 sm:text-[10px]"
                    >
                      {item.label} {item.value}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="h-1.5 overflow-hidden rounded-full bg-white/22">
                <div
                  className="h-full rounded-full bg-white transition-[width] duration-700 ease-out"
                  style={{ width: progressWidth }}
                />
              </div>
              <p className="text-[11px] font-medium text-white/90">
                {caloriesLeft === null
                  ? "ตั้งค่าเป้าหมายแคลอรี่ในหน้าการตั้งค่า"
                  : caloriesLeft >= 0
                    ? `เหลืออีก ${caloriesLeft.toLocaleString()} kcal`
                    : `เกินเป้า ${Math.abs(caloriesLeft).toLocaleString()} kcal`}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          {statCards.map((card) => (
            <Card key={card.label} className="py-0 shadow-[0_16px_30px_-26px_rgba(15,23,42,0.18)]">
              <CardContent className="flex min-h-[96px] flex-col items-start justify-start gap-3 p-3 text-left sm:min-h-[108px] sm:gap-5 sm:p-5">
                <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 sm:text-[11px]">
                  {card.icon}
                  <span className="truncate">{card.label}</span>
                </div>
                <p className={`whitespace-nowrap text-[1.05rem] font-medium leading-none sm:text-[1.25rem] ${card.accent}`}>{card.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-neutral-900">เพิ่มมื้ออาหาร</h2>
        <LegacyMealClassifier enabled={meals.some((meal) => !meal.mealCategory)} />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {mealSlots.map((meal) => (
            <Card
              key={meal.title}
              className="py-0 shadow-[0_14px_28px_-24px_rgba(15,23,42,0.16)] transition-transform duration-200 hover:-translate-y-0.5"
            >
              <CardContent className="flex min-h-[68px] items-center gap-4 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-neutral-50 text-lg">
                  {meal.icon === "+" ? <Plus className="h-4 w-4 text-neutral-700" /> : meal.icon}
                </div>
                <div className="space-y-0.5">
                  <p className="font-semibold text-neutral-900">{meal.title}</p>
                  <p className={`text-sm ${meal.hasData ? "text-emerald-500" : "text-neutral-400"}`}>
                    {meal.hasData ? "✓ " : "+ "}
                    {meal.subtitle}
                  </p>
                  {meal.description && <p className="text-[11px] text-neutral-400">{meal.description}</p>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Card className="w-full max-w-[520px] border-0 bg-emerald-50 py-0 text-emerald-700 ring-1 ring-emerald-100">
        <CardContent className="space-y-2 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sun className="h-4 w-4 text-amber-400" />
            <span>คำแนะนำวันนี้</span>
          </div>
          <p className="text-sm leading-6">
            {protein >= 20 ? "คุณได้รับโปรตีนค่อนข้างดีแล้ว!" : "ลองเพิ่มโปรตีนคุณภาพดีในมื้อถัดไป"}
            {" "}วันนี้บันทึกน้ำแล้ว {waterCups} แก้ว <Droplets className="mb-0.5 inline h-4 w-4 text-sky-500" />
          </p>
        </CardContent>
      </Card>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-neutral-900">มื้อล่าสุด</h2>

        <div className="w-full max-w-[520px] space-y-2.5">
          {latestMeals.length === 0 && (
            <Card className="py-0 shadow-[0_14px_28px_-24px_rgba(15,23,42,0.16)]">
              <CardContent className="p-4 text-sm font-medium text-neutral-500">
                ยังไม่มีมื้ออาหารที่บันทึกไว้
              </CardContent>
            </Card>
          )}
          {latestMeals.map((meal) => (
            <Card key={`${meal.title}-${meal.time}`} className="py-0 shadow-[0_14px_28px_-24px_rgba(15,23,42,0.16)]">
              <CardContent className="flex min-h-[48px] items-center justify-between gap-4 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-neutral-50 text-lg">
                    {meal.icon}
                  </div>
                  <div>
                    <p className="font-semibold text-neutral-900">{meal.title}</p>
                    <p className="text-sm text-neutral-400">{meal.category} · {meal.time}</p>
                  </div>
                </div>
                <p className="text-lg font-medium text-emerald-500">{meal.calories}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}

function readDashboardCache(): DashboardData | null {
  try {
    const raw = window.localStorage.getItem(DASHBOARD_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<DashboardData>
    return {
      meals: Array.isArray(parsed.meals) ? parsed.meals : [],
      waterLogs: Array.isArray(parsed.waterLogs) ? parsed.waterLogs : [],
      calorieGoal: typeof parsed.calorieGoal === "number" ? parsed.calorieGoal : null,
    }
  } catch {
    return null
  }
}

function readStoredCalorieGoal() {
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { healthGoal?: { dailyCalories?: number } }
    const value = Number(parsed.healthGoal?.dailyCalories)
    return Number.isFinite(value) && value > 0 ? Math.round(value) : null
  } catch {
    return null
  }
}
