'use client'

import { Card, CardContent } from "@/components/ui/card"

const meals = [
  { id: 1, name: 'ข้าวหน้าหมูย่าง', time: '12:30 PM', date: '2026-05-07', calories: 520, protein: 28, carbs: 62, fat: 18 },
  { id: 2, name: 'กาแฟเย็น', time: '09:15 AM', date: '2026-05-07', calories: 180, protein: 4, carbs: 28, fat: 6 },
  { id: 3, name: 'ส้มตำ', time: '01:00 PM', date: '2026-05-06', calories: 220, protein: 5, carbs: 35, fat: 8 },
  { id: 4, name: 'ข้าวผัดกะเพรา', time: '06:30 PM', date: '2026-05-06', calories: 480, protein: 22, carbs: 55, fat: 16 },
  { id: 5, name: 'น้ำผลไม้', time: '08:00 AM', date: '2026-05-06', calories: 150, protein: 2, carbs: 35, fat: 1 },
  { id: 6, name: 'ต้มยำกุ้ง', time: '01:30 PM', date: '2026-05-05', calories: 160, protein: 18, carbs: 10, fat: 5 },
]

const groupedByDate = meals.reduce((acc, meal) => {
  if (!acc[meal.date]) acc[meal.date] = []
  acc[meal.date].push(meal)
  return acc
}, {} as Record<string, typeof meals>)

export default function MealHistoryPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Meal History</h1>

      {Object.entries(groupedByDate).map(([date, dayMeals]) => {
        const dayTotal = dayMeals.reduce((sum, m) => sum + m.calories, 0)
        return (
          <div key={date} className="space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="font-semibold text-sm text-neutral-500">{date}</h2>
              <p className="text-sm text-neutral-500">{dayTotal} kcal</p>
            </div>

            <div className="space-y-2">
              {dayMeals.map((meal) => (
                <Card key={meal.id}>
                  <CardContent className="p-4 flex justify-between items-center">
                    <div>
                      <p className="font-medium">{meal.name}</p>
                      <p className="text-sm text-neutral-500">{meal.time}</p>
                    </div>
                    <div className="text-right text-sm space-y-1">
                      <p className="font-semibold text-[#2EC78F]">{meal.calories} kcal</p>
                      <p className="text-neutral-400">P: {meal.protein}g · C: {meal.carbs}g · F: {meal.fat}g</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
