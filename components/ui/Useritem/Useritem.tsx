"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, LogOut, ShieldCheck, UserRound } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

export type UserSummary = {
  name: string
  email: string
  role?: "user" | "admin"
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "TH"
}

const Useritem = ({ isSidebarOpen, initialUser }: { isSidebarOpen: boolean; initialUser?: UserSummary | null }) => {
  const router = useRouter()
  const user = initialUser ?? { name: "ผู้ใช้", email: "" }
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const handleSignOut = async () => {
    setSigningOut(true)
    await fetch("/api/auth/sign-out", { method: "POST" }).catch(() => undefined)
    setSigningOut(false)
    setConfirmOpen(false)
    router.replace("/sign-in")
    router.refresh()
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={`flex items-center overflow-hidden rounded-[8px] border bg-white text-left transition-none hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-emerald-400 md:transition-[width,padding] md:duration-150 ${
              isSidebarOpen
                ? "w-full gap-2 p-2"
                : "h-12 w-12 gap-0 p-1"
            }`}
            aria-label="เปิดเมนูบัญชีผู้ใช้"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white font-bold">
              {getInitials(user.name)}
            </div>

            <div
              className={`min-w-0 overflow-hidden whitespace-nowrap transition-none md:transition-[opacity,width] md:duration-150 ${
                isSidebarOpen ? "w-[145px] opacity-100" : "w-0 opacity-0"
              }`}
            >
              <p className="truncate text-[16px] font-bold">{user.name}</p>
              <p className="truncate text-[12px] text-neutral-500">{user.role === "admin" ? "Admin · " : ""}{user.email || "ยังไม่มีอีเมล"}</p>
            </div>

            <ChevronDown
              className={`ml-auto h-4 w-4 shrink-0 text-neutral-400 transition-none md:transition-opacity md:duration-150 ${
                isSidebarOpen ? "opacity-100" : "opacity-0"
              }`}
            />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent side="top" align="start" className="w-64 p-2">
          <DropdownMenuLabel className="px-2 py-2">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-sm font-bold text-white">
                {getInitials(user.name)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-neutral-900">{user.name}</p>
                <p className="truncate text-xs font-medium text-neutral-400">{user.email || "ยังไม่มีอีเมล"}</p>
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="gap-2 px-2 py-2 text-neutral-600" disabled>
            {user.role === "admin" ? <ShieldCheck className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
            {user.role === "admin" ? "บัญชีแอดมิน" : "บัญชียูสเซอร์"}
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            className="gap-2 px-2 py-2"
            onSelect={(event) => {
              event.preventDefault()
              setConfirmOpen(true)
            }}
          >
            <LogOut className="h-4 w-4" />
            ออกจากระบบ
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ยืนยันการออกจากระบบ</DialogTitle>
            <DialogDescription>
              ต้องการลงชื่อออกจากบัญชี {user.email || user.name} หรือไม่?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)} disabled={signingOut}>
              ยกเลิก
            </Button>
            <Button type="button" className="bg-rose-600 text-white hover:bg-rose-700" onClick={handleSignOut} disabled={signingOut}>
              <LogOut className="h-4 w-4" />
              {signingOut ? "กำลังออกจากระบบ" : "ออกจากระบบ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default Useritem
