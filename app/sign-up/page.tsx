"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { FormEvent, useState } from "react"
import { LoaderCircle, Sprout, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"

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

    router.replace(role === "admin" ? "/admin" : "/")
    router.refresh()
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#F7F7F7] p-4">
      <section className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <div className="mb-7 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-white">
            <Sprout className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-neutral-950">สมัครสมาชิก</h1>
            <p className="text-sm font-medium text-neutral-400">เลือกได้ทั้งบัญชียูสเซอร์และแอดมิน</p>
          </div>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 rounded-full bg-neutral-100 p-1">
            {(["user", "admin"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setRole(item)}
                className={`h-10 rounded-full text-sm font-bold transition-colors ${
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

          {error && <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">{error}</div>}

          <Button className="h-12 w-full rounded-full bg-emerald-600 text-white hover:bg-emerald-700" disabled={loading}>
            {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            สมัครสมาชิก
          </Button>
        </form>

        <p className="mt-6 text-center text-sm font-medium text-neutral-500">
          มีบัญชีแล้ว?{" "}
          <Link className="font-bold text-emerald-600 hover:text-emerald-700" href="/sign-in">
            เข้าสู่ระบบ
          </Link>
        </p>
      </section>
    </main>
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
        className="mt-2 h-12 w-full rounded-2xl border border-neutral-200 bg-white px-4 text-sm outline-none transition-colors focus:border-emerald-400"
      />
    </label>
  )
}
