'use client'

import { useState } from 'react'
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DropletsIcon, PlusIcon, MinusIcon } from "lucide-react"

const goals = [1500, 2000, 2500]

export default function WaterTrackerPage() {
  const [ml, setMl] = useState(1200)
  const [target, setTarget] = useState(2000)

  const pct = Math.min((ml / target) * 100, 100)

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Water Tracker</h1>

      <Card>
        <CardContent className="p-8 text-center space-y-6">
          <div className="relative w-48 h-48 mx-auto">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r="45" fill="none" stroke="#E5E7EB" strokeWidth="8" />
              <circle
                cx="50" cy="50" r="45"
                fill="none" stroke="#60A5FA" strokeWidth="8"
                strokeDasharray={`${pct * 2.83} 283`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <DropletsIcon className="h-6 w-6 text-[#60A5FA]" />
              <p className="text-2xl font-bold">{ml} ml</p>
              <p className="text-xs text-neutral-400">of {target} ml</p>
            </div>
          </div>

          <div className="flex justify-center gap-2">
            {[150, 300, 500].map((amount) => (
              <Button key={amount} variant="outline" onClick={() => setMl((m) => m + amount)}>
                +{amount} ml
              </Button>
            ))}
          </div>

          <div className="flex justify-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => setMl((m) => Math.max(0, m - 150))}>
              <MinusIcon className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setMl((m) => m + 150)}>
              <PlusIcon className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Log */}
      <div className="space-y-2">
        <h3 className="font-semibold">Today&apos;s Log</h3>
        {[
          { time: '07:30 AM', amount: 250, label: 'Water' },
          { time: '10:00 AM', amount: 350, label: 'Green Tea' },
          { time: '01:00 PM', amount: 400, label: 'Water' },
          { time: '03:30 PM', amount: 200, label: 'Coffee' },
        ].map((entry, i) => (
          <div key={i} className="flex justify-between text-sm px-2">
            <span className="text-neutral-500">{entry.time} · {entry.label}</span>
            <span className="font-medium text-[#60A5FA]">+{entry.amount} ml</span>
          </div>
        ))}
      </div>
    </div>
  )
}
