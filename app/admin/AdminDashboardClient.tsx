"use client"

import { useState } from "react"
import { LogOut } from "lucide-react"
import { useRouter } from "next/navigation"

export type AdminUser = {
  id: string
  name: string
  email: string
  role: "user" | "admin"
  createdAt: string
}

export function AdminSignOutButton() {
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)

  const signOut = async () => {
    setSigningOut(true)
    await fetch("/api/auth/sign-out", { method: "POST" }).catch(() => undefined)
    router.replace("/sign-in")
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={() => void signOut()}
      disabled={signingOut}
      className="inline-flex h-10 items-center gap-2 rounded-full bg-neutral-900 px-4 text-sm font-bold text-white hover:bg-neutral-800 disabled:opacity-50"
    >
      <LogOut className="h-4 w-4" />
      {signingOut ? "กำลังออก..." : "ออกจากระบบ"}
    </button>
  )
}

export function AdminUsersTable({
  initialUsers,
  initialNextCursor,
}: {
  initialUsers: AdminUser[]
  initialNextCursor: string | null
}) {
  const [users, setUsers] = useState(initialUsers)
  const [nextCursor, setNextCursor] = useState(initialNextCursor)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const loadMore = async () => {
    if (!nextCursor || loading) return
    setLoading(true)
    setError("")
    const response = await fetch(`/api/admin/users?limit=50&cursor=${encodeURIComponent(nextCursor)}`).catch(() => null)
    const data = response
      ? await response.json().catch(() => ({})) as { users?: AdminUser[]; nextCursor?: string | null; error?: string }
      : {}
    setLoading(false)
    if (!response?.ok) {
      setError(data.error ?? "โหลดข้อมูลผู้ใช้เพิ่มเติมไม่สำเร็จ")
      return
    }
    setUsers((current) => [...current, ...(data.users ?? [])])
    setNextCursor(data.nextCursor ?? null)
  }

  return (
    <>
      <div className="flex items-center justify-end border-b border-neutral-100 px-5 py-3">
        <span className="text-sm font-bold text-neutral-400">{users.length.toLocaleString()} บัญชีที่โหลดแล้ว</span>
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
      {users.length === 0 && <div className="px-5 py-6 text-sm font-medium text-neutral-400">ยังไม่มีข้อมูลผู้ใช้</div>}
      {error && <div className="border-t border-rose-100 bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-600">{error}</div>}
      {nextCursor && (
        <div className="border-t border-neutral-100 p-4 text-center">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loading}
            className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-bold text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
          >
            {loading ? "กำลังโหลด..." : "โหลดผู้ใช้เพิ่มเติม"}
          </button>
        </div>
      )}
    </>
  )
}
