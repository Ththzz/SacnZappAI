"use client"

import { useEffect, useState } from "react"
import { Activity, AlertTriangle, BarChart3, Droplets, LayoutDashboard, LogOut, ScanLine, ShieldCheck, Utensils, UsersRound } from "lucide-react"
import { useRouter } from "next/navigation"

type AdminUser = {
  id: string
  name: string
  email: string
  role: "user" | "admin"
  createdAt: string
}

type AdminStats = {
  users: number
  admins: number
  meals: number
  mealsToday: number
  waterTodayMl: number
  scans: number
  scanErrors: number
  activeUsers7d: number
}

const defaultStats: AdminStats = {
  users: 0,
  admins: 0,
  meals: 0,
  mealsToday: 0,
  waterTodayMl: 0,
  scans: 0,
  scanErrors: 0,
  activeUsers7d: 0,
}

export default function AdminDashboardClient() {
  const router = useRouter()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [stats, setStats] = useState<AdminStats>(defaultStats)
  const [error, setError] = useState("")

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/users").then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as { users?: AdminUser[]; error?: string }
        if (!response.ok) throw new Error(data.error ?? "โหลดข้อมูลผู้ใช้ไม่สำเร็จ")
        return data.users ?? []
      }),
      fetch("/api/admin/stats").then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as { stats?: AdminStats; error?: string }
        if (!response.ok) throw new Error(data.error ?? "โหลดสถิติไม่สำเร็จ")
        return data.stats ?? defaultStats
      }),
    ])
      .then(([nextUsers, nextStats]) => {
        setUsers(nextUsers)
        setStats(nextStats)
      })
      .catch((adminError) => setError(adminError instanceof Error ? adminError.message : "โหลดข้อมูลแอดมินไม่สำเร็จ"))
  }, [])

  const statCards = [
    { label: "ผู้ใช้ทั้งหมด", value: stats.users.toLocaleString(), helper: `${stats.admins} แอดมิน`, icon: UsersRound, tone: "bg-emerald-50 text-emerald-600" },
    { label: "Active 7 วัน", value: stats.activeUsers7d.toLocaleString(), helper: "จาก meal/water/scan", icon: Activity, tone: "bg-sky-50 text-sky-600" },
    { label: "มื้ออาหาร", value: stats.meals.toLocaleString(), helper: `วันนี้ ${stats.mealsToday} รายการ`, icon: Utensils, tone: "bg-amber-50 text-amber-600" },
    { label: "น้ำวันนี้", value: `${Math.round(stats.waterTodayMl).toLocaleString()} ml`, helper: "รวมทั้งระบบ", icon: Droplets, tone: "bg-blue-50 text-blue-600" },
    { label: "AI scans", value: stats.scans.toLocaleString(), helper: `${stats.scanErrors} error`, icon: ScanLine, tone: "bg-violet-50 text-violet-600" },
  ]

  const signOut = async () => {
    await fetch("/api/auth/sign-out", { method: "POST" }).catch(() => undefined)
    router.replace("/sign-in")
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900">
      <aside className="fixed inset-y-0 left-0 hidden w-72 flex-col border-r border-neutral-200 bg-neutral-950 text-white lg:flex">
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-black">ScanZapp Admin</p>
            <p className="text-xs font-medium text-white/45">Operations Console</p>
          </div>
        </div>
        <nav className="space-y-2 p-4">
          <div className="flex items-center gap-3 rounded-xl bg-white/10 px-3 py-2 text-sm font-bold">
            <LayoutDashboard className="h-4 w-4 text-emerald-300" />
            ภาพรวมระบบ
          </div>
          <div className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-white/55">
            <UsersRound className="h-4 w-4" />
            ผู้ใช้งาน
          </div>
          <div className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-white/55">
            <BarChart3 className="h-4 w-4" />
            รายงานและสถิติ
          </div>
        </nav>
        <div className="mt-auto border-t border-white/10 p-4">
          <button type="button" onClick={signOut} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white/10 text-sm font-bold text-white hover:bg-white/15">
            <LogOut className="h-4 w-4" />
            ออกจากระบบ
          </button>
        </div>
      </aside>

      <main className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/90 px-4 py-4 backdrop-blur sm:px-6">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">Admin Console</p>
              <h1 className="mt-1 text-2xl font-black">ภาพรวมระบบ</h1>
            </div>
            <button type="button" onClick={() => router.push("/")} className="inline-flex h-10 items-center justify-center rounded-full border border-neutral-200 px-4 text-sm font-bold text-neutral-600 hover:bg-neutral-50">
              กลับไปหน้าแอป
            </button>
          </div>
        </header>

        <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
          {error && (
            <div className="flex items-start gap-2 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {statCards.map((item) => {
              const Icon = item.icon
              return (
                <article key={item.label} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5">
                  <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-lg ${item.tone}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-bold text-neutral-400">{item.label}</p>
                  <p className="mt-1 text-2xl font-black text-neutral-950">{item.value}</p>
                  <p className="mt-1 text-xs font-medium text-neutral-400">{item.helper}</p>
                </article>
              )
            })}
          </section>

          <section className="rounded-xl bg-white shadow-sm ring-1 ring-black/5">
            <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <UsersRound className="h-5 w-5 text-emerald-500" />
                <h2 className="text-lg font-black">ผู้ใช้งานในระบบ</h2>
              </div>
              <span className="text-sm font-bold text-neutral-400">{users.length.toLocaleString()} บัญชี</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-neutral-50 text-xs font-bold uppercase text-neutral-400">
                  <tr>
                    <th className="px-5 py-3">ผู้ใช้</th>
                    <th className="px-5 py-3">สิทธิ์</th>
                    <th className="px-5 py-3">วันที่สร้าง</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-t border-neutral-100">
                      <td className="px-5 py-4">
                        <p className="font-bold text-neutral-900">{user.name}</p>
                        <p className="text-sm text-neutral-400">{user.email}</p>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${user.role === "admin" ? "bg-emerald-50 text-emerald-600" : "bg-neutral-100 text-neutral-500"}`}>
                          {user.role === "admin" ? "แอดมิน" : "ยูสเซอร์"}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-medium text-neutral-500">{new Date(user.createdAt).toLocaleString("th-TH")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!error && users.length === 0 && <div className="px-5 py-6 text-sm font-medium text-neutral-400">ยังไม่มีข้อมูลผู้ใช้</div>}
          </section>
        </div>
      </main>
    </div>
  )
}
