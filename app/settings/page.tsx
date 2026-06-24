import type { Metadata } from "next"
import SettingsClient from "./SettingsClient"

export const metadata: Metadata = {
  title: "การตั้งค่า | ScanZapp AI",
  description: "ตั้งค่าการใช้งาน การแจ้งเตือน และเป้าหมายสุขภาพใน ScanZapp AI",
}

export default function SettingsPage() {
  return <SettingsClient />
}
