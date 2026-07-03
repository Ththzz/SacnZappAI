"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { FormEvent, useRef, useState } from "react"
import { ArrowRight, LoaderCircle, LockKeyhole, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import AuthShell from "@/components/auth/AuthShell"

function getSafeNext(value: string | null) {
  if (!value?.startsWith("/") || value.startsWith("//") || value.startsWith("/sign-in") || value.startsWith("/sign-up")) return "/"
  return value
}

export default function SignInPage() {
  const searchParams = useSearchParams()
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const submittingRef = useRef(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submittingRef.current) return

    submittingRef.current = true
    setError("")
    setLoading(true)
    let navigationStarted = false

    try {
      const form = new FormData(event.currentTarget)
      const response = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
        }),
      })
      const data = (await response.json().catch(() => ({}))) as { error?: string; user?: { role?: "user" | "admin" } }

      if (!response.ok) {
        setError(data.error ?? "เข้าสู่ระบบไม่สำเร็จ")
        return
      }

      const destination = getSafeNext(searchParams.get("next"))
      navigationStarted = true
      window.location.replace(
        data.user?.role === "admin"
          ? "/admin"
          : `/onboarding?next=${encodeURIComponent(destination)}`,
      )
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ กรุณาลองใหม่")
    } finally {
      // Keep the form locked while a successful full-page navigation is in progress.
      if (!navigationStarted) {
        submittingRef.current = false
        setLoading(false)
      }
    }
  }

  return (
    <AuthShell>
      <section className="w-full max-w-md">
        <div className="mb-8">
          <p className="text-sm font-bold text-emerald-600">ยินดีต้อนรับกลับ</p>
          <h1 className="mt-2 text-3xl font-black text-neutral-950">เข้าสู่ระบบ</h1>
          <p className="mt-2 text-sm leading-6 text-neutral-500">ติดตามโภชนาการและสุขภาพของคุณต่อจากที่ค้างไว้</p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit} aria-busy={loading}>
          <Field label="อีเมล" name="email" type="email" autoComplete="email" icon={<Mail className="h-4 w-4" />} />
          <Field label="รหัสผ่าน" name="password" type="password" autoComplete="current-password" icon={<LockKeyhole className="h-4 w-4" />} />

          {error && <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">{error}</div>}

          <Button type="submit" className="h-12 w-full rounded-xl bg-[#2ec78f] text-white hover:bg-[#20b77f]" disabled={loading}>
            {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <>เข้าสู่ระบบ <ArrowRight className="h-4 w-4" /></>}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm font-medium text-neutral-500">
          ยังไม่มีบัญชี?{" "}
          <Link className="font-bold text-emerald-600 hover:text-emerald-700" href="/sign-up">
            สมัครสมาชิก
          </Link>
        </p>
      </section>
    </AuthShell>
  )
}

function Field({ label, name, type, autoComplete, icon }: { label: string; name: string; type: string; autoComplete: string; icon: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-neutral-700">{label}</span>
      <div className="relative mt-2">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-neutral-400">{icon}</span>
        <input
          required
          name={name}
          type={type}
          autoComplete={autoComplete}
          className="h-12 w-full rounded-xl border border-neutral-200 bg-neutral-50/60 pl-10 pr-4 text-sm outline-none transition-colors focus:border-emerald-400 focus:bg-white"
        />
      </div>
    </label>
  )
}
