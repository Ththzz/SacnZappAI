import { pbkdf2Sync, randomBytes } from "node:crypto"
import { PrismaClient } from "@prisma/client"

if (/^postgres(?:ql)?:\/\//i.test(process.env.DATABASE_URL ?? "")) {
  console.error("Demo seed is disabled for PostgreSQL. Create a normal account and use npm run admin:promote instead.")
  process.exit(1)
}

const prisma = new PrismaClient()

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex")
  const hash = pbkdf2Sync(password, salt, 210_000, 32, "sha256").toString("hex")
  return `pbkdf2$210000$${salt}$${hash}`
}

async function upsertUser({ name, email, password, role }) {
  return prisma.user.upsert({
    where: { email },
    create: {
      name,
      email,
      passwordHash: hashPassword(password),
      role,
    },
    update: {
      name,
      role,
    },
  })
}

const admin = await upsertUser({
  name: "Demo Admin",
  email: "admin.demo@scanzapp.test",
  password: "DemoAdmin123",
  role: "admin",
})

const user = await upsertUser({
  name: "Demo User",
  email: "user.demo@scanzapp.test",
  password: "DemoUser123",
  role: "user",
})

await prisma.meal.deleteMany({ where: { id: "seed-meal-user-1" } })
await prisma.waterLog.deleteMany({ where: { id: "seed-water-user-1" } })

await prisma.$disconnect()

console.log("Seeded demo accounts:")
console.log("user.demo@scanzapp.test / DemoUser123")
console.log("admin.demo@scanzapp.test / DemoAdmin123")
console.log(`Admin id: ${admin.id}`)
console.log(`User id: ${user.id}`)
