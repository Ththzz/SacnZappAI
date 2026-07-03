import { LoaderCircle } from "lucide-react"

export default function PageDataLoading({ label = "กำลังโหลดข้อมูล..." }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="mx-auto flex min-h-[320px] w-full max-w-6xl items-center justify-center"
    >
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-white px-8 py-6 text-sm font-semibold text-neutral-500 shadow-sm ring-1 ring-black/5">
        <LoaderCircle className="h-6 w-6 animate-spin text-emerald-500" aria-hidden="true" />
        <span>{label}</span>
      </div>
    </div>
  )
}
