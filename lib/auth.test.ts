import { describe, expect, it } from "vitest"

import { hashPassword, verifyPassword } from "./auth"

describe("password hashing", () => {
  it("hashes and verifies passwords asynchronously", async () => {
    const stored = await hashPassword("correct horse battery staple")

    await expect(verifyPassword("correct horse battery staple", stored)).resolves.toBe(true)
    await expect(verifyPassword("wrong password", stored)).resolves.toBe(false)
  })
})
