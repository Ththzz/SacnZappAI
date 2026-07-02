"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

export default function LegacyMealClassifier({ enabled }: { enabled: boolean }) {
  const router = useRouter()
  const [notice, setNotice] = useState<string | null>(enabled ? "กำลังให้ AI จัดหมวดรายการอาหารเดิม…" : null)

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()

    fetch("/api/meals/classify-legacy", { method: "POST", signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("classification")
        setNotice(null)
        router.refresh()
      })
      .catch((error) => {
        if ((error as Error).name !== "AbortError") {
          setNotice("ยังจัดหมวดรายการเดิมไม่สำเร็จ ระบบจะลองใหม่เมื่อเปิดหน้านี้อีกครั้ง")
        }
      })

    return () => controller.abort()
  }, [enabled, router])

  return notice ? <p className="text-sm text-amber-600">{notice}</p> : null
}
