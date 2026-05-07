'use client'

import { useSidebar } from "@/context/SidebarContext"
import Header from "./Header/Header"

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const { isSidebarOpen } = useSidebar()

  return (
    <main className={`min-h-screen transition-all duration-300 ${
      isSidebarOpen ? "ml-[280px]" : "ml-[80px]"
    }`}>
      <Header />
      <div className="p-6">
        {children}
      </div>
    </main>
  )
}