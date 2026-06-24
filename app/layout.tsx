import type { Metadata } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";
import LayoutClient from "./layout-client";
import Header from "@/components/ui/Header/Header";

const notoSansThai = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  variable: "--font-noto-sans-thai",
});

export const metadata: Metadata = {
  title: "ScanZapp AI",
  description: "สแกนอาหารและติดตามโภชนาการด้วย ScanZapp AI",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" className={notoSansThai.variable}>
      <body className="font-sans antialiased bg-[#F7F7F7]">
        <LayoutClient header={<Header />}>{children}</LayoutClient>
      </body>
    </html>
  );
}
