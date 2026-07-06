import type { Metadata } from "next"
import ProfileClient from "./ProfileClient"

export const metadata: Metadata = {
  title: "โปรไฟล์และเป้าหมาย | ScanZapp AI",
  description: "จัดการโปรไฟล์และเป้าหมายโภชนาการใน ScanZapp AI",
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  return <ProfileClient initialTab={tab === "goals" ? "goals" : "profile"} />
}
