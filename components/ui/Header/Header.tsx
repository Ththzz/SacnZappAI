"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
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

const Header = ({ user }: { user?: { name?: string } | null }) => {
  const pathname = usePathname()
  const [dateLabel, setDateLabel] = useState("")
  const pageTitle = pageTitles[pathname] ?? "ScanZapp AI"
  const firstName = user?.name?.trim().split(/\s+/)[0] || "ผู้ใช้"

  useEffect(() => {
    setDateLabel(new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "long", year: "numeric" }).format(new Date()))
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
