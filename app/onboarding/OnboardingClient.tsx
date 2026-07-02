"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  Dumbbell,
  LoaderCircle,
  Scale,
  Target,
  TrendingDown,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { type OnboardingGoal } from "@/lib/onboarding"

export type OnboardingForm = {
  name: string
  email: string
  gender: string
  age: string
  height: string
  weight: string
  targetWeight: string
  activity: string
}

const goals = [
  {
    id: "cut",
    label: "ลดไขมัน",
    description: "สร้างแผนลดน้ำหนักอย่างสมดุล พร้อมรักษามวลกล้ามเนื้อ",
    icon: TrendingDown,
    color: "border-emerald-300 bg-emerald-50/60 text-emerald-700",
  },
  {
    id: "maintain",
    label: "รักษาน้ำหนัก",
    description: "รักษาน้ำหนักและพลังงานให้สมดุลกับกิจกรรมประจำวัน",
    icon: Scale,
    color: "border-indigo-200 bg-indigo-50/60 text-indigo-700",
  },
  {
    id: "lean",
    label: "เพิ่มกล้ามเนื้อ",
    description: "เพิ่มพลังงานและโปรตีนเพื่อสร้างกล้ามเนื้อแบบคุมไขมัน",
    icon: Dumbbell,
    color: "border-orange-200 bg-orange-50/60 text-orange-700",
  },
] as const

export default function OnboardingClient({
  destination,
  initialGoal,
  initialForm,
}: {
  destination: string
  initialGoal: OnboardingGoal
  initialForm: OnboardingForm
}) {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [goal, setGoal] = useState<OnboardingGoal>(initialGoal)
  const [form, setForm] = useState(initialForm)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  const update = (key: keyof OnboardingForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
    setError("")
  }

  const validateProfile = () => {
    if (form.name.trim().length < 2) return "กรุณากรอกชื่ออย่างน้อย 2 ตัวอักษร"
    if (!form.gender) return "กรุณาเลือกเพศ"
    if (!form.age || Number(form.age) < 13 || Number(form.age) > 120) return "กรุณากรอกอายุระหว่าง 13–120 ปี"
    if (!form.height || Number(form.height) < 100 || Number(form.height) > 250) return "กรุณากรอกส่วนสูงระหว่าง 100–250 ซม."
    if (!form.weight || Number(form.weight) < 25 || Number(form.weight) > 350) return "กรุณากรอกน้ำหนักที่ถูกต้อง"
    if (!form.activity) return "กรุณาเลือกระดับกิจกรรม"
    return null
  }

  const goToGoal = () => {
    const validationError = validateProfile()
    if (validationError) {
      setError(validationError)
      return
    }
    setError("")
    setStep(2)
  }

  const submit = async () => {
    if (!form.targetWeight || Number(form.targetWeight) < 25 || Number(form.targetWeight) > 350) {
      setError("กรุณากรอกน้ำหนักเป้าหมายที่ถูกต้อง")
      return
    }

    setSaving(true)
    setError("")
    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selectedGoal: goal, form }),
    }).catch(() => null)
    const data = response ? await response.json().catch(() => ({})) as { error?: string } : {}

    if (!response?.ok) {
      setSaving(false)
      setError(data.error || "บันทึกโปรไฟล์ไม่สำเร็จ กรุณาลองใหม่")
      return
    }

    window.localStorage.setItem("nutriscan.profile", JSON.stringify({ selectedGoal: goal, form }))
    router.replace(destination)
    router.refresh()
  }

  return (
    <main className="min-h-svh bg-[#f3f5f4] p-0 lg:grid lg:place-items-center lg:p-6">
      <section className="mx-auto grid min-h-svh w-full max-w-6xl overflow-hidden bg-white shadow-2xl shadow-emerald-950/5 lg:min-h-[680px] lg:grid-cols-[0.92fr_1.08fr] lg:rounded-[32px]">
        <aside className="relative overflow-hidden bg-[#2ec78f] px-6 py-7 text-white sm:px-10 lg:flex lg:flex-col lg:px-12 lg:py-10">
          <div className="absolute -bottom-24 -right-20 h-64 w-64 rounded-full bg-white/5" />
          <div className="absolute left-[-90px] top-1/2 h-48 w-48 rounded-full bg-white/5" />

          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-xl font-black sm:text-2xl">ScanZapp AI</p>
              <p className="text-xs font-medium text-white/75">ผู้ช่วยสุขภาพส่วนตัวของคุณ</p>
            </div>
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15">
              <Bot className="h-6 w-6" />
            </span>
          </div>

          <div className="relative mt-8 lg:my-auto">
            <p className="text-xs font-bold text-white/65">ขั้นตอนที่ {step} จาก 2</p>
            <h1 className="mt-3 max-w-sm text-3xl font-black leading-tight lg:text-4xl">
              {step === 1 ? "มารู้จักคุณให้มากขึ้น" : "กำหนดเป้าหมายสุขภาพของคุณ"}
            </h1>
            <p className="mt-4 max-w-sm text-sm leading-6 text-white/80">
              {step === 1
                ? "ข้อมูลพื้นฐานช่วยให้ ScanZapp AI คำนวณพลังงานและคำแนะนำที่เหมาะกับคุณ"
                : "เลือกเป้าหมายหลัก แล้วเราจะปรับแผนโภชนาการให้เข้ากับชีวิตประจำวันของคุณ"}
            </p>
          </div>

          <div className="relative mt-7 flex items-center gap-2 lg:mt-auto">
            <span className={`h-2 rounded-full bg-white transition-all ${step === 1 ? "w-8" : "w-2 opacity-50"}`} />
            <span className={`h-2 rounded-full bg-white transition-all ${step === 2 ? "w-8" : "w-2 opacity-50"}`} />
          </div>
        </aside>

        <div className="flex min-h-0 flex-col px-5 py-7 sm:px-10 lg:justify-center lg:px-14 lg:py-10">
          {step === 1 ? (
            <div className="mx-auto w-full max-w-xl">
              <div className="mb-7">
                <h2 className="text-2xl font-black text-neutral-950">ตั้งค่าโปรไฟล์ของคุณ</h2>
                <p className="mt-1 text-sm text-neutral-500">กรอกข้อมูลเพื่อคำนวณเป้าหมายที่เหมาะสม</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="ชื่อที่ต้องการให้เรียก" value={form.name} onChange={(value) => update("name", value)} className="sm:col-span-2" />
                <Field label="อีเมล" value={form.email} disabled className="sm:col-span-2" />
                <Field label="อายุ" type="number" value={form.age} onChange={(value) => update("age", value)} suffix="ปี" />
                <label className="block">
                  <span className="text-sm font-bold text-neutral-700">เพศ</span>
                  <select
                    value={form.gender}
                    onChange={(event) => update("gender", event.target.value)}
                    className="mt-2 h-12 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-emerald-400"
                  >
                    <option value="">เลือกเพศ</option>
                    <option value="male">ชาย</option>
                    <option value="female">หญิง</option>
                    <option value="unspecified">ไม่ระบุ</option>
                  </select>
                </label>
                <Field label="ส่วนสูง" type="number" value={form.height} onChange={(value) => update("height", value)} suffix="ซม." />
                <Field label="น้ำหนักปัจจุบัน" type="number" value={form.weight} onChange={(value) => update("weight", value)} suffix="กก." />
                <label className="block sm:col-span-2">
                  <span className="text-sm font-bold text-neutral-700">ระดับกิจกรรม</span>
                  <select
                    value={form.activity}
                    onChange={(event) => update("activity", event.target.value)}
                    className="mt-2 h-12 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-emerald-400"
                  >
                    <option value="">เลือกระดับกิจกรรม</option>
                    <option value="low">น้อย — ทำงานนั่งโต๊ะเป็นหลัก</option>
                    <option value="medium">ปานกลาง — ออกกำลังกาย 3–4 วัน/สัปดาห์</option>
                    <option value="high">มาก — ออกกำลังกายหนักหรือใช้แรงงาน</option>
                  </select>
                </label>
              </div>

              {error && <ErrorMessage message={error} />}
              <Button type="button" onClick={goToGoal} className="mt-6 h-12 w-full rounded-xl bg-[#2ec78f] text-white hover:bg-[#20b77f]">
                เลือกเป้าหมาย
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-xl">
              <button type="button" onClick={() => setStep(1)} className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-neutral-500 hover:text-neutral-900">
                <ArrowLeft className="h-4 w-4" />
                กลับไปแก้ข้อมูล
              </button>
              <h2 className="text-2xl font-black text-neutral-950">เลือกเป้าหมายของคุณ</h2>
              <p className="mt-1 text-sm text-neutral-500">AI จะออกแบบคำแนะนำจากเป้าหมายหลักนี้</p>

              <div className="mt-6 space-y-3">
                {goals.map((item) => {
                  const Icon = item.icon
                  const selected = goal === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setGoal(item.id)
                        setError("")
                      }}
                      className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all ${
                        selected ? `${item.color} ring-2 ring-emerald-400/20` : "border-neutral-200 bg-white hover:border-emerald-200"
                      }`}
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/80 shadow-sm">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-black text-neutral-900">{item.label}</span>
                        <span className="mt-1 block text-xs leading-5 text-neutral-500">{item.description}</span>
                      </span>
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${selected ? "border-emerald-500 bg-emerald-500 text-white" : "border-neutral-300"}`}>
                        {selected && <Check className="h-3 w-3" />}
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className="mt-5 rounded-2xl bg-neutral-50 p-4">
                <div className="flex items-center gap-2 text-sm font-black text-neutral-800">
                  <Target className="h-4 w-4 text-emerald-500" />
                  น้ำหนักเป้าหมาย
                </div>
                <div className="mt-3">
                  <Field label="" type="number" value={form.targetWeight} onChange={(value) => update("targetWeight", value)} suffix="กก." />
                </div>
              </div>

              {error && <ErrorMessage message={error} />}
              <Button type="button" onClick={() => void submit()} disabled={saving} className="mt-6 h-12 w-full rounded-xl bg-[#2ec78f] text-white hover:bg-[#20b77f]">
                {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
                {saving ? "กำลังสร้างแผน..." : "สร้างแผนของฉัน"}
                {!saving && <ArrowRight className="h-4 w-4" />}
              </Button>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  suffix,
  disabled,
  className = "",
}: {
  label: string
  value: string
  onChange?: (value: string) => void
  type?: string
  suffix?: string
  disabled?: boolean
  className?: string
}) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="text-sm font-bold text-neutral-700">{label}</span>}
      <div className={`relative ${label ? "mt-2" : ""}`}>
        <input
          required={!disabled}
          disabled={disabled}
          type={type}
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          className="h-12 w-full rounded-xl border border-neutral-200 bg-white px-3 pr-12 text-sm outline-none transition-colors focus:border-emerald-400 disabled:bg-neutral-100 disabled:text-neutral-400"
        />
        {suffix && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-bold text-neutral-400">{suffix}</span>}
      </div>
    </label>
  )
}

function ErrorMessage({ message }: { message: string }) {
  return <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">{message}</p>
}
