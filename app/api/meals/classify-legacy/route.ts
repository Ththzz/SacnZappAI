import { NextResponse } from "next/server"

import { classifyLegacyMeals } from "@/lib/ai/meal-classification"
import { defaultAiModel } from "@/lib/ai/provider"
import { requireUser } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { jsonError } from "@/lib/http"
import { getTimeBasedMealCategory } from "@/lib/user-data"

const batchSize = 50

export const maxDuration = 60

export async function POST() {
  try {
    const user = await requireUser()
    const apiKey = process.env.QWEN_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "ยังไม่ได้ตั้งค่า QWEN_API_KEY สำหรับจัดหมวดมื้ออาหาร" }, { status: 500 })
    }

    const meals = await prisma.meal.findMany({
      where: { userId: user.id, mealCategory: null },
      orderBy: { createdAt: "asc" },
      take: batchSize,
      select: {
        id: true,
        name: true,
        calories: true,
        protein: true,
        carbs: true,
        fat: true,
        time: true,
      },
    })

    if (meals.length === 0) {
      return NextResponse.json({ updated: 0, remaining: 0 })
    }

    const classifications = await classifyLegacyMeals({
      apiKey,
      model: process.env.QWEN_MODEL?.trim() || defaultAiModel,
      meals,
    })
    const byId = new Map(meals.map((meal) => [meal.id, meal]))

    await prisma.$transaction(
      classifications.flatMap((classification) => {
        const meal = byId.get(classification.id)
        if (!meal) return []
        const mealCategory =
          classification.mealKind === "snack" ? "snack" : getTimeBasedMealCategory(meal.time)
        return [
          prisma.meal.updateMany({
            where: { id: meal.id, userId: user.id, mealCategory: null },
            data: { mealCategory },
          }),
        ]
      }),
    )

    const remaining = await prisma.meal.count({ where: { userId: user.id, mealCategory: null } })
    return NextResponse.json({ updated: classifications.length, remaining })
  } catch (error) {
    return jsonError(error)
  }
}
