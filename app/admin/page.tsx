import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import AdminDashboardClient from "./AdminDashboardClient"

export default async function AdminPage() {
  const user = await getCurrentUser()

  if (!user) redirect("/sign-in?next=/admin")
  if (user.role !== "admin") redirect("/")

  return <AdminDashboardClient />
}
