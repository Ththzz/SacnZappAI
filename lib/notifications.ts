import type { LucideIcon } from "lucide-react"

export type NotificationItem = {
  id: string
  icon: LucideIcon
  title: string
  text: string
  time: string
  read: boolean
}

export const notifications: NotificationItem[] = []
