'use client';

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { SidebarProvider } from "@/context/SidebarContext";
import { useSidebar } from "@/context/SidebarContext";
import Sidebar from "@/components/ui/Sidebar/Sidebar";

function LayoutFrame({ children, header }: { children: ReactNode; header: ReactNode }) {
  const { isSidebarOpen } = useSidebar();

  return (
    <main className={`min-h-screen transition-none md:transition-[margin-left] md:duration-150 ${
      isSidebarOpen ? "md:ml-[280px]" : "md:ml-[80px]"
    }`}>
      {header}
      <div className="p-4 sm:p-6">
        {children}
      </div>
    </main>
  );
}

export default function LayoutClient({ children, header }: { children: ReactNode; header: ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === "/sign-in" || pathname === "/sign-up";
  const isAdminPage = pathname.startsWith("/admin");

  if (isAuthPage || isAdminPage) return <>{children}</>;

  return (
    <SidebarProvider>
      <Sidebar />
      <LayoutFrame header={header}>{children}</LayoutFrame>
    </SidebarProvider>
  );
}
