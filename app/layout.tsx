import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import "./globals.css";
import LayoutClient from "./layout-client";
import Header from "@/components/ui/Header/Header";
import ChunkLoadRecovery from "@/components/ChunkLoadRecovery";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "ScanZapp AI",
  description: "สแกนอาหารและติดตามโภชนาการด้วย ScanZapp AI",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = (await headers()).get("x-scanzapp-pathname") || "/";
  const user = await getCurrentUser();
  const isPublicPage = pathname === "/sign-in" || pathname === "/sign-up";

  if (user && isPublicPage) {
    redirect("/");
  }

  if (!user && !isPublicPage) {
    redirect(`/sign-in?next=${encodeURIComponent(pathname)}`);
  }

  return (
    <html lang="th">
      <body className="font-sans antialiased bg-[#F7F7F7]">
        <ChunkLoadRecovery />
        <LayoutClient header={<Header user={user} />} user={user}>{children}</LayoutClient>
      </body>
    </html>
  );
}
