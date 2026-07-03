import { PrismaClient } from "@prisma/client"

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()

if (!email || !email.includes("@")) {
  console.error("Set ADMIN_EMAIL to the existing account that should become an admin")
  process.exit(1)
}

if (!/^postgres(?:ql)?:\/\//i.test(process.env.DATABASE_URL ?? "")) {
  console.error("admin:promote must run with the production PostgreSQL DATABASE_URL")
  process.exit(1)
}

const prisma = new PrismaClient()

try {
  const result = await prisma.user.updateMany({
    where: { email },
    data: { role: "admin" },
  })

  if (result.count !== 1) {
    console.error(`No unique existing account found for ${email}`)
    process.exitCode = 1
  } else {
    console.log(`Promoted ${email} to admin`)
  }
} finally {
  await prisma.$disconnect()
}
