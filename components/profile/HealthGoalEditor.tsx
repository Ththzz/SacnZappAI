"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  Activity,
  CalendarDays,
  Flame,
  Goal,
  HandPlatter,
  Scale,
} from "lucide-react"
import {
  DEFAULT_SETTINGS,
  getWeeklyRateLabel,
  mapGoalModeToProfileGoal,
  normalizeSettings,
  updateHealthGoal,
  type ActivityLevel,
  type AppSettings,
  type GoalMode,
} from "@/lib/settings"
import { STORAGE_KEYS } from "@/lib/user-data"
import PageDataLoading from "@/components/ui/PageDataLoading"

const SETTINGS_STORAGE_KEY = "nutriscan.settings.v1"

export type SyncedProfile = {
  selectedGoal?: string
  form?: Record<string, unknown>
}

export default function HealthGoalEditor({
  onProfileSynced,
}: {
  onProfileSynced?: (profile: SyncedProfile) => void
}) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [notice, setNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const lastPersistedSettings = useRef("")

  useEffect(() => {
    fetch("/api/settings")
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as { settings?: AppSettings | null }
        if (!response.ok) throw new Error("api")
        return data.settings
      })
      .catch(() => {
        try {
          const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY)
          return raw ? JSON.parse(raw) as AppSettings : null
        } catch {
          return null
        }
      })
      .then((storedSettings) => {
        const nextSettings = storedSettings ? normalizeSettings(storedSettings) : DEFAULT_SETTINGS
        lastPersistedSettings.current = JSON.stringify(nextSettings)
        setSettings(nextSettings)
      })
      .finally(() => setLoaded(true))
  }, [])

  const recommendation = useMemo(() => {
    const baseProtein = settings.healthGoal.currentWeightKg * 1.9
    const protein = Math.round(baseProtein + (settings.healthGoal.mode === "gain" ? 12 : settings.healthGoal.mode === "lose" ? 2 : 0))
    const fat = Math.round(settings.healthGoal.currentWeightKg * 0.85)
    const caloriesForCarbs = settings.healthGoal.dailyCalories - protein * 4 - fat * 9
    const carbs = Math.max(100, Math.round(caloriesForCarbs / 4))
    const weightDiff = Math.abs(settings.healthGoal.currentWeightKg - settings.healthGoal.targetWeightKg)
    const weeks = Math.max(1, Math.ceil(weightDiff / Math.max(settings.healthGoal.weeklyDeltaKg, 0.1)))

    return { protein, fat, carbs, weeks }
  }, [settings])

  const updateGoal = <K extends keyof AppSettings["healthGoal"]>(
    key: K,
    value: AppSettings["healthGoal"][K],
  ) => {
    setNotice(null)
    setSettings((current) => ({
      ...current,
      healthGoal: updateHealthGoal(current.healthGoal, key, value),
    }))
  }

  const cancelChanges = () => {
    if (lastPersistedSettings.current) {
      setSettings(normalizeSettings(JSON.parse(lastPersistedSettings.current) as AppSettings))
    }
    setNotice(null)
  }

  const saveHealthGoal = async () => {
    const serializedSettings = JSON.stringify(settings)
    setSaving(true)
    setNotice(null)
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, serializedSettings)
    const localProfile = syncStoredProfile(settings)
    onProfileSynced?.(localProfile)

    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      })
      if (!response.ok) throw new Error("save")

      const data = await response.json() as {
        settings?: AppSettings
        profile?: SyncedProfile
      }
      const savedSettings = normalizeSettings(data.settings ?? settings)
      const savedSerializedSettings = JSON.stringify(savedSettings)
      setSettings(savedSettings)
      lastPersistedSettings.current = savedSerializedSettings
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, savedSerializedSettings)

      if (data.profile) {
        window.localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(data.profile))
        onProfileSynced?.(data.profile)
      }
      setNotice("บันทึกการเปลี่ยนแปลงเป้าหมายแล้ว")
    } catch {
      lastPersistedSettings.current = serializedSettings
      setNotice("บันทึกไว้ในอุปกรณ์แล้ว แต่ยังเชื่อมต่อเซิร์ฟเวอร์ไม่ได้")
    } finally {
      setSaving(false)
    }
  }

  if (!loaded) {
    return <PageDataLoading label="กำลังโหลดเป้าหมายสุขภาพ..." />
  }

  const weeklyRateLabel = getWeeklyRateLabel(settings.healthGoal.mode)
  const modeLabels: Record<GoalMode, string> = {
    lose: "ลดน้ำหนัก",
    maintain: "รักษาน้ำหนัก",
    gain: "เพิ่มน้ำหนัก",
  }

  return (
    <div className="space-y-5 text-neutral-900">
      {notice && (
        <div
          role="status"
          className={`rounded-2xl px-4 py-3 text-sm font-semibold ${
            notice.includes("เซิร์ฟเวอร์")
              ? "bg-amber-50 text-amber-700"
              : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {notice}
        </div>
      )}

      <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <main className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <h2 className="text-base font-extrabold">แก้ไขเป้าหมายสุขภาพ</h2>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {(["lose", "maintain", "gain"] as GoalMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => updateGoal("mode", mode)}
                className={`rounded-xl border px-3 py-3 text-sm font-bold transition-colors ${
                  settings.healthGoal.mode === mode
                    ? "border-[#2EC78F] bg-emerald-50 text-[#2EC78F]"
                    : "border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50"
                }`}
              >
                {modeLabels[mode]}
              </button>
            ))}
          </div>

          <div className="mt-5 space-y-4">
            {weeklyRateLabel && (
              <label className="space-y-2">
                <span className="text-sm font-semibold text-neutral-500">{weeklyRateLabel}</span>
                <input
                  type="range"
                  min={0.25}
                  max={1}
                  step={0.05}
                  value={settings.healthGoal.weeklyDeltaKg}
                  onChange={(event) => updateGoal("weeklyDeltaKg", Number(event.target.value))}
                  className="w-full accent-[#2EC78F]"
                />
                <div className="flex justify-between text-xs font-semibold text-neutral-400">
                  <span>0.25</span>
                  <span className="text-[#2EC78F]">{settings.healthGoal.weeklyDeltaKg.toFixed(2)} kg/สัปดาห์</span>
                  <span>1.00</span>
                </div>
              </label>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField label="น้ำหนักปัจจุบัน (kg)" value={settings.healthGoal.currentWeightKg} onChange={(value) => updateGoal("currentWeightKg", value)} />
              <NumberField label="น้ำหนักเป้าหมาย (kg)" value={settings.healthGoal.targetWeightKg} onChange={(value) => updateGoal("targetWeightKg", value)} />
              <NumberField label="แคลอรี่เป้าหมายต่อวัน (kcal)" value={settings.healthGoal.dailyCalories} onChange={(value) => updateGoal("dailyCalories", value)} />
              <label className="space-y-2">
                <span className="text-sm font-semibold text-neutral-500">ระดับกิจกรรม</span>
                <select
                  className="h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm font-semibold outline-none focus:border-[#2EC78F]"
                  value={settings.healthGoal.activityLevel}
                  onChange={(event) => updateGoal("activityLevel", event.target.value as ActivityLevel)}
                >
                  <option value="low">น้อย</option>
                  <option value="medium">ปานกลาง</option>
                  <option value="high">หนัก</option>
                </select>
              </label>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void saveHealthGoal()}
              disabled={saving}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-[#2EC78F] text-sm font-bold text-white hover:bg-[#05b474] disabled:cursor-wait disabled:opacity-70"
            >
              {saving ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
            </button>
            <button
              type="button"
              onClick={cancelChanges}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-neutral-200 text-sm font-bold text-neutral-500 hover:bg-neutral-50"
            >
              ยกเลิก
            </button>
          </div>
        </main>

        <aside className="space-y-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <h2 className="text-base font-extrabold">ตัวอย่างแผนที่จะได้รับ</h2>
          <PlanRow icon={Flame} label="แคลอรี่ต่อวัน" value={`${settings.healthGoal.dailyCalories.toLocaleString()} kcal`} />
          <PlanRow icon={HandPlatter} label="โปรตีน" value={`${recommendation.protein} g / วัน`} />
          <PlanRow icon={Activity} label="คาร์โบไฮเดรต" value={`${recommendation.carbs} g / วัน`} />
          <PlanRow icon={Scale} label="ไขมัน" value={`${recommendation.fat} g / วัน`} />
          <PlanRow icon={Goal} label="เป้าหมายน้ำหนัก" value={`${settings.healthGoal.targetWeightKg} kg (จาก ${settings.healthGoal.currentWeightKg})`} />
          {settings.healthGoal.mode !== "maintain" && (
            <PlanRow icon={CalendarDays} label="ระยะเวลาโดยประมาณ" value={`~${recommendation.weeks} สัปดาห์`} />
          )}
          <div className="rounded-xl bg-emerald-50 p-3 text-xs font-medium text-emerald-700">
            ระบบจะปรับแผนโภชนาการและสัดส่วนสารอาหารตามค่าที่บันทึกไว้
          </div>
        </aside>
      </section>
    </div>
  )
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-semibold text-neutral-500">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value || 0))}
        className="h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm font-semibold outline-none focus:border-[#2EC78F]"
      />
    </label>
  )
}

function PlanRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Goal
  label: string
  value: string
}) {
  return (
    <div className="grid grid-cols-[26px_1fr] items-center gap-3 rounded-xl bg-neutral-50 px-3 py-2.5">
      <Icon className="h-4 w-4 text-neutral-500" />
      <div>
        <p className="text-[11px] font-semibold text-neutral-400">{label}</p>
        <p className="text-sm font-bold text-neutral-900">{value}</p>
      </div>
    </div>
  )
}

function syncStoredProfile(settings: AppSettings): SyncedProfile {
  let storedProfile: SyncedProfile = {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.profile)
    if (raw) storedProfile = JSON.parse(raw) as SyncedProfile
  } catch {
    storedProfile = {}
  }

  const profile = {
    ...storedProfile,
    selectedGoal: mapGoalModeToProfileGoal(settings.healthGoal.mode),
    form: {
      ...storedProfile.form,
      weight: String(settings.healthGoal.currentWeightKg),
      targetWeight: String(settings.healthGoal.targetWeightKg),
      activity: settings.healthGoal.activityLevel,
    },
  }
  window.localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(profile))
  return profile
}
