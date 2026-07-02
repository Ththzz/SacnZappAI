const activeChatControllers = new Map<string, AbortController>()

export function createChatAbortController(assistantMessageId: string) {
  const controller = new AbortController()
  activeChatControllers.set(assistantMessageId, controller)
  return controller
}

export function getChatAbortSignal(assistantMessageId: string) {
  return activeChatControllers.get(assistantMessageId)?.signal
}

export function stopActiveChat(assistantMessageId: string) {
  const controller = activeChatControllers.get(assistantMessageId)
  if (!controller) return false
  controller.abort()
  activeChatControllers.delete(assistantMessageId)
  return true
}

export function clearActiveChat(assistantMessageId: string) {
  activeChatControllers.delete(assistantMessageId)
}
