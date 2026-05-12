"use client"

import { useState } from "react"
import {
  Activity,
  BadgeCheck,
  CalendarDays,
  Dumbbell,
  PencilLine,
  Ruler,
  Save,
  Scale,
  Target,
  UserRound,
} from "lucide-react"

type GoalKey = "lean" | "maintain" | "cut"

type ProfileForm = {
  name: string
  email: string
  age: string
  height: string
  weight: string
  targetWeight: string
  activity: string
}

const goalOptions: { key: GoalKey; label: string; hint: string }[] = [
  { key: "lean", label: "Lean Gain", hint: "เพิ่มกล้ามเนื้อแบบคุมไขมัน" },
  { key: "maintain", label: "Maintain", hint: "รักษาน้ำหนักและบาลานซ์อาหาร" },
  { key: "cut", label: "Cut", hint: "ลดไขมันแบบคงมวลกล้ามเนื้อ" },
]

const weeklyTargets = [
  { label: "พลังงาน/วัน", value: "2,200 kcal", icon: Activity, tone: "bg-emerald-50 text-emerald-600" },
  { label: "โปรตีนเป้าหมาย", value: "110 g", icon: Dumbbell, tone: "bg-sky-50 text-sky-600" },
  { label: "น้ำหนักเป้าหมาย", value: "60 kg", icon: Target, tone: "bg-amber-50 text-amber-600" },
]

const bodyMetrics = [
  { label: "BMR", value: "1,650 kcal", helper: "พลังงานพื้นฐาน" },
  { label: "TDEE", value: "2,200 kcal", helper: "พลังงานต่อวัน" },
  { label: "Body Fat", value: "21%", helper: "ประมาณการล่าสุด" },
  { label: "BMI", value: "21.5", helper: "อยู่ในเกณฑ์ปกติ" },
]

export default function ProfileClient() {
  const [isEditing, setIsEditing] = useState(false)
  const [selectedGoal, setSelectedGoal] = useState<GoalKey>("lean")
  const [form, setForm] = useState<ProfileForm>({
    name: "Thanapol Thiwong",
    email: "aomsinthiwong@gmail.com",
    age: "25",
    height: "170",
    weight: "62",
    targetWeight: "60",
    activity: "ออกกำลังกาย 4 วัน/สัปดาห์",
  })

  const handleFieldChange = (key: keyof ProfileForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 text-neutral-900">
      <header className="flex flex-col gap-1">
        <p className="text-sm font-medium text-neutral-400">05 · Profile & Goals</p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-normal">Profile & Goals</h1>
            <p className="text-sm text-neutral-500">จัดการข้อมูลส่วนตัว เป้าหมาย และแผนโภชนาการของคุณ</p>
          </div>
          <button
            type="button"
            onClick={() => setIsEditing((current) => !current)}
            className={`inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-bold transition-colors ${
              isEditing ? "bg-neutral-900 text-white hover:bg-neutral-800" : "bg-[#2EC78F] text-white hover:bg-[#05b474]"
            }`}
          >
            <PencilLine className="h-4 w-4" />
            {isEditing ? "ปิดการแก้ไข" : "แก้ไขโปรไฟล์"}
          </button>
        </div>
      </header>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_360px]">
        <main className="space-y-5">
          <ProfileHero form={form} selectedGoal={selectedGoal} />
          <GoalSection selectedGoal={selectedGoal} onSelectGoal={setSelectedGoal} />
          <ProfileFormCard form={form} isEditing={isEditing} onFieldChange={handleFieldChange} />
        </main>

        <aside className="space-y-5">
          <TargetSummary />
          <MetricsPanel />
        </aside>
      </section>
    </div>
  )
}

function ProfileHero({ form, selectedGoal }: { form: ProfileForm; selectedGoal: GoalKey }) {
  const activeGoal = goalOptions.find((goal) => goal.key === selectedGoal)

  return (
    <section className="relative overflow-hidden rounded-[28px] bg-[linear-gradient(120deg,#169865_0%,#23B97D_40%,#65D7AA_72%,#D9F9EC_100%)] p-6 text-white shadow-sm ring-1 ring-emerald-200">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(5,68,47,0.24)_0%,rgba(5,68,47,0.12)_42%,rgba(255,255,255,0.04)_100%)]" />
      <div className="relative grid gap-6 lg:grid-cols-[auto_1fr] lg:items-end">
        <div className="flex h-24 w-24 items-center justify-center rounded-[28px] bg-white/18 shadow-lg shadow-emerald-950/10 backdrop-blur">
          <UserRound className="h-12 w-12" />
        </div>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-3xl font-black tracking-tight text-white drop-shadow-[0_1px_0_rgba(0,0,0,0.12)] sm:text-[2.35rem]">{form.name}</h2>
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-950/20 px-3 py-1 text-xs font-bold text-white shadow-sm ring-1 ring-white/20 backdrop-blur">
              <BadgeCheck className="h-4 w-4" />
              แผนปัจจุบัน: {activeGoal?.label}
            </span>
          </div>
          <p className="max-w-2xl text-sm font-semibold leading-6 text-white/92 sm:text-[15px]">
            {activeGoal?.hint} พร้อมติดตามน้ำหนัก แคลอรี่ และพฤติกรรมการกินให้สอดคล้องกับเป้าหมายในแต่ละสัปดาห์
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <HeroChip icon={CalendarDays} label="อายุ" value={`${form.age} ปี`} />
            <HeroChip icon={Ruler} label="ส่วนสูง" value={`${form.height} cm`} />
            <HeroChip icon={Scale} label="น้ำหนัก" value={`${form.weight} kg`} />
          </div>
        </div>
      </div>
    </section>
  )
}

function HeroChip({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UserRound
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl bg-emerald-950/14 p-3 shadow-sm ring-1 ring-white/18 backdrop-blur">
      <div className="flex items-center gap-2 text-xs font-bold text-white/80">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <p className="mt-2 text-xl font-black text-white">{value}</p>
    </div>
  )
}

function GoalSection({
  selectedGoal,
  onSelectGoal,
}: {
  selectedGoal: GoalKey
  onSelectGoal: (goal: GoalKey) => void
}) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-[#2EC78F]" />
        <h2 className="text-base font-extrabold">เป้าหมายหลัก</h2>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {goalOptions.map((goal) => (
          <button
            key={goal.key}
            type="button"
            onClick={() => onSelectGoal(goal.key)}
            className={`rounded-2xl border p-4 text-left transition-colors ${
              selectedGoal === goal.key
                ? "border-[#2EC78F] bg-emerald-50 shadow-sm"
                : "border-neutral-200 bg-white hover:border-emerald-200 hover:bg-neutral-50"
            }`}
          >
            <p className="text-sm font-extrabold text-neutral-900">{goal.label}</p>
            <p className="mt-2 text-xs font-medium leading-5 text-neutral-500">{goal.hint}</p>
          </button>
        ))}
      </div>
    </section>
  )
}

function ProfileFormCard({
  form,
  isEditing,
  onFieldChange,
}: {
  form: ProfileForm
  isEditing: boolean
  onFieldChange: (key: keyof ProfileForm, value: string) => void
}) {
  const fields: { key: keyof ProfileForm; label: string; type?: string }[] = [
    { key: "name", label: "ชื่อ" },
    { key: "email", label: "อีเมล", type: "email" },
    { key: "age", label: "อายุ", type: "number" },
    { key: "height", label: "ส่วนสูง (cm)", type: "number" },
    { key: "weight", label: "น้ำหนักปัจจุบัน (kg)", type: "number" },
    { key: "targetWeight", label: "น้ำหนักเป้าหมาย (kg)", type: "number" },
    { key: "activity", label: "กิจกรรมประจำวัน" },
  ]

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold">ข้อมูลส่วนตัว</h2>
          <p className="mt-1 text-sm text-neutral-500">แก้ไขรายละเอียดหลักที่ใช้คำนวณเป้าหมายโภชนาการ</p>
        </div>
        <button
          type="button"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#2EC78F] px-4 text-sm font-bold text-white hover:bg-[#05b474]"
        >
          <Save className="h-4 w-4" />
          บันทึกการเปลี่ยนแปลง
        </button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {fields.map((field) => (
          <label key={field.key} className="space-y-2">
            <span className="text-sm font-semibold text-neutral-500">{field.label}</span>
            <input
              type={field.type ?? "text"}
              value={form[field.key]}
              disabled={!isEditing}
              onChange={(event) => onFieldChange(field.key, event.target.value)}
              className={`h-12 w-full rounded-2xl border px-4 text-sm font-medium outline-none transition-colors ${
                isEditing
                  ? "border-emerald-200 bg-white focus:border-[#2EC78F]"
                  : "border-neutral-200 bg-neutral-50 text-neutral-500"
              }`}
            />
          </label>
        ))}
      </div>
    </section>
  )
}

function TargetSummary() {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <h2 className="text-base font-extrabold">เป้าหมายรายสัปดาห์</h2>
      <div className="mt-4 space-y-3">
        {weeklyTargets.map((target) => {
          const Icon = target.icon
          return (
            <div key={target.label} className="grid grid-cols-[44px_1fr] items-center gap-3 rounded-2xl bg-neutral-50 p-4">
              <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${target.tone}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-neutral-400">{target.label}</p>
                <p className="mt-1 text-lg font-black text-neutral-900">{target.value}</p>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function MetricsPanel() {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-[#2EC78F]" />
        <h2 className="text-base font-extrabold">Health Metrics</h2>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        {bodyMetrics.map((metric) => (
          <div key={metric.label} className="rounded-2xl bg-emerald-50 p-4">
            <p className="text-xs font-semibold text-emerald-700">{metric.label}</p>
            <p className="mt-1 text-2xl font-black text-neutral-900">{metric.value}</p>
            <p className="mt-1 text-xs font-medium text-neutral-500">{metric.helper}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
