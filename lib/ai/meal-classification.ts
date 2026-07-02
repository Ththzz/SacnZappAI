import { extractJsonFromFoodContent } from "@/lib/ai/food-analysis"
import { defaultAiModel, requestAiChat } from "@/lib/ai/provider"

export type LegacyMealForClassification = {
  id: string
  name: string
  calories: number
  protein: number
  carbs: number
  fat: number
}

export type MealKind = "main_meal" | "snack"

export function parseMealKindClassifications(
  content: string,
  allowedIds: Set<string>,
): { id: string; mealKind: MealKind }[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    parsed = JSON.parse(extractJsonFromFoodContent(content))
  }
  const items =
    Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object" && Array.isArray((parsed as { items?: unknown }).items)
        ? (parsed as { items: unknown[] }).items
        : []

  const seen = new Set<string>()
  return items.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const { id, mealKind } = item as { id?: unknown; mealKind?: unknown }
    if (
      typeof id !== "string" ||
      !allowedIds.has(id) ||
      seen.has(id) ||
      (mealKind !== "main_meal" && mealKind !== "snack")
    ) {
      return []
    }
    seen.add(id)
    return [{ id, mealKind }]
  })
}

export async function classifyLegacyMeals(input: {
  apiKey: string
  meals: LegacyMealForClassification[]
  model?: string
}) {
  if (input.meals.length === 0) return []
  const model = input.model?.trim() || process.env.QWEN_MODEL?.trim() || defaultAiModel
  const completion = await requestAiChat({
    apiKey: input.apiKey,
    model,
    messages: [
      {
        role: "system",
        content:
          "You classify foods from stored Thai or English meal names and nutrition only. Decide from the food itself, never from time. snack means a light between-meal food/drink or small treat; main_meal means a substantial meal. Return only valid JSON with no markdown.",
      },
      {
        role: "user",
        content: `จำแนกรายการต่อไปนี้เป็น main_meal หรือ snack ตอบเป็น {"items":[{"id":"...","mealKind":"main_meal|snack"}]} และต้องส่งกลับทุก id ที่จำแนกได้:\n${JSON.stringify(input.meals)}`,
      },
    ],
  })

  return parseMealKindClassifications(completion.text, new Set(input.meals.map((meal) => meal.id)))
}
