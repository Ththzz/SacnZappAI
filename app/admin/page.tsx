"use client"

import { useEffect, useState } from "react"
import { ShieldCheck, UsersRound } from "lucide-react"

type AdminUser = {
  id: string
  name: string
  email: string
  role: "user" | "admin"
  createdAt: string
}

export default function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/api/admin/users")
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as { users?: AdminUser[]; error?: string }
        if (!response.ok) throw new Error(data.error ?? "โหลดข้อมูลแอดมินไม่สำเร็จ")
        setUsers(data.users ?? [])
      })
      .catch((adminError) => setError(adminError instanceof Error ? adminError.message : "โหลดข้อมูลแอดมินไม่สำเร็จ"))
  }, [])

  return (
    <div className="mx-auto max-w-6xl space-y-5 text-neutral-900">
      <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black">แอดมิน</h1>
            <p className="mt-1 text-sm font-medium text-neutral-400">จัดการภาพรวมบัญชีผู้ใช้ในระบบ</p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <ShieldCheck className="h-6 w-6" />
          </div>
        </div>
      </section>

      <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <div className="mb-4 flex items-center gap-2">
          <UsersRound className="h-5 w-5 text-emerald-500" />
          <h2 className="text-lg font-black">ผู้ใช้ทั้งหมด</h2>
        </div>

        {error && <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">{error}</div>}

        <div className="overflow-hidden rounded-2xl border border-neutral-100">
          {users.map((user) => (
            <div key={user.id} className="grid gap-2 border-b border-neutral-100 px-4 py-3 last:border-b-0 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
              <div>
                <p className="font-bold text-neutral-900">{user.name}</p>
                <p className="text-sm text-neutral-400">{user.email}</p>
              </div>
              <p className="text-sm font-medium text-neutral-500">{new Date(user.createdAt).toLocaleString("th-TH")}</p>
              <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${user.role === "admin" ? "bg-emerald-50 text-emerald-600" : "bg-neutral-100 text-neutral-500"}`}>
                {user.role === "admin" ? "แอดมิน" : "ยูสเซอร์"}
              </span>
            </div>
          ))}
          {!error && users.length === 0 && <div className="px-4 py-6 text-sm font-medium text-neutral-400">ยังไม่มีข้อมูลผู้ใช้</div>}
        </div>
      </section>
    </div>
  )
}
