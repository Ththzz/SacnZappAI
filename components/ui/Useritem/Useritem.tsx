'use client'

const Useritem = ({ isSidebarOpen }: { isSidebarOpen: boolean }) => {
  return (
    <div className="flex items-center gap-2 border rounded-[8px] p-2 transition-all duration-300">
      {/* Avatar อยู่นิ่งซ้ายเสมอ */}
      <div className="rounded-full min-h-10 min-w-10 bg-emerald-500 text-white font-bold flex items-center justify-center shrink-0">
        TH
      </div>

      {/* Text หดด้วย w-0 */}
      <div className={`transition-all duration-300 whitespace-nowrap overflow-hidden ${
        isSidebarOpen ? "opacity-100 w-auto" : "opacity-0 w-0"
      }`}>
        <p className="text-[16px] font-bold">Thanapol Thiwong</p>
        <p className="text-[12px] text-neutral-500">aomsinthiwong@gmail.com</p>
      </div>
    </div>
  )
}

export default Useritem