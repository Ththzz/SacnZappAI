"use client"

import { useEffect, useState } from "react"
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
import { calculateNutritionTargets, normalizeActivityLevel, type GoalMode } from "@/lib/settings"
import { STORAGE_KEYS } from "@/lib/user-data"

type GoalKey = "lean" | "maintain" | "cut"

type ProfileForm = {
  name: string
  email: string
  gender: string
  age: string
  height: string
  weight: string
  targetWeight: string
  activity: string
}

type StoredProfile = {
  selectedGoal?: GoalKey
  form?: Partial<ProfileForm>
}

const goalOptions: { key: GoalKey; label: string; hint: string }[] = [
  { key: "lean", label: "เพิ่มกล้ามเนื้อ", hint: "เพิ่มกล้ามเนื้อแบบคุมไขมัน" },
  { key: "maintain", label: "รักษาน้ำหนัก", hint: "รักษาน้ำหนักและบาลานซ์อาหาร" },
  { key: "cut", label: "ลดไขมัน", hint: "ลดไขมันแบบคงมวลกล้ามเนื้อ" },
]

export default function ProfileClient() {
  const [isEditing, setIsEditing] = useState(false)
  const [selectedGoal, setSelectedGoal] = useState<GoalKey>("lean")
  const [notice, setNotice] = useState<string | null>(null)
  const [form, setForm] = useState<ProfileForm>({
    name: "",
    email: "",
    gender: "",
    age: "",
    height: "",
    weight: "",
    targetWeight: "",
    activity: "",
  })

  useEffect(() => {
    const applyStoredProfile = (stored: StoredProfile) => {
      if (stored.selectedGoal && goalOptions.some((goal) => goal.key === stored.selectedGoal)) {
        setSelectedGoal(stored.selectedGoal)
      }
      if (stored.form) {
        setForm((current) => ({ ...current, ...stored.form }))
      }
    }

    fetch("/api/profile")
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as { profile?: StoredProfile }
        if (!response.ok) throw new Error("api")
        if (data.profile) applyStoredProfile(data.profile)
      })
      .catch(() => {
        try {
          const raw = window.localStorage.getItem(STORAGE_KEYS.profile)
          if (!raw) return
          applyStoredProfile(JSON.parse(raw) as StoredProfile)
        } catch {
          window.localStorage.removeItem(STORAGE_KEYS.profile)
        }
      })
  }, [])

  const handleFieldChange = (key: keyof ProfileForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const handleSaveProfile = () => {
    window.localStorage.setItem(
      STORAGE_KEYS.profile,
      JSON.stringify({
        selectedGoal,
        form,
      }),
    )
    fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selectedGoal, form }),
    }).catch(() => undefined)
    setNotice("บันทึกโปรไฟล์เรียบร้อยแล้ว")
    setIsEditing(false)
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 text-neutral-900">
      <div className="flex justify-end">
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

      {notice && (
        <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {notice}
        </div>
      )}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_360px]">
        <main className="space-y-5">
          <ProfileHero form={form} selectedGoal={selectedGoal} />
          <GoalSection selectedGoal={selectedGoal} onSelectGoal={setSelectedGoal} />
          <ProfileFormCard form={form} isEditing={isEditing} onFieldChange={handleFieldChange} onSave={handleSaveProfile} />
        </main>

        <aside className="space-y-5">
          <TargetSummary form={form} selectedGoal={selectedGoal} />
          <MetricsPanel form={form} />
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
            <h2 className="text-3xl font-black tracking-tight text-white drop-shadow-[0_1px_0_rgba(0,0,0,0.12)] sm:text-[2.35rem]">{form.name || "ยังไม่ได้ตั้งชื่อ"}</h2>
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-950/20 px-3 py-1 text-xs font-bold text-white shadow-sm ring-1 ring-white/20 backdrop-blur">
              <BadgeCheck className="h-4 w-4" />
              แผนปัจจุบัน: {activeGoal?.label}
            </span>
          </div>
          <p className="max-w-2xl text-sm font-semibold leading-6 text-white/92 sm:text-[15px]">
            {activeGoal?.hint} พร้อมติดตามน้ำหนัก แคลอรี่ และพฤติกรรมการกินให้สอดคล้องกับเป้าหมายในแต่ละสัปดาห์
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <HeroChip icon={CalendarDays} label="อายุ" value={form.age ? `${form.age} ปี` : "ยังไม่มีข้อมูล"} />
            <HeroChip icon={Ruler} label="ส่วนสูง" value={form.height ? `${form.height} cm` : "ยังไม่มีข้อมูล"} />
            <HeroChip icon={Scale} label="น้ำหนัก" value={form.weight ? `${form.weight} kg` : "ยังไม่มีข้อมูล"} />
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
  onSave,
}: {
  form: ProfileForm
  isEditing: boolean
  onFieldChange: (key: keyof ProfileForm, value: string) => void
  onSave: () => void
}) {
  const fields: { key: keyof ProfileForm; label: string; type?: string }[] = [
    { key: "name", label: "ชื่อ" },
    { key: "email", label: "อีเมล", type: "email" },
    { key: "age", label: "อายุ", type: "number" },
    { key: "height", label: "ส่วนสูง (cm)", type: "number" },
    { key: "weight", label: "น้ำหนักปัจจุบัน (kg)", type: "number" },
    { key: "targetWeight", label: "น้ำหนักเป้าหมาย (kg)", type: "number" },
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
          onClick={onSave}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#2EC78F] px-4 text-sm font-bold text-white hover:bg-[#05b474]"
        >
          <Save className="h-4 w-4" />
          บันทึกการเปลี่ยนแปลง
        </button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-semibold text-neutral-500">เพศสำหรับคำนวณ BMR</span>
          <select
            value={form.gender}
            disabled={!isEditing}
            onChange={(event) => onFieldChange("gender", event.target.value)}
            className={`h-12 w-full rounded-2xl border px-4 text-sm font-medium outline-none transition-colors ${
              isEditing
                ? "border-emerald-200 bg-white focus:border-[#2EC78F]"
                : "border-neutral-200 bg-neutral-50 text-neutral-500"
            }`}
          >
            <option value="">ไม่ระบุ</option>
            <option value="male">ชาย</option>
            <option value="female">หญิง</option>
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-sm font-semibold text-neutral-500">กิจกรรมประจำวัน</span>
          <select
            value={form.activity}
            disabled={!isEditing}
            onChange={(event) => onFieldChange("activity", event.target.value)}
            className={`h-12 w-full rounded-2xl border px-4 text-sm font-medium outline-none transition-colors ${
              isEditing
                ? "border-emerald-200 bg-white focus:border-[#2EC78F]"
                : "border-neutral-200 bg-neutral-50 text-neutral-500"
            }`}
          >
            <option value="">ปานกลาง</option>
            <option value="low">น้อย</option>
            <option value="medium">ปานกลาง</option>
            <option value="high">หนัก</option>
          </select>
        </label>
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

function mapProfileGoalToMode(goal: GoalKey): GoalMode {
  if (goal === "cut") return "lose"
  if (goal === "lean") return "gain"
  return "maintain"
}

function TargetSummary({ form, selectedGoal }: { form: ProfileForm; selectedGoal: GoalKey }) {
  const targetsData = calculateNutritionTargets({
    mode: mapProfileGoalToMode(selectedGoal),
    weeklyDeltaKg: 0.5,
    currentWeightKg: Number(form.weight) || 70,
    targetWeightKg: Number(form.targetWeight) || Number(form.weight) || 70,
    activityLevel: normalizeActivityLevel(form.activity),
    dailyCalories: 0,
  }, { form })
  const hasWeight = Number.isFinite(Number(form.weight)) && Number(form.weight) > 0
  const targets = [
    {
      label: "พลังงาน/วัน",
      value: hasWeight ? `${targetsData.calories.toLocaleString()} kcal` : "ยังไม่มีข้อมูล",
      icon: Activity,
      tone: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "โปรตีนเป้าหมาย",
      value: hasWeight ? `${targetsData.protein} g` : "ยังไม่มีข้อมูล",
      icon: Dumbbell,
      tone: "bg-sky-50 text-sky-600",
    },
    {
      label: "น้ำหนักเป้าหมาย",
      value: Number.isFinite(Number(form.targetWeight)) && Number(form.targetWeight) > 0 ? `${form.targetWeight} kg` : "ยังไม่มีข้อมูล",
      icon: Target,
      tone: "bg-amber-50 text-amber-600",
    },
  ]

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <h2 className="text-base font-extrabold">เป้าหมายรายสัปดาห์</h2>
      <div className="mt-4 space-y-3">
        {targets.map((target) => {
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

function MetricsPanel({ form }: { form: ProfileForm }) {
  const heightCm = Number(form.height)
  const weightKg = Number(form.weight)
  const hasCoreMetrics = Number.isFinite(heightCm) && heightCm > 0 && Number.isFinite(weightKg) && weightKg > 0
  const heightM = heightCm / 100
  const bmi = hasCoreMetrics ? weightKg / (heightM * heightM) : null
  const targetsData = calculateNutritionTargets({
    mode: "maintain",
    weeklyDeltaKg: 0.5,
    currentWeightKg: weightKg || 70,
    targetWeightKg: Number(form.targetWeight) || weightKg || 70,
    activityLevel: normalizeActivityLevel(form.activity),
    dailyCalories: 0,
  }, { form })
  const metrics = [
    { label: "BMR", value: targetsData.bmr ? `${targetsData.bmr.toLocaleString()} kcal` : "ยังไม่มีข้อมูล", helper: "Mifflin-St Jeor" },
    { label: "TDEE", value: targetsData.tdee ? `${targetsData.tdee.toLocaleString()} kcal` : "ยังไม่มีข้อมูล", helper: "BMR x ระดับกิจกรรม" },
    { label: "BMI", value: bmi ? bmi.toFixed(1) : "ยังไม่มีข้อมูล", helper: bmi ? (bmi >= 18.5 && bmi < 23 ? "อยู่ในเกณฑ์ปกติ" : "ควรประเมินร่วมกับเป้าหมายสุขภาพ") : "กรอกส่วนสูงและน้ำหนักก่อน" },
  ]

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-[#2EC78F]" />
        <h2 className="text-base font-extrabold">ตัวชี้วัดสุขภาพ</h2>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        {metrics.map((metric) => (
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
