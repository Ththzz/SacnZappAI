'use client'
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

interface SidebarContextValue {
  isSidebarOpen: boolean
  setIsSidebarOpen: (open: boolean) => void
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

export const SidebarProvider = ({ children }: { children: ReactNode }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const value = useMemo(() => ({ isSidebarOpen, setIsSidebarOpen }), [isSidebarOpen])

  return (
    <SidebarContext.Provider value={value}>
      {children}
    </SidebarContext.Provider>
  )
}

export const useSidebar = (): SidebarContextValue => {
  const ctx = useContext(SidebarContext)
  if (!ctx) throw new Error('useSidebar must be used within SidebarProvider')
  return ctx
}
