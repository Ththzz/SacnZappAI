import { redirect } from "next/navigation"

import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isOnboardingComplete, ONBOARDING_GOALS, safeNextPath, type OnboardingGoal } from "@/lib/onboarding"
import OnboardingClient, { type OnboardingForm } from "./OnboardingClient"

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect("/sign-in?next=/onboarding")
  if (user.role === "admin") redirect("/admin")

  const { next } = await searchParams
  const destination = safeNextPath(next)
  const profileRow = await prisma.profile.findUnique({ where: { userId: user.id } })
  let storedForm: Partial<OnboardingForm> = {}

  if (profileRow?.formJson) {
    try {
      storedForm = JSON.parse(profileRow.formJson) as Partial<OnboardingForm>
    } catch {
      storedForm = {}
    }
  }

  if (
    isOnboardingComplete({
      selectedGoal: profileRow?.selectedGoal,
      form: storedForm as Record<string, unknown>,
    })
  ) {
    redirect(destination)
  }

  return (
    <OnboardingClient
      destination={destination}
      initialGoal={
        ONBOARDING_GOALS.includes(profileRow?.selectedGoal as OnboardingGoal)
          ? profileRow?.selectedGoal as OnboardingGoal
          : "cut"
      }
      initialForm={{
        name: storedForm.name || user.name,
        email: user.email,
        gender: storedForm.gender || "",
        age: storedForm.age || "",
        height: storedForm.height || "",
        weight: storedForm.weight || "",
        targetWeight: storedForm.targetWeight || "",
        activity: storedForm.activity || "",
      }}
    />
  )
}
