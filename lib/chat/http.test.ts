import { describe, expect, it } from "vitest"

import { normalizeLimit } from "./http"

describe("normalizeLimit", () => {
  it("uses the configured fallback when the query parameter is absent or blank", () => {
    expect(normalizeLimit(null, 50, 100)).toBe(50)
    expect(normalizeLimit("", 50, 100)).toBe(50)
    expect(normalizeLimit("  ", 50, 100)).toBe(50)
  })

  it("clamps explicit limits to the supported range", () => {
    expect(normalizeLimit("0", 50, 100)).toBe(1)
    expect(normalizeLimit("25", 50, 100)).toBe(25)
    expect(normalizeLimit("500", 50, 100)).toBe(100)
  })
})
