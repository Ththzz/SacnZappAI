'use client'

import NotificationBell from "./NotificationBell"

const Header = () => {
  return (
   <div className="sticky top-0 z-30 flex h-16 w-full items-center justify-between gap-3 border-b bg-white py-3 pl-20 pr-4 sm:pr-6 md:px-6">
      <div className="flex min-w-0 flex-col">
        <div className="truncate text-xl font-semibold sm:text-2xl">
          สวัสดี, Thanapol 👋
        </div>
        <div className="truncate text-[13px] text-neutral-400 sm:text-[14px]">
          วันที่ 20 เมษายน 2026
        </div>
      </div>

      <NotificationBell />
    </div>
  )
}

export default Header
