import type { Metadata } from "next"
import HealthInsightClient from "./HealthInsightClient"

export const metadata: Metadata = {
  title: "วิเคราะห์สุขภาพ | ScanZapp AI",
  description: "ติดตามแนวโน้มโภชนาการและข้อมูลสุขภาพจากประวัติมื้ออาหารใน ScanZapp AI",
}

export default function HealthInsightPage() {
  return <HealthInsightClient />
}
