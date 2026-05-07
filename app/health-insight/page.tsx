'use client'

import { Card, CardContent } from "@/components/ui/card"
import { LightbulbIcon, TrendingUpIcon, AlertTriangleIcon, CheckCircleIcon } from "lucide-react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts"

const trendData = [
  { date: '01/05', calories: 2100 },
  { date: '02/05', calories: 1950 },
  { date: '03/05', calories: 2300 },
  { date: '04/05', calories: 2050 },
  { date: '05/05', calories: 1800 },
  { date: '06/05', calories: 2200 },
  { date: '07/05', calories: 1240 },
]

const insights = [
  { icon: CheckCircleIcon, text: 'โปรตีนถึงเป้าหมาย 5 วันติด', type: 'success' as const },
  { icon: AlertTriangleIcon, text: 'ไขมันเกินเป้าหมายเมื่อวาน', type: 'warning' as const },
  { icon: TrendingUpIcon, text: 'แคลอรี่เฉลี่ยลดลง 8% จากสัปดาห์ก่อน', type: 'info' as const },
  { icon: LightbulbIcon, text: 'ลองเพิ่มผักในมื้อเย็นเพื่อเพิ่มไฟเบอร์', type: 'tip' as const },
]

export default function HealthInsightPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Health Insight</h1>

      {/* Weekly Trend */}
      <Card>
        <CardContent className="p-6">
          <h3 className="font-semibold mb-4">Weekly Calorie Trend</h3>
          <AreaChart width={600} height={200} data={trendData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" fontSize={12} />
            <YAxis fontSize={12} domain={[0, 2500]} />
            <Tooltip />
            <Area type="monotone" dataKey="calories" stroke="#2EC78F" fill="#2EC78F20" />
          </AreaChart>
        </CardContent>
      </Card>

      {/* Insights */}
      <div className="space-y-3">
        <h3 className="font-semibold">Insights</h3>
        {insights.map((insight, i) => {
          const Icon = insight.icon
          const colors = {
            success: 'text-[#2EC78F] bg-[#2EC78F]/10',
            warning: 'text-[#F59E0B] bg-[#F59E0B]/10',
            info: 'text-[#60A5FA] bg-[#60A5FA]/10',
            tip: 'text-[#A78BFA] bg-[#A78BFA]/10',
          }
          return (
            <Card key={i}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2 rounded-full ${colors[insight.type]}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <p>{insight.text}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
