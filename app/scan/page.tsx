'use client'

import { useState } from 'react'
import { CameraIcon, UploadIcon, SearchIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function ScanPage() {
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<null | { name: string; calories: number; protein: number; carbs: number; fat: number }>(null)

  const handleScan = () => {
    setScanning(true)
    setTimeout(() => {
      setResult({
        name: 'ข้าวหน้าหมูย่าง',
        calories: 520,
        protein: 28,
        carbs: 62,
        fat: 18,
      })
      setScanning(false)
    }, 2000)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Scan Food</h1>

      {/* Scanner */}
      <div className="border-2 border-dashed border-neutral-200 rounded-xl p-12 text-center space-y-4">
        <CameraIcon className="mx-auto h-12 w-12 text-neutral-300" />
        <p className="text-neutral-500">Take a photo or upload an image to scan nutritional info</p>
        <div className="flex justify-center gap-3">
          <Button onClick={handleScan} disabled={scanning}>
            {scanning ? 'Scanning...' : '📷 Camera'}
          </Button>
          <Button variant="outline" onClick={handleScan}>
            <UploadIcon className="h-4 w-4 mr-2" /> Upload
          </Button>
        </div>
      </div>

      {/* Barcode Search */}
      <div className="flex gap-2">
        <Input placeholder="Or enter barcode number..." />
        <Button variant="outline">
          <SearchIcon className="h-4 w-4" />
        </Button>
      </div>

      {/* Result */}
      {result && (
        <div className="border rounded-xl p-6 space-y-3 bg-white">
          <h2 className="font-semibold text-lg">{result.name}</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="space-y-1">
              <p className="text-neutral-500">พลังงาน</p>
              <p className="font-semibold text-[#2EC78F]">{result.calories} kcal</p>
            </div>
            <div className="space-y-1">
              <p className="text-neutral-500">โปรตีน</p>
              <p className="font-semibold">{result.protein}g</p>
            </div>
            <div className="space-y-1">
              <p className="text-neutral-500">คาร์บ</p>
              <p className="font-semibold">{result.carbs}g</p>
            </div>
            <div className="space-y-1">
              <p className="text-neutral-500">ไขมัน</p>
              <p className="font-semibold">{result.fat}g</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
