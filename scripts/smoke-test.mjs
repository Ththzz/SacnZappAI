const deploymentUrl = process.env.DEPLOYMENT_URL?.trim().replace(/\/+$/, "")

if (!deploymentUrl || !/^https?:\/\//i.test(deploymentUrl)) {
  console.error("Set DEPLOYMENT_URL to the Vercel Preview or Production URL")
  process.exit(1)
}

const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim()
const headers = bypassSecret
  ? { "x-vercel-protection-bypass": bypassSecret }
  : {}

async function request(path) {
  return fetch(`${deploymentUrl}${path}`, {
    headers,
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  })
}

async function assertResponse(label, action) {
  try {
    await action()
    console.log(`✓ ${label}`)
  } catch (error) {
    console.error(`✗ ${label}: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  }
}

await assertResponse("database health", async () => {
  const response = await request("/api/health")
  const body = await response.json().catch(() => null)
  if (!response.ok || body?.status !== "ok" || body?.database !== "ok") {
    throw new Error(`expected 200/ok, received ${response.status} ${JSON.stringify(body)}`)
  }
})

await assertResponse("public sign-in page", async () => {
  const response = await request("/sign-in")
  if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) {
    throw new Error(`expected an HTML 200 response, received ${response.status}`)
  }
})

await assertResponse("protected dashboard redirect", async () => {
  const response = await request("/")
  if (!response.ok || !new URL(response.url).pathname.startsWith("/sign-in")) {
    throw new Error(`expected redirect to /sign-in, received ${response.status} ${response.url}`)
  }
})

await assertResponse("unauthenticated API protection", async () => {
  const response = await request("/api/auth/me")
  if (response.status !== 401) {
    throw new Error(`expected 401, received ${response.status}`)
  }
})

if (process.exitCode) process.exit(process.exitCode)
