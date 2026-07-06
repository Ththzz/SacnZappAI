"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { BadgeCheck, Check, Goal, Target, UserRound } from "lucide-react"
import { STORAGE_KEYS } from "@/lib/user-data"
import HealthGoalEditor, { type SyncedProfile } from "@/components/profile/HealthGoalEditor"

type GoalKey = "lean" | "maintain" | "cut"
type ProfileTab = "profile" | "goals"

type ProfileForm = {
  name: string
  lastName: string
  email: string
  phone: string
  birthDate: string
  gender: string
  age: string
  height: string
  weight: string
  targetWeight: string
  activity: string
  chronicCondition: string
}

type StoredProfile = {
  selectedGoal?: GoalKey
  form?: Partial<ProfileForm>
}

const emptyForm: ProfileForm = {
  name: "",
  lastName: "",
  email: "",
  phone: "",
  birthDate: "",
  gender: "",
  age: "",
  height: "",
  weight: "",
  targetWeight: "",
  activity: "",
  chronicCondition: "",
}

const goalOptions: { key: GoalKey; label: string }[] = [
  { key: "cut", label: "ลดน้ำหนัก" },
  { key: "maintain", label: "รักษาน้ำหนัก" },
  { key: "lean", label: "เพิ่มกล้ามเนื้อ" },
]

function calculateAge(birthDate: string) {
  const birthday = new Date(`${birthDate}T00:00:00`)
  if (Number.isNaN(birthday.getTime())) return ""
  const today = new Date()
  let age = today.getFullYear() - birthday.getFullYear()
  const monthDifference = today.getMonth() - birthday.getMonth()
  if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthday.getDate())) age -= 1
  return age > 0 ? String(age) : ""
}

export default function ProfileClient({
  initialTab = "profile",
}: {
  initialTab?: ProfileTab
}) {
  const [activeTab, setActiveTab] = useState<ProfileTab>(initialTab)
  const [selectedGoal, setSelectedGoal] = useState<GoalKey>("maintain")
  const [form, setForm] = useState<ProfileForm>(emptyForm)
  const [notice, setNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const savedProfile = useRef<StoredProfile>({ selectedGoal: "maintain", form: emptyForm })
  const hasInteracted = useRef(false)
  const profileRequested = useRef(false)

  const applyStoredProfile = useCallback((stored: StoredProfile) => {
    const nextGoal = goalOptions.some((goal) => goal.key === stored.selectedGoal)
      ? stored.selectedGoal!
      : "maintain"
    const nextForm = { ...emptyForm, ...stored.form }
    setSelectedGoal(nextGoal)
    setForm(nextForm)
    savedProfile.current = { selectedGoal: nextGoal, form: nextForm }
  }, [])

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.profile)
      if (raw) {
        applyStoredProfile(JSON.parse(raw) as StoredProfile)
        setLoaded(true)
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEYS.profile)
    }
  }, [applyStoredProfile])

  useEffect(() => {
    if (activeTab !== "profile" || profileRequested.current) return
    profileRequested.current = true
    fetch("/api/profile")
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as { profile?: StoredProfile }
        if (!response.ok) throw new Error("api")
        if (data.profile && !hasInteracted.current) {
          applyStoredProfile(data.profile)
          window.localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(data.profile))
        }
      })
      .catch(() => {
        try {
          const raw = window.localStorage.getItem(STORAGE_KEYS.profile)
          if (raw) applyStoredProfile(JSON.parse(raw) as StoredProfile)
        } catch {
          window.localStorage.removeItem(STORAGE_KEYS.profile)
        }
      })
      .finally(() => setLoaded(true))
  }, [activeTab, applyStoredProfile])

  const handleFieldChange = (key: keyof ProfileForm, value: string) => {
    hasInteracted.current = true
    setNotice(null)
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === "birthDate" ? { age: calculateAge(value) } : {}),
    }))
  }

  const handleSave = async () => {
    hasInteracted.current = true
    const profile = { selectedGoal, form }
    setSaving(true)
    setNotice(null)
    window.localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(profile))

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      })
      if (!response.ok) throw new Error("save")
      savedProfile.current = profile
      setNotice("บันทึกการเปลี่ยนแปลงเรียบร้อยแล้ว")
    } catch {
      setNotice("บันทึกไว้ในอุปกรณ์แล้ว แต่ยังเชื่อมต่อเซิร์ฟเวอร์ไม่ได้")
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    hasInteracted.current = true
    setSelectedGoal(savedProfile.current.selectedGoal ?? "maintain")
    setForm({ ...emptyForm, ...savedProfile.current.form })
    setNotice(null)
  }

  const selectTab = (tab: ProfileTab) => {
    setActiveTab(tab)
    window.history.replaceState(null, "", tab === "goals" ? "/profile?tab=goals" : "/profile")
  }

  const applySyncedGoalProfile = (profile: SyncedProfile) => {
    hasInteracted.current = true
    const nextGoal = goalOptions.some((goal) => goal.key === profile.selectedGoal)
      ? profile.selectedGoal as GoalKey
      : selectedGoal
    const nextForm = { ...form }

    for (const key of Object.keys(emptyForm) as (keyof ProfileForm)[]) {
      const value = profile.form?.[key]
      if (typeof value === "string") nextForm[key] = value
    }

    setSelectedGoal(nextGoal)
    setForm(nextForm)
    savedProfile.current = { selectedGoal: nextGoal, form: nextForm }
  }

  const displayName = [form.name, form.lastName].filter(Boolean).join(" ") || "ผู้ใช้งาน"
  const initial = (form.name || form.email || "U").trim().charAt(0).toUpperCase()
  const activeGoal = goalOptions.find((goal) => goal.key === selectedGoal)?.label
  const currentWeight = Number(form.weight)
  const targetWeight = Number(form.targetWeight)
  const weightDifference =
    Number.isFinite(currentWeight) && Number.isFinite(targetWeight)
      ? Math.abs(currentWeight - targetWeight)
      : 0

  return (
    <div className="mx-auto max-w-[1180px] text-[#202421]" aria-busy={activeTab === "profile" && !loaded}>
      {notice && (
        <div
          role="status"
          className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"
        >
          {notice}
        </div>
      )}

      <div className="mb-5 flex w-full max-w-xl rounded-2xl bg-white p-1.5 shadow-sm ring-1 ring-black/5">
        <button
          type="button"
          onClick={() => selectTab("profile")}
          className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition-colors ${
            activeTab === "profile"
              ? "bg-[#2EC78F] text-white shadow-sm"
              : "text-neutral-500 hover:bg-neutral-50"
          }`}
        >
          <UserRound className="h-4 w-4" />
          ข้อมูลโปรไฟล์
        </button>
        <button
          type="button"
          onClick={() => selectTab("goals")}
          className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition-colors ${
            activeTab === "goals"
              ? "bg-[#2EC78F] text-white shadow-sm"
              : "text-neutral-500 hover:bg-neutral-50"
          }`}
        >
          <Goal className="h-4 w-4" />
          เป้าหมายสุขภาพ
        </button>
      </div>

      {activeTab === "goals" ? (
        <HealthGoalEditor onProfileSynced={applySyncedGoalProfile} />
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.08fr)_minmax(320px,.92fr)]">
        <section className="rounded-[22px] border border-neutral-100 bg-white p-5 shadow-[0_5px_22px_rgba(32,50,42,0.07)] sm:p-6">
          <h2 className="text-base font-extrabold">ข้อมูลพื้นฐาน</h2>

          <div className="mt-5 flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#7ADDB9] text-2xl font-bold text-white">
              {initial}
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-extrabold">{displayName}</p>
              <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-[#20B77E]">
                <BadgeCheck className="h-4 w-4" />
                โปรไฟล์ผู้ใช้งาน
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-x-4 gap-y-4 sm:grid-cols-2">
            <Field label="ชื่อ" value={form.name} onChange={(value) => handleFieldChange("name", value)} />
            <Field label="นามสกุล" value={form.lastName} onChange={(value) => handleFieldChange("lastName", value)} />
            <Field
              className="sm:col-span-2"
              label="อีเมล"
              type="email"
              value={form.email}
              onChange={(value) => handleFieldChange("email", value)}
            />
            <Field
              className="sm:col-span-2"
              label="เบอร์โทรศัพท์"
              type="tel"
              placeholder="0xx-xxx-xxxx"
              value={form.phone}
              onChange={(value) => handleFieldChange("phone", value)}
            />
            <Field
              label="วันเกิด"
              type="date"
              value={form.birthDate}
              onChange={(value) => handleFieldChange("birthDate", value)}
            />
            <SelectField
              label="เพศ"
              value={form.gender}
              onChange={(value) => handleFieldChange("gender", value)}
              options={[
                { value: "", label: "ไม่ระบุ" },
                { value: "female", label: "หญิง" },
                { value: "male", label: "ชาย" },
                { value: "unspecified", label: "อื่น ๆ" },
              ]}
            />
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#2EC78F] px-5 text-sm font-bold text-white transition-colors hover:bg-[#22B881] disabled:cursor-wait disabled:opacity-70"
            >
              <Check className="h-4 w-4" />
              {saving ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="h-11 rounded-full border border-neutral-200 bg-neutral-50 px-5 text-sm font-semibold text-neutral-500 transition-colors hover:bg-neutral-100"
            >
              ยกเลิก
            </button>
          </div>
        </section>

        <section className="overflow-hidden rounded-[22px] border border-neutral-100 bg-white shadow-[0_5px_22px_rgba(32,50,42,0.07)]">
          <div className="p-5 sm:p-6">
            <h2 className="text-base font-extrabold">ข้อมูลสุขภาพ</h2>
            <div className="mt-5 space-y-4">
              <Field
                label="น้ำหนัก (kg)"
                type="number"
                value={form.weight}
                onChange={(value) => handleFieldChange("weight", value)}
              />
              <Field
                label="ส่วนสูง (cm)"
                type="number"
                value={form.height}
                onChange={(value) => handleFieldChange("height", value)}
              />
              <SelectField
                label="กิจกรรม"
                value={form.activity}
                onChange={(value) => handleFieldChange("activity", value)}
                options={[
                  { value: "", label: "เลือกระดับกิจกรรม" },
                  { value: "low", label: "น้อย" },
                  { value: "medium", label: "ปานกลาง" },
                  { value: "high", label: "หนัก" },
                ]}
              />
              <Field
                label="โรคประจำตัว"
                placeholder="ไม่มี"
                value={form.chronicCondition}
                onChange={(value) => handleFieldChange("chronicCondition", value)}
              />
              <Field
                label="น้ำหนักเป้าหมาย (kg)"
                type="number"
                value={form.targetWeight}
                onChange={(value) => handleFieldChange("targetWeight", value)}
              />
            </div>
          </div>

          <div className="bg-[#DDF8EC] px-5 py-5 sm:px-6">
            <div className="flex items-center gap-2 text-sm font-extrabold text-[#149B6D]">
              <Target className="h-4 w-4" />
              เป้าหมายปัจจุบัน
            </div>
            <p className="mt-2 text-sm font-semibold text-[#269F77]">
              {activeGoal}
              {weightDifference > 0 && selectedGoal !== "maintain"
                ? ` ${weightDifference.toFixed(weightDifference % 1 === 0 ? 0 : 1)} kg`
                : ""}
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {goalOptions.map((goal) => (
                <button
                  key={goal.key}
                  type="button"
                  onClick={() => {
                    setSelectedGoal(goal.key)
                    setNotice(null)
                  }}
                  className={`min-h-10 rounded-xl px-2 py-2 text-xs font-bold transition-colors ${
                    selectedGoal === goal.key
                      ? "bg-[#2EC78F] text-white shadow-sm"
                      : "bg-white/75 text-[#218B68] hover:bg-white"
                  }`}
                >
                  {goal.label}
                </button>
              ))}
            </div>
          </div>
        </section>
        </div>
      )}
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  className = "",
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
  className?: string
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-semibold text-neutral-500">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 text-sm font-medium text-neutral-800 outline-none transition focus:border-[#2EC78F] focus:bg-white focus:ring-3 focus:ring-emerald-100"
      />
    </label>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-neutral-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 text-sm font-medium text-neutral-800 outline-none transition focus:border-[#2EC78F] focus:bg-white focus:ring-3 focus:ring-emerald-100"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
