import { afterEach, describe, expect, it } from "vitest"

import { canCreateAdmin, hashPassword, isAdminSignupConfigured, verifyPassword } from "./auth"

describe("admin signup configuration", () => {
  const originalCode = process.env.ADMIN_SIGNUP_CODE

  afterEach(() => {
    if (originalCode === undefined) delete process.env.ADMIN_SIGNUP_CODE
    else process.env.ADMIN_SIGNUP_CODE = originalCode
  })

  it("fails closed when ADMIN_SIGNUP_CODE is missing or blank", () => {
    delete process.env.ADMIN_SIGNUP_CODE
    expect(isAdminSignupConfigured()).toBe(false)
    expect(canCreateAdmin()).toBe(false)

    process.env.ADMIN_SIGNUP_CODE = "   "
    expect(isAdminSignupConfigured()).toBe(false)
    expect(canCreateAdmin("")).toBe(false)
  })

  it("accepts only the configured admin code", () => {
    process.env.ADMIN_SIGNUP_CODE = "private-code"
    expect(isAdminSignupConfigured()).toBe(true)
    expect(canCreateAdmin("wrong-code")).toBe(false)
    expect(canCreateAdmin("private-code")).toBe(true)
  })
})

describe("password hashing", () => {
  it("hashes and verifies passwords asynchronously", async () => {
    const stored = await hashPassword("correct horse battery staple")

    await expect(verifyPassword("correct horse battery staple", stored)).resolves.toBe(true)
    await expect(verifyPassword("wrong password", stored)).resolves.toBe(false)
  })
})
