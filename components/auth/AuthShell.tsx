import type { ReactNode } from "react"
import { Bot, ChartNoAxesCombined, Droplets, ScanLine, Sparkles } from "lucide-react"

const benefits = [
  { icon: ScanLine, label: "วิเคราะห์อาหารจากรูปภาพ" },
  { icon: Sparkles, label: "AI ส่วนตัวแนะนำสุขภาพ" },
  { icon: ChartNoAxesCombined, label: "ติดตามโภชนาการรายวัน" },
  { icon: Droplets, label: "ติดตามการดื่มน้ำ" },
]

export default function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-svh bg-[#f3f5f4] p-0 lg:grid lg:place-items-center lg:p-6">
      <section className="mx-auto grid min-h-svh w-full max-w-6xl overflow-hidden bg-white shadow-2xl shadow-emerald-950/5 lg:min-h-[680px] lg:grid-cols-[0.92fr_1.08fr] lg:rounded-[32px]">
        <aside className="relative overflow-hidden bg-[#2ec78f] px-6 py-7 text-white sm:px-10 lg:flex lg:flex-col lg:px-12 lg:py-10">
          <div className="absolute -bottom-24 -right-20 h-64 w-64 rounded-full bg-white/5" />
          <div className="absolute -left-24 top-1/2 h-52 w-52 rounded-full bg-white/5" />

          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-2xl font-black">ScanZapp AI</p>
              <p className="text-xs font-medium text-white/75">ผู้ช่วยสุขภาพส่วนตัวของคุณ</p>
            </div>
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15">
              <Bot className="h-6 w-6" />
            </span>
          </div>

          <div className="relative mt-8 hidden space-y-3 lg:my-auto lg:block">
            <div className="mb-7 max-w-sm">
              <h2 className="text-3xl font-black leading-tight">เริ่มต้นสุขภาพที่ดี<br />ในแบบของคุณ</h2>
              <p className="mt-3 text-sm leading-6 text-white/75">สแกน ติดตาม และรับคำแนะนำที่ปรับให้เหมาะกับเป้าหมายของคุณ</p>
            </div>
            {benefits.map((item) => {
              const Icon = item.icon
              return (
                <div key={item.label} className="flex items-center gap-3 rounded-xl bg-white/15 px-4 py-3 text-sm font-semibold backdrop-blur-sm">
                  <Icon className="h-4 w-4 text-white/90" />
                  {item.label}
                </div>
              )
            })}
          </div>

          <p className="relative mt-5 hidden text-xs text-white/60 lg:block">ดูแลทุกมื้อ เข้าใจทุกเป้าหมาย</p>
        </aside>

        <div className="flex min-h-0 items-center justify-center px-5 py-8 sm:px-10 lg:px-14 lg:py-10">
          {children}
        </div>
      </section>
    </main>
  )
}
