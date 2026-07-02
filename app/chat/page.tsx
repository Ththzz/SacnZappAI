import { redirect } from "next/navigation"

import { getCurrentUser } from "@/lib/auth"
import ChatPageClient from "./ChatPageClient"

export default async function ChatPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/sign-in?next=/chat")
  }

  return <ChatPageClient userName={user.name} />
}
