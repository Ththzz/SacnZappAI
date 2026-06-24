import type { Metadata } from "next"
import { notifications } from "@/lib/notifications"
import { Card, CardContent } from "@/components/ui/card"

export const metadata: Metadata = {
  title: "ข้อความแจ้งเตือน | ScanZapp AI",
  description: "ดูการแจ้งเตือนโภชนาการและความคืบหน้าจาก ScanZapp AI",
}

export default function NotificationsPage() {
  const unreadCount = notifications.filter((item) => !item.read).length

  return (
    <div className="mx-auto max-w-4xl space-y-5 text-neutral-900">
      <p className="text-sm text-neutral-500">ทั้งหมด {notifications.length} รายการ, ยังไม่อ่าน {unreadCount} รายการ</p>

      <div className="space-y-3">
        {notifications.map((item) => {
          const Icon = item.icon

          return (
            <Card key={item.id} className={!item.read ? "border-l-4 border-l-[#2EC78F]" : ""}>
              <CardContent className="flex items-start gap-3 p-4">
                <div className={`rounded-full p-2 ${item.read ? "bg-neutral-100 text-neutral-400" : "bg-[#2EC78F]/10 text-[#2EC78F]"}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{item.title}</p>
                  <p className="text-sm text-neutral-500">{item.text}</p>
                  <p className="mt-1 text-xs text-neutral-400">{item.time}</p>
                </div>
                {!item.read && <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#2EC78F]" />}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
