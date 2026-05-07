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
  Menu,
} from "lucide-react"
import { useSidebar } from "@/context/SidebarContext"

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
  const { isSidebarOpen, setIsSidebarOpen } = useSidebar()

  return (
    <div className={`fixed flex flex-col min-h-screen border-r z-40 bg-white transition-all duration-300 ${
      isSidebarOpen ? "w-[280px]" : "w-[80px]"
    }`}>
      {/* Header */}
      <div className="h-16 bg-[#2EC78F] flex items-center px-4 font-semibold text-lg text-white">
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 rounded-full hover:bg-[#05b474] transition-colors max-w-fit cursor-pointer shrink-0"
          aria-label={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          <Menu
            size={24}
            className={`transition-colors duration-300 ${
              !isSidebarOpen ? 'text-green-200' : 'text-white'
            }`}
          />
        </button>

        <span className={`transition-all duration-300 whitespace-nowrap overflow-hidden ${
          isSidebarOpen ? "opacity-100 w-auto ml-2" : "opacity-0 w-0 ml-0"
        }`}>
          🌿 ScanZapp AI
        </span>
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-4 justify-between bg-white overflow-hidden">
        {/* Menu */}
        <div className="flex flex-col gap-2">
          {menuList.map((item) => {
            const Icon = item.icon
            const active = pathname === item.link

            return (
              <Link
                key={item.link}
                href={item.link}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-300 ${
                  active ? 'bg-[#2EC78F]/10 text-[#2EC78F]' : 'hover:bg-gray-100'
                }`}
              >
                {/* Icon อยู่นิ่งเสมอ ไม่ขยับ */}
                <Icon className="h-4 w-4 shrink-0" />

                {/* Text หดด้วย w-0 + opacity แทนการเปลี่ยน justify */}
                <span className={`transition-all duration-300 whitespace-nowrap overflow-hidden ${
                  isSidebarOpen ? "opacity-100 w-auto" : "opacity-0 w-0"
                }`}>
                  {item.text}
                </span>
              </Link>
            )
          })}
        </div>

        {/* Bottom */}
        <div className="space-y-3 pt-4 border-t">
          <Useritem isSidebarOpen={isSidebarOpen} />
        </div>
      </div>
    </div>
  )
}

export default Sidebar