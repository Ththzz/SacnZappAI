'use client'

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import Useritem, { type UserSummary } from "../Useritem/Useritem"
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
  ShieldCheck,
  MessageCircleMore,
} from "lucide-react"
import { useSidebar } from "@/context/SidebarContext"

const menuList = [
  { link: '/', text: 'แดชบอร์ด', icon: LayoutDashboard },
  { link: '/chat', text: 'AI Health Chat', icon: MessageCircleMore },
  { link: '/scan', text: 'สแกนอาหาร', icon: CameraIcon },
  { link: '/meal-history', text: 'ประวัติมื้ออาหาร', icon: History },
  { link: '/health-insight', text: 'วิเคราะห์สุขภาพ', icon: Lightbulb },
  { link: '/water-tracker', text: 'การดื่มน้ำ', icon: Droplets },
  { link: '/profile', text: 'โปรไฟล์และเป้าหมาย', icon: User },
  { link: '/notifications', text: 'ข้อความแจ้งเตือน', icon: Bell },
  { link: '/settings', text: 'การตั้งค่า', icon: Settings },
]

const Sidebar = ({ user }: { user?: UserSummary | null }) => {
  const pathname = usePathname()
  const { isSidebarOpen, setIsSidebarOpen } = useSidebar()
  const isAdmin = user?.role === "admin"
  const visibleMenuList = isAdmin ? [...menuList, { link: '/admin', text: 'แอดมิน', icon: ShieldCheck }] : menuList

  return (
    <div className={`fixed left-0 top-0 z-40 flex flex-col transition-none md:min-h-screen md:border-r md:bg-white md:transition-[width] md:duration-150 ${
      isSidebarOpen
        ? "min-h-screen w-[280px] border-r bg-white"
        : "h-16 w-16 overflow-hidden md:h-auto md:w-[80px] md:overflow-visible"
    }`}>
      <div className={`h-16 flex items-center font-semibold text-lg text-white md:bg-[#2EC78F] ${
        isSidebarOpen ? "bg-[#2EC78F] px-4" : "justify-center bg-transparent px-0 md:justify-start md:px-4"
      }`}>
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className={`max-w-fit shrink-0 cursor-pointer rounded-full p-2 transition-none hover:bg-[#2EC78F]/10 md:transition-colors md:duration-150 md:hover:bg-[#05b474] ${
            isSidebarOpen ? "" : "md:bg-transparent"
          }`}
          aria-label={isSidebarOpen ? 'ย่อเมนู' : 'ขยายเมนู'}
        >
          <Menu
            size={24}
            className={`transition-none md:transition-colors md:duration-150 ${
              !isSidebarOpen ? 'text-[#2EC78F] md:text-green-200' : 'text-white'
            }`}
          />
        </button>

        <span className={`flex items-center gap-2 whitespace-nowrap overflow-hidden transition-none md:transition-[opacity,width,margin] md:duration-150 ${
          isSidebarOpen ? "opacity-100 w-auto ml-2" : "opacity-0 w-0 ml-0"
        }`}>
          <Image
            src="/scanzapp-logo-transparent.png"
            alt=""
            width={36}
            height={36}
            className="h-9 w-9 shrink-0 object-contain"
          />
          ScanZapp AI
        </span>
      </div>

      <div className={`flex-1 flex-col justify-between bg-white p-4 overflow-hidden ${
        isSidebarOpen ? "flex" : "hidden md:flex"
      }`}>
        <div className="flex flex-col gap-2">
          {visibleMenuList.map((item) => {
            const Icon = item.icon
            const active = pathname === item.link

            return (
              <Link
                key={item.link}
                href={item.link}
                prefetch={item.link === '/' ? false : undefined}
                onClick={(event) => {
                  if (item.link === '/' && pathname !== '/') {
                    event.preventDefault()
                    window.location.assign('/')
                  }
                }}
                aria-current={pathname === item.link ? 'page' : undefined}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-100 ${
                  active ? 'bg-[#2EC78F]/10 text-[#2EC78F]' : 'hover:bg-gray-100'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className={`whitespace-nowrap overflow-hidden transition-none md:transition-[opacity,width] md:duration-150 ${
                  isSidebarOpen ? "opacity-100 w-auto" : "opacity-0 w-0"
                }`}>
                  {item.text}
                </span>
              </Link>
            )
          })}
        </div>

        <div className="space-y-3 pt-4 border-t">
          <Useritem isSidebarOpen={isSidebarOpen} initialUser={user} />
        </div>
      </div>
    </div>
  )
}

export default Sidebar
