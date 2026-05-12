'use client'

import { Droplets, Flame, Plus, Sun, Target } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"

const nutrientSummary = [
  { label: "โปรตีน", value: "56g" },
  { label: "ไขมัน", value: "38g" },
  { label: "คาร์บ", value: "142g" },
]

const statCards = [
  {
    icon: <Droplets className="h-3.5 w-3.5 text-sky-500" />,
    label: "น้ำวันนี้",
    value: "5 / 8 แก้ว",
    accent: "text-sky-500",
  },
  {
    icon: <Flame className="h-3.5 w-3.5 text-orange-500" />,
    label: "แคลอรี่เผา",
    value: "340 kcal",
    accent: "text-orange-500",
  },
  {
    icon: <Target className="h-3.5 w-3.5 text-emerald-500" />,
    label: "เป้าหมาย",
    value: "68%",
    accent: "text-emerald-500",
  },
]

const quickMeals = [
  { icon: "🌅", title: "เช้า", subtitle: "บันทึกแล้ว" },
  { icon: "☀️", title: "กลางวัน", subtitle: "บันทึกแล้ว" },
  { icon: "🌙", title: "เย็น", subtitle: "แตะเพิ่ม" },
  { icon: "+", title: "ของว่าง", subtitle: "แตะเพิ่ม" },
]

const latestMeals = [
  { icon: "🍗", title: "ข้าวมันไก่", time: "12:30", calories: "520 kcal" },
  { icon: "☕", title: "กาแฟลาเต้", time: "08:15", calories: "180 kcal" },
  { icon: "🍌", title: "กล้วยหอม", time: "14:00", calories: "90 kcal" },
]

export default function General() {
  const caloriesConsumed = 1240
  const calorieGoal = 1800
  const caloriesLeft = calorieGoal - caloriesConsumed
  const progressWidth = `${(caloriesConsumed / calorieGoal) * 100}%`

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
                    / {calorieGoal.toLocaleString()} kcal
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
                <div className="h-full rounded-full bg-white" style={{ width: progressWidth }} />
              </div>
              <p className="text-[11px] font-medium text-white/90">เหลืออีก {caloriesLeft.toLocaleString()} kcal</p>
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

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {quickMeals.map((meal) => (
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
                  <p className={`text-sm ${meal.subtitle === "บันทึกแล้ว" ? "text-emerald-500" : "text-neutral-400"}`}>
                    {meal.subtitle === "บันทึกแล้ว" ? "✓ " : "+ "}
                    {meal.subtitle}
                  </p>
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
            <span>Tip ของวันนี้</span>
          </div>
          <p className="text-sm leading-6">
            คุณได้รับโปรตีนเพียงพอแล้ว! ลองดื่มน้ำให้ครบ 8 แก้วด้วยนะ <Droplets className="mb-0.5 inline h-4 w-4 text-sky-500" />
          </p>
        </CardContent>
      </Card>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-neutral-900">มื้อล่าสุด</h2>

        <div className="w-full max-w-[520px] space-y-2.5">
          {latestMeals.map((meal) => (
            <Card key={`${meal.title}-${meal.time}`} className="py-0 shadow-[0_14px_28px_-24px_rgba(15,23,42,0.16)]">
              <CardContent className="flex min-h-[48px] items-center justify-between gap-4 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-neutral-50 text-lg">
                    {meal.icon}
                  </div>
                  <div>
                    <p className="font-semibold text-neutral-900">{meal.title}</p>
                    <p className="text-sm text-neutral-400">{meal.time}</p>
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
