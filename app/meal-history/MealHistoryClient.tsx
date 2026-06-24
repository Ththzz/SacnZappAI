"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Clock,
  Download,
  Flame,
  Scale,
  Trash2,
  Trophy,
  Utensils,
  X,
} from "lucide-react"
import { getLocalDateKey, readMealEntries } from "@/lib/user-data"

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

const macroRows = [
  { label: "โปรตีน", current: 56, target: 72, color: "bg-emerald-400" },
  { label: "คาร์โบไฮเดรต", current: 142, target: 200, color: "bg-blue-500" },
  { label: "ไขมัน", current: 38, target: 55, color: "bg-orange-400" },
]

function buildWeekDays(meals: DayMeal[]): WeekDaySummary[] {
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
    const status: WeekDaySummary["status"] =
      calories === 0 ? "empty" : calories > 2200 ? "bad" : calories > 1800 ? "warn" : "good"

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

function buildMonthDays(meals: DayMeal[]): MonthDaySummary[] {
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
    const status: MonthDaySummary["status"] =
      calories === 0 ? "empty" : calories > 2200 ? "bad" : calories > 1800 ? "warn" : "good"

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
  const [activeView, setActiveView] = useState<ViewMode>("day")
  const [selectedMeal, setSelectedMeal] = useState<DayMeal | null>(null)
  const [historyMeals, setHistoryMeals] = useState<DayMeal[]>([])
  const todayKey = getLocalDateKey()

  useEffect(() => {
    const convertMeals = (items: ReturnType<typeof readMealEntries>) => items.slice(0, 20).map((item, index) => ({
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
    }))

    fetch("/api/meals")
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as { meals?: ReturnType<typeof readMealEntries> }
        if (!response.ok) throw new Error("api")
        setHistoryMeals(convertMeals(data.meals ?? []))
      })
      .catch(() => setHistoryMeals(convertMeals(readMealEntries())))
  }, [])

  const todayMeals = historyMeals.filter((meal) => meal.date === todayKey)
  const dailyCalories = todayMeals.reduce((total, meal) => total + meal.calories, 0)
  const weekDays = useMemo(() => buildWeekDays(historyMeals), [historyMeals])
  const monthDays = useMemo(() => buildMonthDays(historyMeals), [historyMeals])
  const weeklyCalories = weekDays.reduce((total, day) => total + day.calories, 0)
  const daysWithMeals = weekDays.filter((day) => day.meals > 0).length
  const averageCalories = daysWithMeals > 0 ? Math.round(weeklyCalories / daysWithMeals) : 0

  return (
    <div className="mx-auto max-w-7xl space-y-5 text-neutral-900">
      <ViewTabs activeView={activeView} onChange={setActiveView} />

      {activeView === "day" && <DailyView meals={todayMeals} dailyCalories={dailyCalories} onSelectMeal={setSelectedMeal} />}
      {activeView === "week" && <WeeklyView averageCalories={averageCalories} weekDays={weekDays} />}
      {activeView === "month" && <MonthlyView monthDays={monthDays} />}

      {selectedMeal && <MealDetailModal meal={selectedMeal} onClose={() => setSelectedMeal(null)} />}
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

function DailyView({ meals, dailyCalories, onSelectMeal }: { meals: DayMeal[]; dailyCalories: number; onSelectMeal: (meal: DayMeal) => void }) {
  const percent = Math.round((dailyCalories / 1800) * 100)

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
              <span className="text-sm font-extrabold text-[#2EC78F]">{percent}%</span>
            </div>
            <div className="mt-4 h-2 rounded-full bg-neutral-100">
              <div className="h-full rounded-full bg-[#2EC78F]" style={{ width: `${percent}%` }} />
            </div>
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
                <button type="button" className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-50 text-neutral-300 hover:bg-rose-50 hover:text-rose-500" aria-label={`ลบ ${meal.name}`}>
                  <ChevronRight className="h-3.5 w-3.5" />
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
            <span className="pb-1 text-sm font-semibold text-neutral-500">/ 1,800 kcal</span>
          </div>
        </div>
        <MacroSummary />
        <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-700">
          <p className="font-extrabold">ข้อเสนอแนะจาก ScanZapp AI</p>
          <p className="mt-2 text-xs leading-5">ควรเพิ่มเป้าหมายแคลอรี่มื้ออื่นด้วยโปรตีนคุณภาพดีและผักให้มากขึ้น</p>
        </div>
      </aside>
    </div>
  )
}

function WeeklyView({ averageCalories, weekDays }: { averageCalories: number; weekDays: WeekDaySummary[] }) {
  const maxCalories = 2200
  const targetCalories = 1800
  const chartHeight = 150
  const targetLineBottom = (targetCalories / maxCalories) * chartHeight
  const totalMeals = weekDays.reduce((sum, day) => sum + day.meals, 0)
  const trackedDays = weekDays.filter((day) => day.meals > 0)
  const onTargetDays = trackedDays.filter((day) => day.calories <= targetCalories).length
  const consistency = trackedDays.length > 0 ? Math.round((onTargetDays / trackedDays.length) * 100) : 0

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.95fr)]">
      <main className="space-y-5">
        <section className="grid gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:grid-cols-3">
          <StatBlock label="สรุปสัปดาห์นี้" value={averageCalories.toLocaleString()} helper="kcal เฉลี่ยต่อวันที่มีข้อมูล" />
          <StatBlock label="มื้อทั้งหมด" value={totalMeals.toLocaleString()} helper="มื้อ" />
          <StatBlock label="เข้าเป้า" value={`${consistency}%`} helper="วันที่มีข้อมูล" valueClassName="text-[#2EC78F]" />
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <h2 className="text-sm font-extrabold">แคลอรี่รายวัน (สัปดาห์)</h2>
          <p className="mt-1 text-xs text-neutral-400">เป้าหมาย 1,800 kcal</p>
          <div className="relative mt-6">
            <div className="relative h-[150px]">
              <div className="absolute inset-x-0 border-t border-red-200" style={{ bottom: `${targetLineBottom}px` }} />
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
          <MacroSummary compact />
        </section>
      </aside>
    </div>
  )
}

function MonthlyView({ monthDays }: { monthDays: MonthDaySummary[] }) {
  const trackedDays = monthDays.filter((item) => item.entries > 0)
  const totalCalories = monthDays.reduce((sum, item) => sum + item.calories, 0)
  const totalMeals = monthDays.reduce((sum, item) => sum + item.entries, 0)
  const onTargetDays = trackedDays.filter((item) => item.calories <= 1800).length
  const averageCalories = trackedDays.length > 0 ? Math.round(totalCalories / trackedDays.length) : 0
  const monthSummary = [
    { icon: Flame, label: "แคลอรี่เฉลี่ย/วัน", value: `${averageCalories.toLocaleString()} kcal`, bg: "bg-amber-50", color: "text-orange-500" },
    { icon: Utensils, label: "มื้ออาหารทั้งหมด", value: `${totalMeals.toLocaleString()} มื้อ`, bg: "bg-emerald-50", color: "text-emerald-500" },
    { icon: Trophy, label: "วันที่ทำสำเร็จ", value: `${onTargetDays}/${trackedDays.length} วัน`, bg: "bg-emerald-50", color: "text-amber-500" },
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

function MealDetailModal({ meal, onClose }: { meal: DayMeal; onClose: () => void }) {
  const detail = {
    protein: meal.protein ?? 0,
    carbs: meal.carbs ?? 0,
    fat: meal.fat ?? 0,
    portion: "1 จาน",
    source: meal.source === "scan" ? "สแกนจากภาพ" : "บันทึกด้วยมือ",
    confidence: meal.confidence ?? 75,
    ingredients: ["ไม่ระบุส่วนประกอบ"],
    note: meal.note ?? "ยังไม่มีคำแนะนำเพิ่มเติมสำหรับมื้อนี้",
  }
  const macros = [
    { label: "โปรตีน", value: detail.protein, unit: "g", color: "bg-emerald-400" },
    { label: "คาร์บ", value: detail.carbs, unit: "g", color: "bg-blue-500" },
    { label: "ไขมัน", value: detail.fat, unit: "g", color: "bg-orange-400" },
  ]
  const maxMacro = Math.max(...macros.map((macro) => macro.value), 1)

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
          <button type="button" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-50 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700" aria-label="ปิดรายละเอียดมื้ออาหาร">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-emerald-50 p-4">
              <p className="text-xs font-bold text-emerald-600">แคลอรี่</p>
              <p className="mt-1 text-2xl font-black text-[#2EC78F]">{meal.calories}</p>
              <p className="text-xs font-semibold text-neutral-500">kcal</p>
            </div>
            <InfoTile label="ที่มา" value={detail.source} />
            <InfoTile label="ความมั่นใจของ ScanZapp AI" value={`${detail.confidence}%`} />
          </div>

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
        </div>
      </div>
    </div>
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

function MacroSummary({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "mt-4 space-y-3" : "space-y-3"}>
      {macroRows.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex items-center justify-between gap-2 text-xs font-semibold">
            <span className="text-neutral-600">{item.label}</span>
            <span className="text-neutral-500">
              {item.current}g / {item.target}g
            </span>
          </div>
          <div className="h-2 rounded-full bg-neutral-100">
            <div className={`h-full rounded-full ${item.color}`} style={{ width: `${Math.min(100, (item.current / item.target) * 100)}%` }} />
          </div>
        </div>
      ))}
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
