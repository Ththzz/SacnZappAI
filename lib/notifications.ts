import { BellIcon, BellRingIcon, CheckCircleIcon, TrophyIcon, type LucideIcon } from "lucide-react"

export type NotificationItem = {
  id: string
  icon: LucideIcon
  title: string
  text: string
  time: string
  read: boolean
}

export const notifications: NotificationItem[] = [
  {
    id: "water-reminder",
    icon: BellRingIcon,
    title: "ถึงเวลาดื่มน้ำแล้ว",
    text: "ยังไม่มีบันทึกน้ำดื่มใน 2 ชั่วโมงที่ผ่านมา",
    time: "2 ชั่วโมงก่อน",
    read: false,
  },
  {
    id: "protein-goal",
    icon: CheckCircleIcon,
    title: "โปรตีนถึงเป้าหมายแล้ว",
    text: "วันนี้คุณได้รับโปรตีนครบตามเป้าหมาย",
    time: "5 ชั่วโมงก่อน",
    read: false,
  },
  {
    id: "streak",
    icon: TrophyIcon,
    title: "บันทึกต่อเนื่อง 7 วัน",
    text: "คุณบันทึกมื้ออาหารครบ 7 วันติดต่อกัน",
    time: "1 วันก่อน",
    read: true,
  },
  {
    id: "reminder",
    icon: BellIcon,
    title: "คำแนะนำ",
    text: "มื้อเช้าที่มีโปรตีนช่วยให้มีพลังงานดีขึ้น",
    time: "2 วันก่อน",
    read: true,
  },
]
