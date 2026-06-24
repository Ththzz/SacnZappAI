import type { Metadata } from "next"
import ProfileClient from "./ProfileClient"

export const metadata: Metadata = {
  title: "โปรไฟล์และเป้าหมาย | ScanZapp AI",
  description: "จัดการโปรไฟล์และเป้าหมายโภชนาการใน ScanZapp AI",
}

export default function ProfilePage() {
  return <ProfileClient />
}
