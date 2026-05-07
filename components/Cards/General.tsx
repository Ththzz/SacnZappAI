'use client'

import { Card, CardContent } from "@/components/ui/card"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts"

const intakeData = [
  { name: 'โปรตีน', actual: 78, goal: 80 },
  { name: 'คาร์บ', actual: 220, goal: 250 },
  { name: 'ไขมัน', actual: 55, goal: 65 },
  { name: 'ไฟเบอร์', actual: 18, goal: 30 },
]

const macroData = [
  { name: 'โปรตีน', value: 40, color: '#2EC78F' },
  { name: 'คาร์บ', value: 35, color: '#60A5FA' },
  { name: 'ไขมัน', value: 25, color: '#F59E0B' },
]

export default function General() {
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-sm text-neutral-500">พลังงานวันนี้</p>
            <p className="text-3xl font-bold text-[#2EC78F] mt-1">1,240</p>
            <p className="text-xs text-neutral-400 mt-1">kcal / 2,200 goal</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-sm text-neutral-500">น้ำวันนี้</p>
            <p className="text-3xl font-bold text-[#60A5FA] mt-1">1,200</p>
            <p className="text-xs text-neutral-400 mt-1">ml / 2,000 goal</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-sm text-neutral-500">มื้ออาหาร</p>
            <p className="text-3xl font-bold text-[#F59E0B] mt-1">3</p>
            <p className="text-xs text-neutral-400 mt-1">meals</p>
          </CardContent>
        </Card>
      </div>

      {/* Macros Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4">macronutrient Balance</h3>
            <div className="flex justify-center">
              <PieChart width={240} height={240}>
                <Pie
                  data={macroData}
                  cx={120} cy={120}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, value }) => `${name} ${value}%`}
                >
                  {macroData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </div>
          </CardContent>
        </Card>

        {/* Intake vs Goal Bar */}
        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4">Today&apos;s Intake vs Goal</h3>
            <BarChart data={intakeData} barSize={30}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Bar dataKey="goal" fill="#E5E7EB" radius={[4, 4, 0, 0]} />
              <Bar dataKey="actual" fill="#2EC78F" radius={[4, 4, 0, 0]} />
            </BarChart>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
