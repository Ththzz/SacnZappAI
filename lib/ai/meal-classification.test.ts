import { describe, expect, it } from "vitest"

import { parseMealKindClassifications } from "./meal-classification"

describe("parseMealKindClassifications", () => {
  it("accepts valid classifications and rejects unknown ids or kinds", () => {
    const content = JSON.stringify({
      items: [
        { id: "meal-1", mealKind: "snack" },
        { id: "meal-2", mealKind: "main_meal" },
        { id: "meal-3", mealKind: "breakfast" },
        { id: "unknown", mealKind: "snack" },
      ],
    })

    expect(parseMealKindClassifications(content, new Set(["meal-1", "meal-2", "meal-3"]))).toEqual([
      { id: "meal-1", mealKind: "snack" },
      { id: "meal-2", mealKind: "main_meal" },
    ])
  })

  it("does not apply duplicate classifications", () => {
    expect(
      parseMealKindClassifications(
        JSON.stringify([
          { id: "meal-1", mealKind: "snack" },
          { id: "meal-1", mealKind: "main_meal" },
        ]),
        new Set(["meal-1"]),
      ),
    ).toEqual([{ id: "meal-1", mealKind: "snack" }])
  })
})
