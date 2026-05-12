'use client'

import { useSidebar } from "@/context/SidebarContext"
import Header from "./Header/Header"

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const { isSidebarOpen } = useSidebar()

  return (
    <main className={`min-h-screen transition-none md:transition-[margin-left] md:duration-150 ${
      isSidebarOpen ? "md:ml-[280px]" : "md:ml-[80px]"
    }`}>
      <Header />
      <div className="p-4 sm:p-6">
        {children}
      </div>
    </main>
  )
}
