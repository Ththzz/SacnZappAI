'use client'

const Useritem = ({ isSidebarOpen }: { isSidebarOpen: boolean }) => {
  return (
    <div
      className={`flex items-center overflow-hidden border rounded-[8px] transition-none md:transition-[width,padding] md:duration-150 ${
        isSidebarOpen
          ? "w-full gap-2 p-2"
          : "h-12 w-12 gap-0 p-1"
      }`}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white font-bold">
        TH
      </div>

      <div
        className={`overflow-hidden whitespace-nowrap transition-none md:transition-[opacity,width] md:duration-150 ${
          isSidebarOpen ? "w-[170px] opacity-100" : "w-0 opacity-0"
        }`}
      >
        <p className="text-[16px] font-bold">Thanapol Thiwong</p>
        <p className="text-[12px] text-neutral-500">aomsinthiwong@gmail.com</p>
      </div>
    </div>
  )
}

export default Useritem
