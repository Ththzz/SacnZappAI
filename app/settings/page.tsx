'use client'

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function SettingsPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Appearance */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <h3 className="font-semibold">Appearance</h3>
          <div className="flex items-center justify-between">
            <p className="text-sm text-neutral-500">Theme</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">Light</Button>
              <Button variant="outline" size="sm">Dark</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Daily Goals */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <h3 className="font-semibold">Daily Goals</h3>
          <div className="space-y-3 max-w-sm">
            <div className="space-y-1">
              <Label>Calorie Target (kcal)</Label>
              <Input type="number" defaultValue="2200" />
            </div>
            <div className="space-y-1">
              <Label>Water Target (ml)</Label>
              <Input type="number" defaultValue="2000" />
            </div>
          </div>
          <Button>Save</Button>
        </CardContent>
      </Card>

      {/* Unit */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <h3 className="font-semibold">Units</h3>
          <div className="flex items-center justify-between">
            <p className="text-sm text-neutral-500">Weight Unit</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">kg</Button>
              <Button variant="outline" size="sm">lb</Button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-neutral-500">Temperature</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">Celsius</Button>
              <Button variant="outline" size="sm">Fahrenheit</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
