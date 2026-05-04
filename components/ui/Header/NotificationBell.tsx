'use client'

import React from "react"
import { Bell } from "lucide-react"
import { Button } from "../button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface Notification {
    text: string
    date: string
    read: boolean
}

const notifications: Notification[] = [
    {
        text: "This is a notification",
        date: "02-01-2015",
        read: true,
    },
    {
        text: "This is another notification",
        date: "02-01-2015",
        read: false,
    },
]

const NotificationBellInner = () => {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="pointer-events-auto focus-visible:ring-0! focus-visible:border-border!">
                    <Bell className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 p-2 relative z-50 pointer-events-auto">
                {notifications.map((item) => (
                    <DropdownMenuItem
                        key={item.text + item.date}
                        className="p-1 cursor-pointer hover:bg-neutral-50 transition flex items-start gap-2 outline-none rounded-md bg-transparent!"
                        style={{ background: 'transparent !important' }}
                    >
                        <div className={`h-3 w-3 rounded-full my-1 ${!item.read ? 'bg-green-500' : 'bg-neutral-200'}`}></div>
                        <div>
                            <p>{item.text}</p>
                            <p className="text-xs text-neutral-500">{item.date}</p>
                        </div>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

export default React.memo(NotificationBellInner)
