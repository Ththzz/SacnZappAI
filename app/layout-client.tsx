'use client';

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { SidebarProvider } from "@/context/SidebarContext";
import { useSidebar } from "@/context/SidebarContext";
import Sidebar from "@/components/ui/Sidebar/Sidebar";
import type { UserSummary } from "@/components/ui/Useritem/Useritem";

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

function MobileSidebarBackdrop() {
  const { isSidebarOpen, setIsSidebarOpen } = useSidebar();

  if (!isSidebarOpen) return null;

  return (
    <button
      type="button"
      aria-label="ปิดเมนูด้านข้าง"
      onClick={() => setIsSidebarOpen(false)}
      className="fixed inset-0 z-30 bg-black/35 md:hidden"
    />
  );
}

export default function LayoutClient({
  children,
  header,
  user,
}: {
  children: ReactNode;
  header: ReactNode;
  user?: UserSummary | null;
}) {
  const pathname = usePathname();
  const isAuthPage = pathname === "/sign-in" || pathname === "/sign-up";
  const isAdminPage = pathname.startsWith("/admin");
  const isChatPage = pathname === "/chat";
  const isOnboardingPage = pathname === "/onboarding";

  if (isAuthPage || isAdminPage || isChatPage || isOnboardingPage) return <>{children}</>;

  return (
    <SidebarProvider>
      <MobileSidebarBackdrop />
      <Sidebar user={user} />
      <LayoutFrame header={header}>{children}</LayoutFrame>
    </SidebarProvider>
  );
}
