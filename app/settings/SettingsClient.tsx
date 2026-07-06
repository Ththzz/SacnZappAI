"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import {
  Bell,
  ChevronRight,
  Droplets,
  Goal,
  Trash2,
  UserRound,
  Download,
  ChartColumnIncreasing,
} from "lucide-react"
import { DEFAULT_SETTINGS, normalizeSettings, type AppSettings } from "@/lib/settings"
import PageDataLoading from "@/components/ui/PageDataLoading"

const SETTINGS_STORAGE_KEY = "nutriscan.settings.v1"
const STORAGE_KEYS_TO_CLEAR = [
  "nutriscan.settings.v1",
  "nutriscan.water.logs",
  "nutriscan.meal.history",
  "nutriscan.profile",
  "nutriscan.scan.history",
]

export default function SettingsClient() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
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

  const signOut = async () => {
    await fetch("/api/auth/sign-out", { method: "POST" }).catch(() => undefined)
    window.location.replace("/sign-in")
  }

  const updateNotification = (key: keyof AppSettings["notifications"], value: boolean) => {
    setSettings((current) => ({
      ...current,
      notifications: {
        ...current.notifications,
        [key]: value,
      },
    }))
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
    return <PageDataLoading label="กำลังโหลดการตั้งค่า..." />
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
            <SettingsRow icon={Goal} label="เป้าหมายสุขภาพ" sub="BMI, แคลอรี่, เป้าหมายน้ำหนัก" action={<Link aria-label="แก้ไขเป้าหมายสุขภาพ" href="/profile?tab=goals" className="text-neutral-400 hover:text-neutral-700"><ChevronRight className="h-4 w-4" /></Link>} />
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
