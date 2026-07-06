import { redirect } from "next/navigation"
import { Activity, BarChart3, Droplets, LayoutDashboard, ScanLine, ShieldCheck, Utensils, UsersRound } from "lucide-react"

import { getCurrentUser } from "@/lib/auth"
import { getAdminStats } from "@/lib/admin-stats"
import { prisma } from "@/lib/db"
import { AdminSignOutButton, AdminUsersTable, type AdminUser } from "./AdminDashboardClient"

function getTodayKey() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

export default async function AdminPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/sign-in?next=/admin")
  if (user.role !== "admin") redirect("/")

  const today = getTodayKey()
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const [userRows, adminStats] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 51,
    }),
    getAdminStats(today, since),
  ])
  const hasMoreUsers = userRows.length > 50
  const firstUsers = (hasMoreUsers ? userRows.slice(0, 50) : userRows).map((item) => ({
    ...item,
    createdAt: item.createdAt.toISOString(),
  })) satisfies AdminUser[]
  const stats = [
    { label: "ผู้ใช้ทั้งหมด", value: adminStats.users.toLocaleString(), helper: `${adminStats.admins} แอดมิน`, icon: UsersRound, tone: "bg-emerald-50 text-emerald-600" },
    { label: "Active 7 วัน", value: adminStats.activeUsers7d.toLocaleString(), helper: "จาก meal/water/scan", icon: Activity, tone: "bg-sky-50 text-sky-600" },
    { label: "มื้ออาหาร", value: adminStats.meals.toLocaleString(), helper: `วันนี้ ${adminStats.mealsToday} รายการ`, icon: Utensils, tone: "bg-amber-50 text-amber-600" },
    { label: "น้ำวันนี้", value: `${Math.round(adminStats.waterTodayMl).toLocaleString()} ml`, helper: "รวมทั้งระบบ", icon: Droplets, tone: "bg-blue-50 text-blue-600" },
    { label: "AI scans", value: adminStats.scans.toLocaleString(), helper: `${adminStats.scanErrors} error`, icon: ScanLine, tone: "bg-violet-50 text-violet-600" },
  ]

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900">
      <aside className="fixed inset-y-0 left-0 hidden w-72 flex-col border-r border-neutral-200 bg-neutral-950 text-white lg:flex">
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500"><ShieldCheck className="h-5 w-5" /></div>
          <div><p className="text-sm font-black">ScanZapp Admin</p><p className="text-xs font-medium text-white/45">Operations Console</p></div>
        </div>
        <nav className="space-y-2 p-4">
          <div className="flex items-center gap-3 rounded-xl bg-white/10 px-3 py-2 text-sm font-bold"><LayoutDashboard className="h-4 w-4 text-emerald-300" />ภาพรวมระบบ</div>
          <div className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-white/55"><UsersRound className="h-4 w-4" />ผู้ใช้งาน</div>
          <div className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-white/55"><BarChart3 className="h-4 w-4" />รายงาน</div>
        </nav>
      </aside>

      <main className="min-h-screen lg:ml-72">
        <header className="flex h-16 items-center justify-between border-b border-neutral-200 bg-white px-4 sm:px-6">
          <div><h1 className="text-lg font-black">ภาพรวมระบบ</h1><p className="text-xs font-medium text-neutral-400">ข้อมูลล่าสุดจากฐานข้อมูล</p></div>
          <AdminSignOutButton />
        </header>
        <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {stats.map((item) => {
              const Icon = item.icon
              return (
                <article key={item.label} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5">
                  <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-lg ${item.tone}`}><Icon className="h-5 w-5" /></div>
                  <p className="text-xs font-bold text-neutral-400">{item.label}</p>
                  <p className="mt-1 text-2xl font-black text-neutral-950">{item.value}</p>
                  <p className="mt-1 text-xs font-medium text-neutral-400">{item.helper}</p>
                </article>
              )
            })}
          </section>
          <section className="rounded-xl bg-white shadow-sm ring-1 ring-black/5">
            <div className="flex items-center gap-2 px-5 py-4">
              <UsersRound className="h-5 w-5 text-emerald-500" />
              <h2 className="text-lg font-black">ผู้ใช้งานในระบบ</h2>
            </div>
            <AdminUsersTable
              initialUsers={firstUsers}
              initialNextCursor={hasMoreUsers ? firstUsers.at(-1)?.id ?? null : null}
            />
          </section>
        </div>
      </main>
    </div>
  )
}
