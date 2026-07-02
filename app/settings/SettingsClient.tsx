"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  Bell,
  ChevronRight,
  Droplets,
  Flame,
  Goal,
  HandPlatter,
  Scale,
  Trash2,
  UserRound,
  Download,
  CalendarDays,
  ArrowLeft,
  Activity,
  ChartColumnIncreasing,
} from "lucide-react"
import { DEFAULT_SETTINGS, normalizeSettings, updateHealthGoal, type ActivityLevel, type AppSettings, type GoalMode } from "@/lib/settings"

const SETTINGS_STORAGE_KEY = "nutriscan.settings.v1"
const STORAGE_KEYS_TO_CLEAR = [
  "nutriscan.settings.v1",
  "nutriscan.water.logs",
  "nutriscan.meal.history",
  "nutriscan.profile",
  "nutriscan.scan.history",
]

export default function SettingsClient() {
  const router = useRouter()
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(false)
  const [view, setView] = useState<"main" | "health-goal">("main")
  const [notice, setNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
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
          return raw ? (JSON.parse(raw) as AppSettings) : null
        } catch {
          return null
        }
      })
      .then((parsed) => {
        const nextSettings = parsed ? normalizeSettings(parsed) : DEFAULT_SETTINGS
        lastPersistedSettings.current = JSON.stringify(nextSettings)
        setSettings(nextSettings)
      })
      .finally(() => setLoaded(true))
  }, [])

  useEffect(() => {
    if (!loaded) return
    const serializedSettings = JSON.stringify(settings)
    if (serializedSettings === lastPersistedSettings.current) return

    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, serializedSettings)
      fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
        signal: controller.signal,
      })
        .then((response) => {
          if (response.ok) lastPersistedSettings.current = serializedSettings
        })
        .catch(() => undefined)
    }, 600)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [settings, loaded])

  const saveHealthGoal = async () => {
    const serializedSettings = JSON.stringify(settings)
    setSaving(true)
    setNotice(null)
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, serializedSettings)

    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      })
      if (!response.ok) throw new Error("save")
      lastPersistedSettings.current = serializedSettings
      setNotice("บันทึกการเปลี่ยนแปลงเป้าหมายแล้ว")
    } catch {
      setNotice("บันทึกไว้ในอุปกรณ์แล้ว แต่ยังเชื่อมต่อเซิร์ฟเวอร์ไม่ได้")
    } finally {
      setSaving(false)
    }
  }

  const signOut = async () => {
    await fetch("/api/auth/sign-out", { method: "POST" }).catch(() => undefined)
    router.replace("/sign-in")
    router.refresh()
  }

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

  const updateNotification = (key: keyof AppSettings["notifications"], value: boolean) => {
    setSettings((current) => ({
      ...current,
      notifications: {
        ...current.notifications,
        [key]: value,
      },
    }))
  }

  const updateGoal = <K extends keyof AppSettings["healthGoal"]>(key: K, value: AppSettings["healthGoal"][K]) => {
    setSettings((current) => ({
      ...current,
      healthGoal: updateHealthGoal(current.healthGoal, key, value),
    }))
  }

  const applyGoalMode = (mode: GoalMode) => {
    updateGoal("mode", mode)
  }

  const exportData = () => {
    const meals = readStoredJson("nutriscan.meal.history") ?? []
    const waterLogs = readStoredJson("nutriscan.water.logs") ?? []
    const profile = readStoredJson("nutriscan.profile")
    const payload = {
      exportedAt: new Date().toISOString(),
      settings,
      meals,
      waterLogs,
      profile,
    }

    const jsonBlob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
    downloadBlob(jsonBlob, "nutriscan-data.json")

    const csvRows = [
      ["section", "key", "value", "extra"],
      ["notification", "mealReminder", String(settings.notifications.mealReminder)],
      ["notification", "waterReminder", String(settings.notifications.waterReminder)],
      ["notification", "weeklyReport", String(settings.notifications.weeklyReport)],
      ["healthGoal", "mode", settings.healthGoal.mode],
      ["healthGoal", "weeklyDeltaKg", String(settings.healthGoal.weeklyDeltaKg)],
      ["healthGoal", "currentWeightKg", String(settings.healthGoal.currentWeightKg)],
      ["healthGoal", "targetWeightKg", String(settings.healthGoal.targetWeightKg)],
      ["healthGoal", "dailyCalories", String(settings.healthGoal.dailyCalories)],
      ["healthGoal", "activityLevel", settings.healthGoal.activityLevel],
      ...toMealCsvRows(meals),
      ...toWaterCsvRows(waterLogs),
    ]

    const csv = csvRows.map((row) => row.map(escapeCsv).join(",")).join("\n")
    const csvBlob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    downloadBlob(csvBlob, "nutriscan-data.csv")

    setNotice("ส่งออกข้อมูลเรียบร้อยแล้ว")
  }

  const clearHistory = () => {
    const ok = window.confirm("ต้องการลบข้อมูลที่บันทึกในอุปกรณ์นี้ทั้งหมดหรือไม่?")
    if (!ok) return

    STORAGE_KEYS_TO_CLEAR.forEach((key) => window.localStorage.removeItem(key))
    setSettings(DEFAULT_SETTINGS)
    setNotice("ล้างประวัติเรียบร้อยแล้ว")
  }

  if (!loaded) {
    return <div className="mx-auto max-w-6xl text-sm text-neutral-500">กำลังโหลดการตั้งค่า...</div>
  }

  if (view === "health-goal") {
    return (
      <HealthGoalView
        settings={settings}
        recommendation={recommendation}
        onBack={() => setView("main")}
        onUpdateGoal={updateGoal}
        onApplyGoalMode={applyGoalMode}
        onSave={saveHealthGoal}
        saving={saving}
      />
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 text-neutral-900">
      {notice && (
        <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {notice}
        </div>
      )}

      <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
        <main className="space-y-5">
          <SettingsCard title="บัญชีและโปรไฟล์">
            <SettingsRow icon={UserRound} label="ข้อมูลส่วนตัว" sub="แก้ไขชื่อ อีเมล รหัสผ่าน" action={<Link className="text-neutral-400 hover:text-neutral-700" href="/profile"><ChevronRight className="h-4 w-4" /></Link>} />
            <SettingsRow icon={Goal} label="เป้าหมายสุขภาพ" sub="BMI, แคลอรี่, เป้าหมายน้ำหนัก" action={<button type="button" onClick={() => setView("health-goal")} className="text-neutral-400 hover:text-neutral-700"><ChevronRight className="h-4 w-4" /></button>} />
          </SettingsCard>

          <SettingsCard title="การแจ้งเตือน">
            <SettingsRow icon={Bell} label="การแจ้งเตือนมื้ออาหาร" sub="เตือนเวลาบันทึก" action={<Toggle checked={settings.notifications.mealReminder} onChange={(value) => updateNotification("mealReminder", value)} />} />
            <SettingsRow icon={Droplets} label="เตือนดื่มน้ำ" sub="ทุก 2 ชั่วโมง" action={<Toggle checked={settings.notifications.waterReminder} onChange={(value) => updateNotification("waterReminder", value)} />} />
            <SettingsRow icon={ChartColumnIncreasing} label="รายงานสัปดาห์" sub="สรุปวันอาทิตย์" action={<Toggle checked={settings.notifications.weeklyReport} onChange={(value) => updateNotification("weeklyReport", value)} />} />
          </SettingsCard>

          <SettingsCard title="ข้อมูลและความเป็นส่วนตัว">
            <SettingsRow icon={Download} label="ส่งออกข้อมูล" sub="JSON และ CSV" action={<button type="button" onClick={exportData} className="text-neutral-400 hover:text-neutral-700"><ChevronRight className="h-4 w-4" /></button>} />
            <SettingsRow icon={Trash2} label="ลบประวัติทั้งหมด" sub="ไม่สามารถกู้คืนได้" danger action={<button type="button" onClick={clearHistory} className="text-neutral-400 hover:text-neutral-700"><ChevronRight className="h-4 w-4" /></button>} />
          </SettingsCard>
        </main>

        <aside className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <h2 className="text-2xl font-black">ScanZapp AI</h2>
          <p className="mt-1 text-xs text-neutral-400">เวอร์ชัน 1.0.0</p>
          <p className="mt-4 text-sm leading-6 text-neutral-500">
            ระบบวิเคราะห์โภชนาการที่ช่วยให้คุณจัดการเป้าหมายสุขภาพได้ชัดเจนและสม่ำเสมอ
          </p>
          <button
            type="button"
            onClick={signOut}
            className="mt-8 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-rose-300 text-sm font-bold text-rose-500 hover:bg-rose-50"
          >
            ออกจากระบบ
          </button>
          <p className="mt-5 text-[11px] text-neutral-400">ScanZapp AI v1.0 · © 2026</p>
        </aside>
      </section>
    </div>
  )
}

function HealthGoalView({
  settings,
  recommendation,
  onBack,
  onUpdateGoal,
  onApplyGoalMode,
  onSave,
  saving,
}: {
  settings: AppSettings
  recommendation: { protein: number; fat: number; carbs: number; weeks: number }
  onBack: () => void
  onUpdateGoal: <K extends keyof AppSettings["healthGoal"]>(key: K, value: AppSettings["healthGoal"][K]) => void
  onApplyGoalMode: (mode: GoalMode) => void
  onSave: () => void | Promise<void>
  saving: boolean
}) {
  const modeLabels: Record<GoalMode, string> = {
    lose: "ลดน้ำหนัก",
    maintain: "รักษาน้ำหนัก",
    gain: "เพิ่มน้ำหนัก",
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 text-neutral-900">
      <header className="space-y-1">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-500 hover:text-neutral-800">
          <ArrowLeft className="h-4 w-4" />
          การตั้งค่า
        </button>
        <h1 className="text-2xl font-bold tracking-normal">เป้าหมายสุขภาพ</h1>
        <p className="text-sm text-neutral-500">แก้ไขเป้าหมายโภชนาการและอัตราการเปลี่ยนน้ำหนัก</p>
      </header>

      <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <main className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <h2 className="text-base font-extrabold">แก้ไขเป้าหมายสุขภาพ</h2>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {(["lose", "maintain", "gain"] as GoalMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onApplyGoalMode(mode)}
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
            <label className="space-y-2">
              <span className="text-sm font-semibold text-neutral-500">อัตราการลดน้ำหนัก (kg/สัปดาห์)</span>
              <input
                type="range"
                min={0.25}
                max={1}
                step={0.05}
                value={settings.healthGoal.weeklyDeltaKg}
                onChange={(event) => onUpdateGoal("weeklyDeltaKg", Number(event.target.value))}
                className="w-full accent-[#2EC78F]"
              />
              <div className="flex justify-between text-xs font-semibold text-neutral-400">
                <span>0.25</span>
                <span className="text-[#2EC78F]">{settings.healthGoal.weeklyDeltaKg.toFixed(2)} kg/สัปดาห์</span>
                <span>1.00</span>
              </div>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="น้ำหนักปัจจุบัน (kg)" value={settings.healthGoal.currentWeightKg} onChange={(value) => onUpdateGoal("currentWeightKg", value)} />
              <Field label="น้ำหนักเป้าหมาย (kg)" value={settings.healthGoal.targetWeightKg} onChange={(value) => onUpdateGoal("targetWeightKg", value)} />
              <Field label="แคลอรี่เป้าหมายต่อวัน (kcal)" value={settings.healthGoal.dailyCalories} onChange={(value) => onUpdateGoal("dailyCalories", value)} />
              <label className="space-y-2">
                <span className="text-sm font-semibold text-neutral-500">ระดับกิจกรรม</span>
                <select
                  className="h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm font-semibold outline-none focus:border-[#2EC78F]"
                  value={settings.healthGoal.activityLevel}
                  onChange={(event) => onUpdateGoal("activityLevel", event.target.value as ActivityLevel)}
                >
                  <option value="low">น้อย</option>
                  <option value="medium">ปานกลาง</option>
                  <option value="high">หนัก</option>
                </select>
              </label>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={onSave} disabled={saving} className="inline-flex h-11 items-center justify-center rounded-xl bg-[#2EC78F] text-sm font-bold text-white hover:bg-[#05b474] disabled:cursor-wait disabled:opacity-70">
              {saving ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
            </button>
            <button type="button" onClick={onBack} className="inline-flex h-11 items-center justify-center rounded-xl border border-neutral-200 text-sm font-bold text-neutral-500 hover:bg-neutral-50">
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
          <PlanRow icon={CalendarDays} label="ระยะเวลาโดยประมาณ" value={`~${recommendation.weeks} สัปดาห์`} />
          <div className="rounded-xl bg-emerald-50 p-3 text-xs font-medium text-emerald-700">
            ระบบจะปรับแผนโภชนาการและสัดส่วนสารอาหารตามค่าที่บันทึกไว้
          </div>
        </aside>
      </section>
    </div>
  )
}

function SettingsCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <h2 className="px-1 text-sm font-bold text-neutral-500">{title}</h2>
      <div className="mt-2 divide-y divide-neutral-100">{children}</div>
    </section>
  )
}

function SettingsRow({
  icon: Icon,
  label,
  sub,
  action,
  danger = false,
}: {
  icon: typeof Bell
  label: string
  sub: string
  action: React.ReactNode
  danger?: boolean
}) {
  return (
    <div className="grid grid-cols-[28px_1fr_auto] items-center gap-3 px-1 py-3">
      <Icon className={`h-4 w-4 ${danger ? "text-rose-500" : "text-neutral-500"}`} />
      <div>
        <p className={`text-sm font-bold ${danger ? "text-rose-500" : "text-neutral-900"}`}>{label}</p>
        <p className="text-xs text-neutral-400">{sub}</p>
      </div>
      {action}
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-12 rounded-full transition-colors ${checked ? "bg-[#2EC78F]" : "bg-neutral-200"}`}
      aria-pressed={checked}
      aria-label={checked ? "เปิดใช้งาน" : "ปิดใช้งาน"}
    >
      <span
        className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform"
        style={{ transform: checked ? "translateX(24px)" : "translateX(0px)" }}
      />
    </button>
  )
}

function PlanRow({ icon: Icon, label, value }: { icon: typeof Bell; label: string; value: string }) {
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

function Field({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
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

function escapeCsv(value: string) {
  const escaped = value.replaceAll('"', '""')
  return `"${escaped}"`
}

function readStoredJson(key: string) {
  const raw = window.localStorage.getItem(key)
  if (!raw) return null

  try {
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

function toMealCsvRows(value: unknown) {
  if (!Array.isArray(value)) return []

  return value.map((entry) => {
    const meal = entry as Record<string, unknown>
    return [
      "meal",
      String(meal.name ?? ""),
      String(meal.calories ?? ""),
      String(meal.time ?? meal.date ?? ""),
    ]
  })
}

function toWaterCsvRows(value: unknown) {
  if (!Array.isArray(value)) return []

  return value.map((entry) => {
    const waterLog = entry as Record<string, unknown>
    return [
      "water",
      String(waterLog.time ?? ""),
      String(waterLog.amount ?? ""),
      "ml",
    ]
  })
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
