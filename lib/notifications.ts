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
    title: "Time to drink water!",
    text: "You haven't logged water in 2 hours",
    time: "2h ago",
    read: false,
  },
  {
    id: "protein-goal",
    icon: CheckCircleIcon,
    title: "Protein goal reached",
    text: "You hit your protein target for the day!",
    time: "5h ago",
    read: false,
  },
  {
    id: "streak",
    icon: TrophyIcon,
    title: "7-day streak",
    text: "You tracked meals for 7 days straight",
    time: "1d ago",
    read: true,
  },
  {
    id: "reminder",
    icon: BellIcon,
    title: "Reminder",
    text: "Tip: Eat protein-rich breakfast for better energy",
    time: "2d ago",
    read: true,
  },
]
