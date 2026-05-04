'use client'

import Link from "next/link"
import { usePathname } from "next/navigation"
import Useritem from "../Useritem/Useritem"
import {
  LayoutDashboard,
  History,
  Lightbulb,
  Droplets,
  User,
  Bell,
  Settings,
  CameraIcon,
} from "lucide-react"

const menuList = [
  { link: '/', text: 'Dashboard', icon: LayoutDashboard },
  { link: '/scan', text: 'Scan Food', icon: CameraIcon },
  { link: '/meal-history', text: 'Meal History', icon: History },
  { link: '/health-insight', text: 'Health Insight', icon: Lightbulb },
  { link: '/water-tracker', text: 'Water Tracker', icon: Droplets },
  { link: '/profile', text: 'Profile & Goals', icon: User },
  { link: '/notifications', text: 'Notifications', icon: Bell },
  { link: '/settings', text: 'Settings', icon: Settings },
]

const Sidebar = () => {
  const pathname = usePathname()

  return (
    <div className="fixed flex flex-col w-75 min-h-screen border-r">
      {/* Header */}
      <div className="h-16 bg-[#2EC78F] flex items-center px-4 font-semibold text-lg text-white">
        🌿 ScanZapp AI
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-4 justify-between bg-white">
        {/* Menu */}
        <div className="flex flex-col gap-2">
          {menuList.map((item) => {
            const Icon = item.icon
            const active = pathname === item.link
            return (
              <Link
                key={item.link}
                href={item.link}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? 'bg-[#2EC78F]/10 text-[#2EC78F]'
                    : 'hover:bg-gray-100'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.text}
              </Link>
            )
          })}
        </div>

        {/* Bottom */}
        <div className="space-y-3 pt-4 border-t">
          <Useritem />
        </div>
      </div>
    </div>
  )
}

export default Sidebar
