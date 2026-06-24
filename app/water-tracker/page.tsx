import type { Metadata } from 'next'
import WaterTrackerClient from './WaterTrackerClient'

export const metadata: Metadata = {
  title: 'การดื่มน้ำ | ScanZapp AI',
  description: 'บันทึกน้ำดื่มรายวันและติดตามเป้าหมายการดื่มน้ำใน ScanZapp AI',
}

export default function WaterTrackerPage() {
  return <WaterTrackerClient />
}
