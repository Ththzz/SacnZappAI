'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Droplet, Droplets, Minus, Plus, Target, Trash2, Waves } from 'lucide-react'
import { getLocalDateKey, readWaterLogs, writeWaterLogs, type WaterLogEntry } from '@/lib/user-data'

const drinkOptions = [150, 250, 350, 500]

const chartMaxCups = 10
const chartHeight = 130

function buildWaterWeekData(logs: WaterLogEntry[]) {
  const dayLabels = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']
  const today = new Date()

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (6 - index))
    const dateKey = getLocalDateKey(date)
    const totalMl = logs
      .filter((log) => log.date === dateKey)
      .reduce((sum, log) => sum + log.amount, 0)

    return {
      date: dateKey,
      day: dayLabels[date.getDay()],
      cups: Math.round(totalMl / 250),
      isToday: dateKey === getLocalDateKey(today),
    }
  })
}

export default function WaterTrackerClient() {
  const [logs, setLogs] = useState<WaterLogEntry[]>([])
  const [selectedAmount, setSelectedAmount] = useState(250)
  const [loaded, setLoaded] = useState(false)
  const [targetMl] = useState<number | null>(null)
  const dataRevision = useRef(0)
  const todayKey = getLocalDateKey()
  const todayLabel = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())

  useEffect(() => {
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - 6)
    const stored = readWaterLogs()
    if (stored.length > 0) setLogs(stored)
    setLoaded(true)
    const requestRevision = dataRevision.current

    fetch(`/api/water-logs?from=${getLocalDateKey(weekStart)}&to=${getLocalDateKey()}&limit=500`)
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as { logs?: WaterLogEntry[] }
        if (!response.ok) throw new Error('api')
        if (dataRevision.current === requestRevision) setLogs(data.logs ?? [])
      })
      .catch(() => {
        const stored = readWaterLogs()
        if (stored.length > 0) setLogs(stored)
      })
      .finally(() => setLoaded(true))
  }, [])

  useEffect(() => {
    if (!loaded) return
    const timeout = window.setTimeout(() => writeWaterLogs(logs), 300)
    return () => window.clearTimeout(timeout)
  }, [logs, loaded])

  const todayLogs = logs.filter((item) => item.date === todayKey)
  const totalMl = todayLogs.reduce((sum, item) => sum + item.amount, 0)
  const cups = Math.round(totalMl / 250)
  const targetCups = targetMl ? Math.round(targetMl / 250) : null
  const weekData = useMemo(() => buildWaterWeekData(logs), [logs])
  const bestCups = Math.max(...weekData.map((item) => item.cups), 0)
  const averageCups = Math.round((weekData.reduce((sum, item) => sum + item.cups, 0) / weekData.length) * 10) / 10
  const progress = targetMl ? Math.min(totalMl / targetMl, 1) : null
  const waterLevel = 34 + Math.min(cups / chartMaxCups, 1) * 45
  const remainingCups = targetCups ? Math.max(targetCups - cups, 0) : null
  const targetLineBottom = targetCups ? (targetCups / chartMaxCups) * chartHeight : null

  const handleAddWater = () => {
    dataRevision.current += 1
    const nextTime = new Date().toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })

    const entry = {
      id: crypto.randomUUID(),
      date: todayKey,
      time: nextTime,
      amount: selectedAmount,
    }

    setLogs((current) => [
      ...current,
      entry,
    ])

    fetch('/api/water-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    }).catch(() => undefined)
  }

  const handleSubtractWater = () => {
    dataRevision.current += 1
    const removedIds: string[] = []
    const changedEntries: WaterLogEntry[] = []

    setLogs((current) => {
      let amountToRemove = selectedAmount
      const nextLogs = [...current]

      for (let lastIndex = nextLogs.length - 1; lastIndex >= 0 && amountToRemove > 0; lastIndex -= 1) {
        const lastEntry = nextLogs[lastIndex]
        if (lastEntry.date !== todayKey) continue

        if (lastEntry.amount <= amountToRemove) {
          amountToRemove -= lastEntry.amount
          if (lastEntry.id) removedIds.push(lastEntry.id)
          nextLogs.splice(lastIndex, 1)
        } else {
          const changedEntry = {
            ...lastEntry,
            amount: lastEntry.amount - amountToRemove,
          }
          nextLogs[lastIndex] = changedEntry
          changedEntries.push(changedEntry)
          amountToRemove = 0
        }
      }

      return nextLogs
    })

    removedIds.forEach((id) => {
      fetch(`/api/water-logs/${id}`, { method: 'DELETE' }).catch(() => undefined)
    })
    changedEntries.forEach((entry) => {
      if (!entry.id) return
      fetch(`/api/water-logs/${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: entry.amount }),
      }).catch(() => undefined)
    })
  }

  const handleRemoveLog = (indexToRemove: number) => {
    dataRevision.current += 1
    const entryToRemove = todayLogs[indexToRemove]
    setLogs((current) => {
      let todayIndex = -1

      return current.filter((entry) => {
        if (entry.date !== todayKey) return true

        todayIndex += 1
        return todayIndex !== indexToRemove
      })
    })

    if (entryToRemove?.id) {
      fetch(`/api/water-logs/${entryToRemove.id}`, { method: 'DELETE' }).catch(() => undefined)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 text-neutral-900" aria-busy={!loaded}>
      <div className="flex justify-end">
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-600">
          <Droplets className="h-4 w-4" />
          ScanZapp AI · วันที่ {todayLabel}
        </div>
      </div>

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
                  <span className="mb-3 text-sm font-semibold text-blue-400">แก้ว</span>
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
                  {loaded && todayLogs.length === 0 && (
                    <div className="rounded-xl bg-neutral-50 px-3 py-2 text-xs font-medium text-neutral-400">
                      ยังไม่มีรายการดื่มน้ำของวันนี้
                    </div>
                  )}
                  {!loaded && todayLogs.length === 0 && (
                    <div role="status" className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-medium text-blue-500">
                      กำลังอัปเดตรายการดื่มน้ำ...
                    </div>
                  )}
                  {todayLogs.map((entry, index) => (
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
              <StatCard label="เฉลี่ย 7 วัน" value={`${averageCups} แก้ว`} valueClassName="text-blue-500" />
              <StatCard label="ดีที่สุด" value={`${bestCups} แก้ว`} valueClassName="text-emerald-500" />
              <StatCard label="วันนี้" value={`${cups} แก้ว`} valueClassName="text-orange-500" />
              <StatCard label="เป้าหมาย" value={targetCups ? `${targetCups} แก้ว` : "ยังไม่มี"} valueClassName="text-neutral-700" />
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold">แนวโน้มใน 7 วัน</h2>
              <span className="text-xs font-semibold text-orange-400">
                {targetCups ? `เป้าหมาย ${targetCups} แก้ว` : "ยังไม่มีเป้าหมาย"}
              </span>
            </div>
            <div className="relative mt-5">
              <div className="relative h-[130px]">
                {targetLineBottom !== null && (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-0 border-t border-orange-200"
                    style={{ bottom: `${targetLineBottom}px` }}
                  />
                )}
                <div className="relative z-10 flex h-full items-end justify-between gap-3">
                  {weekData.map((item) => {
                    return (
                      <div key={item.date} className="flex min-w-0 flex-1 flex-col items-center">
                        <span className="mb-2 text-[10px] font-bold text-blue-400">{item.cups}</span>
                        <div
                          className={`w-full max-w-12 rounded-md ${item.isToday ? 'bg-emerald-400' : item.cups === 0 ? 'bg-neutral-200' : 'bg-blue-300'}`}
                          style={{ height: `${item.cups === 0 ? 12 : (item.cups / chartMaxCups) * chartHeight}px` }}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="mt-2 flex justify-between gap-3">
                {weekData.map((item) => {
                  return (
                    <span key={item.date} className="min-w-0 flex-1 text-center text-[11px] font-medium text-neutral-400">{item.day}</span>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="grid gap-3 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-700 ring-1 ring-emerald-100 sm:grid-cols-[auto_1fr]">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-500" />
            <div>
              <p className="font-bold">
                {remainingCups !== null ? `เป้าหมาย: อีก ${remainingCups} แก้ว` : "ยังไม่มีเป้าหมายการดื่มน้ำ"}
              </p>
              <p className="mt-1 text-xs font-medium text-emerald-600">
                {progress !== null
                  ? `ดื่มไปแล้ว ${cups} แก้ว / ${targetCups} แก้ว วันนี้คืบหน้า ${Math.round(progress * 100)}%`
                  : `วันนี้บันทึกน้ำแล้ว ${cups} แก้ว (${totalMl.toLocaleString()} ml)`}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <SmallInfo icon={Target} label="เป้าหมายต่อวัน" value={targetMl ? `${targetMl.toLocaleString()} ml` : "ยังไม่มีเป้าหมาย"} />
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
