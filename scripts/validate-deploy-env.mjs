const isVercelBuild = process.env.VERCEL === "1"

if (!isVercelBuild) {
  console.log("Skipping Vercel environment validation for local build")
  process.exit(0)
}

const requiredVariables = ["DATABASE_URL", "DIRECT_URL", "QWEN_API_KEY"]
const missingVariables = requiredVariables.filter((name) => !process.env[name]?.trim())

if (missingVariables.length > 0) {
  console.error(`Missing required Vercel environment variables: ${missingVariables.join(", ")}`)
  process.exit(1)
}

for (const name of ["DATABASE_URL", "DIRECT_URL"]) {
  if (!/^postgres(?:ql)?:\/\//i.test(process.env[name] ?? "")) {
    console.error(`${name} must be a PostgreSQL connection URL`)
    process.exit(1)
  }
}

console.log("Vercel deployment environment is configured")
