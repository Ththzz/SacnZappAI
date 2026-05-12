'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Droplet, Droplets, Minus, Plus, Target, Trash2, Waves } from 'lucide-react'
import { readWaterLogs, writeWaterLogs } from '@/lib/user-data'

const drinkOptions = [150, 250, 350, 500]
const targetMl = 2000

const initialLogs = [
  { time: '07:00', amount: 250 },
  { time: '09:30', amount: 350 },
  { time: '11:00', amount: 150 },
  { time: '13:00', amount: 250 },
  { time: '15:30', amount: 500 },
]

const weekData = [
  { day: 'จ', cups: 6 },
  { day: 'อ', cups: 8 },
  { day: 'พ', cups: 7 },
  { day: 'พฤ', cups: 5 },
  { day: 'ศ', cups: 6 },
  { day: 'ส', cups: 7 },
  { day: 'อา', cups: 5 },
]

const chartMaxCups = 10
const chartHeight = 130

export default function WaterTrackerClient() {
  const [logs, setLogs] = useState(initialLogs)
  const [selectedAmount, setSelectedAmount] = useState(250)

  useEffect(() => {
    const stored = readWaterLogs()
    if (stored.length > 0) {
      setLogs(stored)
    }
  }, [])

  useEffect(() => {
    writeWaterLogs(logs)
  }, [logs])

  const totalMl = logs.reduce((sum, item) => sum + item.amount, 0)
  const cups = Math.round(totalMl / 250)
  const targetCups = Math.round(targetMl / 250)
  const progress = Math.min(totalMl / targetMl, 1)
  const waterLevel = 34 + progress * 45
  const remainingCups = Math.max(targetCups - cups, 0)
  const targetLineBottom = (targetCups / chartMaxCups) * chartHeight

  const handleAddWater = () => {
    const nextTime = new Date().toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })

    setLogs((current) => [
      ...current,
      {
        time: nextTime,
        amount: selectedAmount,
      },
    ])
  }

  const handleSubtractWater = () => {
    setLogs((current) => {
      const remainingAmount = selectedAmount
      let amountToRemove = remainingAmount
      const nextLogs = [...current]

      while (amountToRemove > 0 && nextLogs.length > 0) {
        const lastIndex = nextLogs.length - 1
        const lastEntry = nextLogs[lastIndex]

        if (lastEntry.amount <= amountToRemove) {
          amountToRemove -= lastEntry.amount
          nextLogs.pop()
        } else {
          nextLogs[lastIndex] = {
            ...lastEntry,
            amount: lastEntry.amount - amountToRemove,
          }
          amountToRemove = 0
        }
      }

      return nextLogs
    })
  }

  const handleRemoveLog = (indexToRemove: number) => {
    setLogs((current) => current.filter((_, index) => index !== indexToRemove))
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 text-neutral-900">
      <header className="flex flex-col gap-1">
        <p className="text-sm font-medium text-neutral-400">Water Tracker</p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-normal">การดื่มน้ำ</h1>
            <p className="text-sm text-neutral-500">วันที่ 11 พ.ค. 2026</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-600">
            <Droplets className="h-4 w-4" />
            ScanZapp AI
          </div>
        </div>
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(320px,0.9fr)_minmax(420px,1.25fr)]">
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <div className="mx-auto flex max-w-[360px] flex-col items-stretch">
            <div className="relative h-64 overflow-hidden rounded-2xl bg-sky-100">
              <div
                className="absolute inset-x-0 bottom-0 bg-sky-300 transition-all duration-300"
                style={{ height: `${waterLevel}%` }}
              />
              <div
                className="absolute inset-x-0 border-t-4 border-sky-500 transition-all duration-300"
                style={{ top: `${100 - waterLevel}%` }}
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.35),rgba(255,255,255,0)_42%)]" />
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <div className="flex items-end gap-2">
                  <span className="text-7xl font-extrabold leading-none text-blue-500">{cups}</span>
                  <span className="mb-3 text-sm font-semibold text-blue-400">/ {targetCups} แก้ว</span>
                </div>
                <Droplet className="mt-5 h-8 w-8 fill-sky-100 text-sky-500" />
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <h2 className="text-sm font-bold">เพิ่มน้ำดื่ม</h2>
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {drinkOptions.map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => setSelectedAmount(amount)}
                      className={`h-9 rounded-full border text-xs font-semibold transition-colors ${
                        selectedAmount === amount
                          ? 'border-blue-500 bg-blue-500 text-white'
                          : 'border-neutral-200 bg-white text-neutral-600 hover:border-blue-200 hover:bg-blue-50'
                      }`}
                    >
                      {amount}ml
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  onClick={handleAddWater}
                  className="h-11 rounded-full bg-blue-500 text-sm font-bold text-white hover:bg-blue-600"
                >
                  <Plus className="h-4 w-4" />
                  เพิ่ม {selectedAmount}ml
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSubtractWater}
                  disabled={totalMl === 0}
                  className="h-11 rounded-full border-blue-100 bg-white text-sm font-bold text-blue-500 hover:bg-blue-50"
                >
                  <Minus className="h-4 w-4" />
                  ลด {selectedAmount}ml
                </Button>
              </div>

              <div>
                <h2 className="text-sm font-bold">บันทึกวันนี้</h2>
                <div className="mt-3 space-y-2">
                  {logs.map((entry, index) => (
                    <div key={`${entry.time}-${index}`} className="grid grid-cols-[20px_1fr_auto_28px] items-center gap-2 text-xs">
                      <Droplet className="h-3.5 w-3.5 fill-blue-100 text-blue-500" />
                      <span className="font-medium text-neutral-500">{entry.time}</span>
                      <span className="font-bold text-blue-500">{entry.amount} ml</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveLog(index)}
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-50 text-rose-300 transition-colors hover:bg-rose-100 hover:text-rose-500"
                        aria-label={`ลบรายการ ${entry.amount} ml เวลา ${entry.time}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <h2 className="text-sm font-bold">สถิติการดื่มน้ำ</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <StatCard label="เฉลี่ย 7 วัน" value="6.2 แก้ว" valueClassName="text-blue-500" />
              <StatCard label="ดีที่สุด" value="8 แก้ว" valueClassName="text-emerald-500" />
              <StatCard label="วันนี้" value={`${cups} แก้ว`} valueClassName="text-orange-500" />
              <StatCard label="เป้าหมาย" value={`${targetCups} แก้ว`} valueClassName="text-neutral-700" />
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold">แนวโน้มใน 7 วัน</h2>
              <span className="text-xs font-semibold text-orange-400">เป้าหมาย {targetCups} แก้ว</span>
            </div>
            <div className="relative mt-5">
              <div className="relative h-[130px]">
                <div
                  className="pointer-events-none absolute inset-x-0 z-0 border-t border-orange-200"
                  style={{ bottom: `${targetLineBottom}px` }}
                />
                <div className="relative z-10 flex h-full items-end justify-between gap-3">
                  {weekData.map((item) => {
                    const isToday = item.day === 'อ'
                    return (
                      <div key={item.day} className="flex min-w-0 flex-1 flex-col items-center">
                        <span className="mb-2 text-[10px] font-bold text-blue-400">{item.cups}</span>
                        <div
                          className={`w-full max-w-12 rounded-md ${isToday ? 'bg-emerald-400' : 'bg-blue-300'}`}
                          style={{ height: `${(item.cups / chartMaxCups) * chartHeight}px` }}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="mt-2 flex justify-between gap-3">
                {weekData.map((item) => {
                  return (
                    <span key={item.day} className="min-w-0 flex-1 text-center text-[11px] font-medium text-neutral-400">{item.day}</span>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="grid gap-3 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-700 ring-1 ring-emerald-100 sm:grid-cols-[auto_1fr]">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-500" />
            <div>
              <p className="font-bold">เป้าหมาย: อีก {remainingCups} แก้ว</p>
              <p className="mt-1 text-xs font-medium text-emerald-600">
                ดื่มไปแล้ว {cups} แก้ว / {targetCups} แก้ว วันนี้คืบหน้า {Math.round(progress * 100)}%
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <SmallInfo icon={Target} label="เป้าหมายต่อวัน" value={`${targetMl.toLocaleString()} ml`} />
            <SmallInfo icon={Waves} label="รวมวันนี้" value={`${totalMl.toLocaleString()} ml`} />
          </div>
        </section>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  valueClassName,
}: {
  label: string
  value: string
  valueClassName: string
}) {
  return (
    <div className="rounded-xl bg-sky-100 p-4">
      <p className="text-xs font-semibold text-neutral-500">{label}</p>
      <p className={`mt-1 text-xl font-extrabold ${valueClassName}`}>{value}</p>
    </div>
  )
}

function SmallInfo({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Target
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-500">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs font-semibold text-neutral-400">{label}</p>
        <p className="text-base font-extrabold text-neutral-800">{value}</p>
      </div>
    </div>
  )
}

