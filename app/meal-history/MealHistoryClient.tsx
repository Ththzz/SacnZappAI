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
import { readMealEntries } from "@/lib/user-data"

type ViewMode = "day" | "week" | "month"
type DayMeal = {
  id: number
  icon: string
  name: string
  time: string
  calories: number
  tone: string
  protein?: number
  carbs?: number
  fat?: number
  source?: string
  confidence?: number
  note?: string
}

const mealDetailsById: Record<number, {
  protein: number
  carbs: number
  fat: number
  portion: string
  source: string
  confidence: number
  ingredients: string[]
  note: string
}> = {
  1: {
    protein: 7,
    carbs: 18,
    fat: 8,
    portion: "1 แก้วกลาง",
    source: "อัปโหลดรูป",
    confidence: 92,
    ingredients: ["นมสด", "เอสเปรสโซ", "น้ำตาลเล็กน้อย"],
    note: "น้ำตาลอยู่ในระดับพอดี แต่ถ้าดื่มทุกวันควรลดไซรัปลงครึ่งหนึ่ง",
  },
  2: {
    protein: 28,
    carbs: 62,
    fat: 18,
    portion: "1 จาน",
    source: "ถ่ายจากกล้อง",
    confidence: 88,
    ingredients: ["ข้าวมัน", "ไก่ต้ม", "น้ำจิ้ม", "แตงกวา"],
    note: "โปรตีนดี แต่ไขมันค่อนข้างสูงจากข้าวมันและหนังไก่",
  },
  3: {
    protein: 1,
    carbs: 23,
    fat: 0,
    portion: "1 ลูก",
    source: "บันทึกด้วยมือ",
    confidence: 96,
    ingredients: ["กล้วยหอม"],
    note: "เป็นของว่างที่ดี ให้พลังงานเร็วและไขมันต่ำ",
  },
  4: {
    protein: 12,
    carbs: 78,
    fat: 9,
    portion: "1 ชุด",
    source: "อัปโหลดรูป",
    confidence: 84,
    ingredients: ["มะละกอ", "ถั่วฝักยาว", "ข้าวเหนียว", "น้ำปลา", "น้ำตาลปี๊บ"],
    note: "คาร์บสูงจากข้าวเหนียว ถ้ามื้อดึกควรลดข้าวเหนียวลงครึ่งหนึ่ง",
  },
}

const dayMeals = [
  { id: 1, icon: "☕", name: "กาแฟลาเต้", time: "08:15", calories: 180, tone: "good" },
  { id: 2, icon: "🍗", name: "ข้าวมันไก่", time: "12:30", calories: 520, tone: "good" },
  { id: 3, icon: "🍌", name: "กล้วยหอม 1 ลูก", time: "14:00", calories: 90, tone: "good" },
  { id: 4, icon: "🌶️", name: "ส้มตำ + ข้าวเหนียว", time: "19:00", calories: 450, tone: "warn" },
]

const weekDays = [
  { day: "จ", full: "จันทร์ 14 เม.ย.", meals: 4, calories: 1520, status: "good" },
  { day: "อ", full: "อังคาร 15 เม.ย.", meals: 3, calories: 1750, status: "good" },
  { day: "พ", full: "พุธ 16 เม.ย.", meals: 4, calories: 1680, status: "good" },
  { day: "พฤ", full: "พฤหัส 17 เม.ย.", meals: 5, calories: 1920, status: "warn" },
  { day: "ศ", full: "ศุกร์ 18 เม.ย.", meals: 4, calories: 1600, status: "good" },
  { day: "ส", full: "เสาร์ 19 เม.ย.", meals: 5, calories: 2100, status: "bad" },
  { day: "อา", full: "อาทิตย์ 20 เม.ย.", meals: 3, calories: 1480, status: "good" },
]

const monthDays = Array.from({ length: 30 }, (_, index) => {
  const day = index + 1
  const entries = [5, 3, 4, 3, 3, 3, 4, 3, 4, 3, 4, 3, 3, 3, 3, 3, 4, 3, 3, 4, 3, 3, 4, 0, 0, 0, 0, 0, 0, 0][index]
  const status = day === 10 || day === 17 ? "warn" : day === 19 ? "bad" : entries > 0 ? "good" : "empty"

  return { day, entries, status }
})

const macroRows = [
  { label: "โปรตีน", current: 56, target: 72, color: "bg-emerald-400" },
  { label: "คาร์โบไฮเดรต", current: 142, target: 200, color: "bg-blue-500" },
  { label: "ไขมัน", current: 38, target: 55, color: "bg-orange-400" },
]

const monthSummary = [
  { icon: Flame, label: "แคลอรี่เฉลี่ย/วัน", value: "1,720 kcal", bg: "bg-amber-50", color: "text-orange-500" },
  { icon: Utensils, label: "มื้ออาหารทั้งหมด", value: "76 มื้อ", bg: "bg-emerald-50", color: "text-emerald-500" },
  { icon: Trophy, label: "วันที่ทำสำเร็จ", value: "16/20 วัน", bg: "bg-emerald-50", color: "text-amber-500" },
  { icon: Scale, label: "น้ำหนักเปลี่ยน", value: "-1.2 kg", bg: "bg-slate-50", color: "text-slate-500" },
]

export default function MealHistoryClient() {
  const [activeView, setActiveView] = useState<ViewMode>("day")
  const [selectedMeal, setSelectedMeal] = useState<DayMeal | null>(null)
  const [historyMeals, setHistoryMeals] = useState<DayMeal[]>(dayMeals)

  useEffect(() => {
    const stored = readMealEntries()
    if (stored.length === 0) return

    const converted: DayMeal[] = stored.slice(0, 20).map((item, index) => ({
      id: Number(item.id.replace(/\D/g, "").slice(-6) || `${1000 + index}`),
      icon: "🍽️",
      name: item.name,
      time: item.time,
      calories: item.calories,
      tone: item.calories > 420 ? "warn" : "good",
      protein: item.protein,
      carbs: item.carbs,
      fat: item.fat,
      source: item.source,
      confidence: item.confidence,
      note: item.note,
    }))

    setHistoryMeals((current) => {
      const merged = [...converted, ...current]
      const deduped = merged.filter((meal, idx) => merged.findIndex((item) => item.name === meal.name && item.time === meal.time) === idx)
      return deduped.slice(0, 24)
    })
  }, [])

  const dailyCalories = historyMeals.reduce((total, meal) => total + meal.calories, 0)
  const weeklyCalories = weekDays.reduce((total, day) => total + day.calories, 0)
  const averageCalories = Math.round(weeklyCalories / weekDays.length)

  const pageSubtitle = useMemo(() => {
    if (activeView === "day") return "วันที่ 20 เมษายน 2026"
    if (activeView === "week") return "สัปดาห์ที่ 14-20 เมษายน 2026"
    return "เมษายน 2026"
  }, [activeView])

  return (
    <div className="mx-auto max-w-7xl space-y-5 text-neutral-900">
      <header className="flex flex-col gap-1">
        <p className="text-sm font-medium text-neutral-400">04 · Meal History</p>
        <h1 className="text-2xl font-bold tracking-normal">ประวัติมื้ออาหาร</h1>
        <p className="text-sm text-neutral-500">{pageSubtitle}</p>
      </header>

      <ViewTabs activeView={activeView} onChange={setActiveView} />

      {activeView === "day" && <DailyView meals={historyMeals} dailyCalories={dailyCalories} onSelectMeal={setSelectedMeal} />}
      {activeView === "week" && <WeeklyView averageCalories={averageCalories} />}
      {activeView === "month" && <MonthlyView />}

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
                <h2 className="text-base font-extrabold">18 เมษายน 2026</h2>
                <p className="text-sm text-neutral-500">รวม {dailyCalories.toLocaleString()} kcal จาก {meals.length} มื้อ</p>
              </div>
              <span className="text-sm font-extrabold text-[#2EC78F]">{percent}%</span>
            </div>
            <div className="mt-4 h-2 rounded-full bg-neutral-100">
              <div className="h-full rounded-full bg-[#2EC78F]" style={{ width: `${percent}%` }} />
            </div>
          </section>

          <div className="grid content-start gap-3">
            <ExportButton label="Export PDF" />
            <ExportButton label="Export CSV" />
          </div>
        </div>

        <section>
          <h2 className="text-base font-extrabold">มื้ออาหารวันนี้</h2>
          <div className="mt-3 space-y-3">
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
                  <p className="text-xs font-medium text-neutral-400">{meal.time} · {mealDetailsById[meal.id]?.portion}</p>
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
          <p className="font-extrabold">AI ข้อเสนอแนะ</p>
          <p className="mt-2 text-xs leading-5">ควรเพิ่มเป้าหมายแคลอรี่มื้ออื่นด้วยโปรตีนคุณภาพดีและผักให้มากขึ้น</p>
        </div>
      </aside>
    </div>
  )
}

function WeeklyView({ averageCalories }: { averageCalories: number }) {
  const bestPercent = 89
  const maxCalories = 2200
  const targetCalories = 1800
  const chartHeight = 150
  const targetLineBottom = (targetCalories / maxCalories) * chartHeight

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.95fr)]">
      <main className="space-y-5">
        <section className="grid gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:grid-cols-3">
          <StatBlock label="สรุปสัปดาห์นี้" value={averageCalories.toLocaleString()} helper="14-20 เม.ย. 2026" />
          <StatBlock label="มื้อทั้งหมด" value="28" helper="มื้อ" />
          <StatBlock label="เข้าเป้า" value={`${bestPercent}%`} helper="ความสม่ำเสมอ" valueClassName="text-[#2EC78F]" />
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
                    <span className={`mb-2 text-[10px] font-bold ${item.status === "warn" || item.status === "bad" ? "text-orange-400" : "text-[#2EC78F]"}`}>
                      {item.calories}
                    </span>
                    <div
                      className={`w-full max-w-12 rounded-md ${item.status === "warn" || item.status === "bad" ? "bg-orange-400" : "bg-[#2EC78F]"}`}
                      style={{ height: `${Math.max(44, (item.calories / maxCalories) * chartHeight)}px` }}
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
                <span className={`text-right font-extrabold ${item.status === "warn" || item.status === "bad" ? "text-orange-500" : "text-[#2EC78F]"}`}>{item.calories} kcal</span>
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

function MonthlyView() {
  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
      <main className="space-y-4">
        <div className="flex w-full max-w-[360px] items-center justify-between rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-black/5">
          <button type="button" className="text-neutral-400 hover:text-neutral-700" aria-label="เดือนก่อนหน้า">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h2 className="text-sm font-extrabold">เมษายน 2026</h2>
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
                  item.day === 20 ? "ring-[#2EC78F]" : ""
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
          <h2 className="text-sm font-extrabold">สรุปเดือนเมษายน</h2>
          <p className="mt-1 text-xs font-semibold text-neutral-400">ผ่านไปแล้ว 20 วัน</p>
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
        <ExportButton label="Export รายงานเดือน (PDF)" full />
      </aside>
    </div>
  )
}

function MealDetailModal({ meal, onClose }: { meal: DayMeal; onClose: () => void }) {
  const detail = mealDetailsById[meal.id] ?? {
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
            <InfoTile label="ความมั่นใจ AI" value={`${detail.confidence}%`} />
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
            <h3 className="font-extrabold">AI ข้อเสนอแนะ</h3>
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
