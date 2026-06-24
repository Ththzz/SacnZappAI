import type { Metadata } from "next"
import MealHistoryClient from "./MealHistoryClient"

export const metadata: Metadata = {
  title: "ประวัติมื้ออาหาร | ScanZapp AI",
  description: "ดูมื้ออาหารที่บันทึกไว้และประวัติโภชนาการรายวันใน ScanZapp AI",
}

export default function MealHistoryPage() {
  return <MealHistoryClient />
}
