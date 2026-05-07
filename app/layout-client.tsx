'use client';

import { SidebarProvider } from "@/context/SidebarContext";
import Sidebar from "@/components/ui/Sidebar/Sidebar";
import LayoutWrapper from "@/components/ui/LayoutWrapper";

export default function LayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <Sidebar />
      <LayoutWrapper>{children}</LayoutWrapper>
    </SidebarProvider>
  );
}
