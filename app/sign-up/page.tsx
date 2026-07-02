"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { FormEvent, useState } from "react"
import { ArrowRight, LoaderCircle, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import AuthShell from "@/components/auth/AuthShell"

type Role = "user" | "admin"

export default function SignUpPage() {
  const router = useRouter()
  const [role, setRole] = useState<Role>("user")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")
    setLoading(true)

    const form = new FormData(event.currentTarget)
    const response = await fetch("/api/auth/sign-up", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        email: form.get("email"),
        password: form.get("password"),
        role,
        adminCode: form.get("adminCode"),
      }),
    })
    const data = (await response.json().catch(() => ({}))) as { error?: string }

    setLoading(false)
    if (!response.ok) {
      setError(data.error ?? "สมัครสมาชิกไม่สำเร็จ")
      return
    }

    router.replace(role === "admin" ? "/admin" : "/onboarding")
    router.refresh()
  }

  return (
    <AuthShell>
      <section className="w-full max-w-md">
        <div className="mb-7">
          <p className="text-sm font-bold text-emerald-600">เริ่มต้นกับ ScanZapp AI</p>
          <h1 className="mt-2 text-3xl font-black text-neutral-950">สร้างบัญชี</h1>
          <p className="mt-2 text-sm leading-6 text-neutral-500">สมัครแล้วตั้งค่าโปรไฟล์และเป้าหมายสุขภาพได้ทันที</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 rounded-xl bg-neutral-100 p-1">
            {(["user", "admin"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setRole(item)}
                className={`h-10 rounded-lg text-sm font-bold transition-colors ${
                  role === item ? "bg-white text-emerald-600 shadow-sm" : "text-neutral-500"
                }`}
              >
                {item === "user" ? "ยูสเซอร์" : "แอดมิน"}
              </button>
            ))}
          </div>

          <Field label="ชื่อ" name="name" type="text" autoComplete="name" />
          <Field label="อีเมล" name="email" type="email" autoComplete="email" />
          <Field label="รหัสผ่าน" name="password" type="password" autoComplete="new-password" />
          {role === "admin" && <Field label="รหัสสมัครแอดมิน" name="adminCode" type="password" autoComplete="off" optional />}

          {error && <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">{error}</div>}

          <Button className="h-12 w-full rounded-xl bg-[#2ec78f] text-white hover:bg-[#20b77f]" disabled={loading}>
            {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            สมัครสมาชิก
            {!loading && <ArrowRight className="h-4 w-4" />}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm font-medium text-neutral-500">
          มีบัญชีแล้ว?{" "}
          <Link className="font-bold text-emerald-600 hover:text-emerald-700" href="/sign-in">
            เข้าสู่ระบบ
          </Link>
        </p>
      </section>
    </AuthShell>
  )
}

function Field({
  label,
  name,
  type,
  autoComplete,
  optional = false,
}: {
  label: string
  name: string
  type: string
  autoComplete: string
  optional?: boolean
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-neutral-700">{label}</span>
      <input
        required={!optional}
        name={name}
        type={type}
        autoComplete={autoComplete}
        className="mt-2 h-12 w-full rounded-xl border border-neutral-200 bg-neutral-50/60 px-4 text-sm outline-none transition-colors focus:border-emerald-400 focus:bg-white"
      />
    </label>
  )
}
