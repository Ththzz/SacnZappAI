'use client'

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SettingsIcon } from "lucide-react"

const stats = [
  { label: 'อายุ', value: '25 ปี' },
  { label: 'ส่วนสูง', value: '170 cm' },
  { label: 'น้ำหนัก', value: '62 kg' },
  { label: 'เป้าหมาย', value: 'รักษา / lean gain' },
  { label: 'BMR', value: '1,650 kcal' },
  { label: 'TDEE', value: '2,200 kcal' },
]

export default function ProfilePage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Profile & Goals</h1>
        <Button variant="outline" size="sm">
          <SettingsIcon className="h-4 w-4 mr-2" /> Edit
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4 text-center space-y-1">
              <p className="text-xs text-neutral-500">{stat.label}</p>
              <p className="font-semibold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Form */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <h3 className="font-semibold">Personal Info</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm text-neutral-500">Name</label>
              <Input defaultValue="Thanapol Thiwong" />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-neutral-500">Email</label>
              <Input defaultValue="aomsinthiwong@gmail.com" />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-neutral-500">Weight (kg)</label>
              <Input defaultValue="62" type="number" />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-neutral-500">Height (cm)</label>
              <Input defaultValue="170" type="number" />
            </div>
          </div>
          <Button>Save Changes</Button>
        </CardContent>
      </Card>
    </div>
  )
}
