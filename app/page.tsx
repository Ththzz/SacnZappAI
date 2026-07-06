import General from "@/components/Cards/General"
import { requireUser } from "@/lib/auth"
import { getDashboardData } from "@/lib/dashboard"

export default async function HomePage() {
  const user = await requireUser()
  const dashboard = await getDashboardData(user.id)

  return <General initialData={dashboard} />
}
