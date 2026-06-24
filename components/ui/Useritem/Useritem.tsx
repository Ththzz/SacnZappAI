"use client"

import { useEffect, useState } from "react"
import { STORAGE_KEYS } from "@/lib/user-data"

type UserSummary = {
  name: string
  email: string
  role?: "user" | "admin"
}

function readUserSummary(): UserSummary {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.profile)
    if (!raw) return { name: "Thanapol Thiwong", email: "aomsinthiwong@gmail.com" }

    const stored = JSON.parse(raw) as { form?: { name?: unknown; email?: unknown } }
    const name = typeof stored.form?.name === "string" && stored.form.name.trim() ? stored.form.name.trim() : "Thanapol Thiwong"
    const email = typeof stored.form?.email === "string" && stored.form.email.trim() ? stored.form.email.trim() : "aomsinthiwong@gmail.com"

    return { name, email }
  } catch {
    return { name: "Thanapol Thiwong", email: "aomsinthiwong@gmail.com" }
  }
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "TH"
}

const Useritem = ({ isSidebarOpen }: { isSidebarOpen: boolean }) => {
  const [user, setUser] = useState<UserSummary>({ name: "Thanapol Thiwong", email: "aomsinthiwong@gmail.com" })

  useEffect(() => {
    setUser(readUserSummary())
    fetch("/api/auth/me")
      .then((response) => response.json())
      .then((data: { user?: UserSummary | null }) => {
        if (data.user) setUser(data.user)
      })
      .catch(() => undefined)
  }, [])

  return (
    <div
      className={`flex items-center overflow-hidden border rounded-[8px] transition-none md:transition-[width,padding] md:duration-150 ${
        isSidebarOpen
          ? "w-full gap-2 p-2"
          : "h-12 w-12 gap-0 p-1"
      }`}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white font-bold">
        {getInitials(user.name)}
      </div>

      <div
        className={`overflow-hidden whitespace-nowrap transition-none md:transition-[opacity,width] md:duration-150 ${
          isSidebarOpen ? "w-[170px] opacity-100" : "w-0 opacity-0"
        }`}
      >
        <p className="text-[16px] font-bold">{user.name}</p>
        <p className="text-[12px] text-neutral-500">{user.role === "admin" ? "Admin · " : ""}{user.email}</p>
      </div>
    </div>
  )
}

export default Useritem
