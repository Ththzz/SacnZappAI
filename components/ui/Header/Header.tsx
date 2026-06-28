"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { STORAGE_KEYS } from "@/lib/user-data"
import NotificationBell from "./NotificationBell"

const pageTitles: Record<string, string> = {
  "/": "แดชบอร์ด",
  "/scan": "สแกนอาหาร",
  "/meal-history": "ประวัติมื้ออาหาร",
  "/health-insight": "วิเคราะห์สุขภาพ",
  "/water-tracker": "การดื่มน้ำ",
  "/profile": "โปรไฟล์และเป้าหมาย",
  "/notifications": "ข้อความแจ้งเตือน",
  "/settings": "การตั้งค่า",
  "/admin": "แอดมิน",
}

function readProfileName() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.profile)
    if (!raw) return "ผู้ใช้"

    const stored = JSON.parse(raw) as { form?: { name?: unknown } }
    const name = typeof stored.form?.name === "string" ? stored.form.name.trim() : ""
    return name ? name.split(/\s+/)[0] : "ผู้ใช้"
  } catch {
    return "ผู้ใช้"
  }
}

const Header = () => {
  const pathname = usePathname()
  const [firstName, setFirstName] = useState("ผู้ใช้")
  const [dateLabel, setDateLabel] = useState("")
  const pageTitle = pageTitles[pathname] ?? "ScanZapp AI"

  useEffect(() => {
    setFirstName(readProfileName())
    setDateLabel(new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "long", year: "numeric" }).format(new Date()))
    fetch("/api/auth/me")
      .then((response) => response.json())
      .then((data: { user?: { name?: string } | null }) => {
        const name = data.user?.name?.trim()
        if (name) setFirstName(name.split(/\s+/)[0])
      })
      .catch(() => undefined)
  }, [])

  return (
   <div className="sticky top-0 z-30 flex h-16 w-full items-center justify-between gap-3 border-b bg-white py-3 pl-20 pr-4 sm:pr-6 md:px-6">
      <div className="flex min-w-0 flex-col">
        <div className="truncate text-xl font-semibold sm:text-2xl">
          {pageTitle}
        </div>
        <div className="truncate text-[13px] text-neutral-400 sm:text-[14px]">
          {dateLabel ? `สวัสดี, ${firstName} · วันที่ ${dateLabel}` : `สวัสดี, ${firstName}`}
        </div>
      </div>

      <NotificationBell />
    </div>
  )
}

export default Header
