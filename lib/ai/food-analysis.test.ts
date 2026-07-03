import { describe, expect, it } from "vitest"

import { MAX_FOOD_IMAGE_BYTES, normalizeFoodAnalysis, parseFoodImageDataUrl } from "./food-analysis"

describe("normalizeFoodAnalysis", () => {
  it("keeps a valid snack classification", () => {
    expect(normalizeFoodAnalysis({ mealKind: "snack" }).mealKind).toBe("snack")
  })

  it("defaults missing or invalid meal kinds to main_meal", () => {
    expect(normalizeFoodAnalysis({}).mealKind).toBe("main_meal")
    expect(normalizeFoodAnalysis({ mealKind: "dessert" as never }).mealKind).toBe("main_meal")
  })
})

describe("parseFoodImageDataUrl", () => {
  it("rejects malformed base64 image data", () => {
    expect(parseFoodImageDataUrl("data:image/png;base64,not valid")).toEqual({
      error: "รูปภาพต้องอยู่ในรูปแบบ base64 data URL ที่ถูกต้อง",
    })
  })

  it("rejects decoded images larger than the server limit", () => {
    const encodedLength = Math.ceil(((MAX_FOOD_IMAGE_BYTES + 1) * 4) / 3 / 4) * 4
    const result = parseFoodImageDataUrl(`data:image/jpeg;base64,${"A".repeat(encodedLength)}`)

    expect(result).toEqual({ error: "รูปภาพหลังปรับขนาดต้องไม่เกิน 3MB" })
  })
})
