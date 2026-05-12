'use client'

import {
  Area,
  AreaChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

type TrendPoint = {
  date: string
  calories: number
}

export default function HealthTrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <AreaChart width={600} height={200} data={data}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="date" fontSize={12} />
      <YAxis fontSize={12} domain={[0, 2500]} />
      <Tooltip />
      <Area type="monotone" dataKey="calories" stroke="#2EC78F" fill="#2EC78F20" />
    </AreaChart>
  )
}
