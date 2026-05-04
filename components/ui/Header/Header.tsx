'use client'

import NotificationBell from "./NotificationBell"

const Header = () => {
    return (
        <div className="flex items-center justify-between border-b px-6 py-3 h-18.75 bg-white">
            <div className="flex flex-col">
                <div className="font-semibold text-2xl">
                    สวัสดี, Thanapol 👋
                </div>
                <div className="text-[14px] text-neutral-400">วันที่ 20 เมษายน 2026</div>
            </div>
            <NotificationBell />
        </div>
    )
}
export default Header
