'use client'

import { Card, CardContent } from "@/components/ui/card"
import { BellIcon, BellRingIcon, CheckCircleIcon, TrophyIcon } from "lucide-react"

const notifications = [
  { icon: BellRingIcon, title: 'Time to drink water!', text: 'You haven\'t logged water in 2 hours', time: '2h ago', read: false },
  { icon: CheckCircleIcon, title: 'Protein goal reached', text: 'You hit your protein target for the day!', time: '5h ago', read: false },
  { icon: TrophyIcon, title: '7-day streak', text: 'You tracked meals for 7 days straight', time: '1d ago', read: true },
  { icon: BellIcon, title: 'Reminder', text: 'Tip: Eat protein-rich breakfast for better energy', time: '2d ago', read: true },
]

export default function NotificationsPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Notifications</h1>

      <div className="space-y-2">
        {notifications.map((n, i) => {
          const Icon = n.icon
          return (
            <Card key={i} className={!n.read ? 'border-l-4 border-l-[#2EC78F]' : ''}>
              <CardContent className="p-4 flex items-start gap-3">
                <div className={`p-2 rounded-full shrink-0 ${n.read ? 'bg-neutral-100 text-neutral-400' : 'bg-[#2EC78F]/10 text-[#2EC78F]'}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{n.title}</p>
                  <p className="text-sm text-neutral-500">{n.text}</p>
                  <p className="text-xs text-neutral-400 mt-1">{n.time}</p>
                </div>
                {!n.read && <div className="w-2 h-2 rounded-full bg-[#2EC78F] mt-2" />}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
