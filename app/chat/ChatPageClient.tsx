"use client"

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Archive,
  Copy,
  ImagePlus,
  LoaderCircle,
  Menu,
  MessageCircleMore,
  MoreHorizontal,
  Pencil,
  Pin,
  Plus,
  Search,
  Send,
  Square,
  Trash2,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

type ConsentItem = {
  scope: string
  grantedAt: string
  uiVersion: string | null
}

type ConversationSummary = {
  id: string
  title: string
  pinned: boolean
  archivedAt: string | null
  updatedAt: string
  preview: string
}

type ChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  status: "pending" | "streaming" | "complete" | "stopped" | "error"
  parentMessageId?: string | null
  clientRequestId?: string | null
  model?: string | null
  finishReason?: string | null
  createdAt?: string
  updatedAt?: string
  provenanceLabels?: string[]
}

type ConversationDetail = {
  conversation: {
    id: string
    title: string
    summary: string | null
    pinned: boolean
    archivedAt: string | null
    updatedAt: string
  }
  messages: ChatMessage[]
  nextCursor: string | null
}

type StreamState = {
  controller: AbortController
  conversationId: string | null
  assistantMessageId: string | null
  localAssistantId: string
}

type FoodAnalysisResult = {
  analysis: {
    isFood: boolean
    reason: string
    name: string
    calories: number
    protein: number
    carbs: number
    fat: number
    confidence: number
    note: string
    mealKind: "main_meal" | "snack"
  }
  contextNote: string
  provenanceLabel: string
}

const optionalConsentScopes = [
  {
    scope: "profile_context",
    title: "โปรไฟล์และเป้าหมาย",
    description: "ใช้เป้าหมาย น้ำหนัก และค่าแคลอรี่เป้าหมายเพื่อให้คำตอบเฉพาะกับคุณมากขึ้น",
  },
  {
    scope: "nutrition_history",
    title: "ประวัติมื้ออาหาร",
    description: "อ้างอิงมื้ออาหารที่บันทึกไว้ล่าสุดแบบสรุปช่วงสั้น ๆ",
  },
  {
    scope: "hydration_history",
    title: "ประวัติการดื่มน้ำ",
    description: "ใช้สรุปการดื่มน้ำล่าสุดเมื่อคำถามเกี่ยวข้อง",
  },
  {
    scope: "image_analysis",
    title: "วิเคราะห์รูปภาพอาหาร",
    description: "ส่งรูปอาหารที่แนบไปวิเคราะห์ก่อนนำมาใช้ประกอบคำตอบในแชต",
  },
] as const

const maxImageSize = 10 * 1024 * 1024
const maxImageUploadSize = 8 * 1024 * 1024
const maxImageDimension = 1600

function parseApiError(data: unknown, fallback: string) {
  if (!data || typeof data !== "object") return fallback
  const record = data as { error?: { message?: string } | string }
  if (typeof record.error === "string") return record.error
  if (record.error && typeof record.error === "object" && typeof record.error.message === "string") {
    return record.error.message
  }
  return fallback
}

function formatUpdatedAt(value: string) {
  const date = new Date(value)
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function readSseBlocks(buffer: string) {
  const blocks = buffer.split("\n\n")
  return {
    complete: blocks.slice(0, -1),
    rest: blocks.at(-1) ?? "",
  }
}

function parseSseEvent(block: string) {
  const lines = block.split(/\r?\n/)
  const event = lines.find((line) => line.startsWith("event:"))?.replace("event:", "").trim() || "message"
  const dataLine = lines.find((line) => line.startsWith("data:"))?.replace("data:", "").trim() || "{}"
  return {
    event,
    data: JSON.parse(dataLine) as Record<string, unknown>,
  }
}

function readFileAsDataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error("ไม่สามารถอ่านรูปภาพได้"))
    reader.readAsDataURL(file)
  })
}

async function optimizeChatImage(file: File): Promise<Blob> {
  if (!("createImageBitmap" in window) || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return file
  }

  let bitmap: ImageBitmap | null = null
  try {
    bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxImageDimension / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext("2d")
    if (!context) return file
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return await new Promise<Blob>((resolve) => {
      canvas.toBlob((blob) => resolve(blob ?? file), "image/jpeg", 0.82)
    })
  } catch {
    return file
  } finally {
    bitmap?.close()
  }
}

export default function ChatPageClient({ userName }: { userName: string }) {
  const [consents, setConsents] = useState<ConsentItem[]>([])
  const [consentLoading, setConsentLoading] = useState(true)
  const [grantingConsent, setGrantingConsent] = useState(false)
  const [savingScopes, setSavingScopes] = useState(false)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [conversationsLoading, setConversationsLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [currentConversation, setCurrentConversation] = useState<ConversationSummary | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [draft, setDraft] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [imageLoading, setImageLoading] = useState(false)
  const [pageError, setPageError] = useState("")
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageFileName, setImageFileName] = useState("")
  const [contextLabels, setContextLabels] = useState<string[]>([])
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false)

  const streamRef = useRef<StreamState | null>(null)
  const copiedTimeoutRef = useRef<number | null>(null)
  const listAbortRef = useRef<AbortController | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const streamFrameRef = useRef<number | null>(null)
  const pendingStreamTextRef = useRef<{ assistantId: string; tempAssistantId: string; text: string } | null>(null)

  const hasChatConsent = consents.some((item) => item.scope === "ai_chat_basic")

  function flushStreamingText() {
    if (streamFrameRef.current !== null) {
      window.cancelAnimationFrame(streamFrameRef.current)
      streamFrameRef.current = null
    }
    const pending = pendingStreamTextRef.current
    pendingStreamTextRef.current = null
    if (!pending?.text) return

    setMessages((current) =>
      current.map((message) =>
        message.id === pending.assistantId || message.id === pending.tempAssistantId
          ? {
              ...message,
              id: pending.assistantId,
              content: `${message.content}${pending.text}`,
              status: "streaming",
            }
          : message,
      ),
    )
  }

  function queueStreamingText(assistantId: string, tempAssistantId: string, text: string) {
    if (!text) return
    const pending = pendingStreamTextRef.current
    if (pending && pending.assistantId === assistantId && pending.tempAssistantId === tempAssistantId) {
      pending.text += text
    } else {
      flushStreamingText()
      pendingStreamTextRef.current = { assistantId, tempAssistantId, text }
    }
    if (streamFrameRef.current === null) {
      streamFrameRef.current = window.requestAnimationFrame(flushStreamingText)
    }
  }

  useEffect(() => {
    setIsReady(true)
    void loadConsent()
    return () => {
      streamRef.current?.controller.abort()
      listAbortRef.current?.abort()
      if (copiedTimeoutRef.current) {
        window.clearTimeout(copiedTimeoutRef.current)
      }
      if (streamFrameRef.current !== null) {
        window.cancelAnimationFrame(streamFrameRef.current)
      }
      pendingStreamTextRef.current = null
    }
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadConversations(query)
    }, query ? 180 : 0)

    return () => window.clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  async function loadConsent() {
    setConsentLoading(true)
    const response = await fetch("/api/chat/consent")
    const data = (await response.json().catch(() => ({}))) as { items?: ConsentItem[] }
    setConsentLoading(false)

    if (!response.ok) {
      setPageError(parseApiError(data, "โหลดการยินยอมไม่สำเร็จ"))
      return
    }

    setConsents(data.items ?? [])
  }

  async function persistConsentScopes(updates: Array<{ scope: string; granted: boolean }>) {
    setSavingScopes(true)
    const response = await fetch("/api/chat/consent", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        updates: updates.map((item) => ({ ...item, uiVersion: "chat-page-v2" })),
      }),
    })
    const data = (await response.json().catch(() => ({}))) as { items?: ConsentItem[] }
    setSavingScopes(false)

    if (!response.ok) {
      setPageError(parseApiError(data, "บันทึก consent ไม่สำเร็จ"))
      return
    }

    setConsents(data.items ?? [])
  }

  async function loadConversations(search: string) {
    listAbortRef.current?.abort()
    const controller = new AbortController()
    listAbortRef.current = controller
    setConversationsLoading(true)

    const url = new URL("/api/chat/conversations", window.location.origin)
    url.searchParams.set("status", "active")
    if (search.trim()) {
      url.searchParams.set("q", search.trim())
    }

    try {
      const response = await fetch(url.toString(), { signal: controller.signal })
      const data = (await response.json().catch(() => ({}))) as { items?: ConversationSummary[] }
      if (!response.ok) {
        throw new Error(parseApiError(data, "โหลดรายการบทสนทนาไม่สำเร็จ"))
      }

      const items = data.items ?? []
      setConversations(items)

      if (!currentConversation && items[0]) {
        await openConversation(items[0].id, items[0])
      }

      if (currentConversation) {
        const nextCurrent = items.find((item) => item.id === currentConversation.id) ?? null
        if (!nextCurrent && items[0]) {
          await openConversation(items[0].id, items[0])
        } else if (!nextCurrent) {
          setCurrentConversation(null)
          setMessages([])
        } else {
          setCurrentConversation(nextCurrent)
        }
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        setPageError(error instanceof Error ? error.message : "โหลดรายการบทสนทนาไม่สำเร็จ")
      }
    } finally {
      setConversationsLoading(false)
    }
  }

  async function openConversation(id: string, summary?: ConversationSummary) {
    setMessagesLoading(true)
    setPageError("")

    try {
      const response = await fetch(`/api/chat/conversations/${id}`)
      const data = (await response.json().catch(() => ({}))) as Partial<ConversationDetail>
      if (!response.ok) {
        throw new Error(parseApiError(data, "โหลดบทสนทนาไม่สำเร็จ"))
      }

      setCurrentConversation(
        summary ?? {
          id: data.conversation?.id || id,
          title: data.conversation?.title || "แชตใหม่",
          pinned: Boolean(data.conversation?.pinned),
          archivedAt: data.conversation?.archivedAt || null,
          updatedAt: data.conversation?.updatedAt || new Date().toISOString(),
          preview: data.conversation?.summary || "",
        },
      )
      setMessages(data.messages ?? [])
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "โหลดบทสนทนาไม่สำเร็จ")
    } finally {
      setMessagesLoading(false)
    }
  }

  async function grantBasicConsent() {
    setGrantingConsent(true)
    await persistConsentScopes([{ scope: "ai_chat_basic", granted: true }])
    setGrantingConsent(false)
  }

  async function patchConversation(payload: Record<string, unknown>) {
    if (!currentConversation) return
    const response = await fetch(`/api/chat/conversations/${currentConversation.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const data = (await response.json().catch(() => ({}))) as Partial<ConversationSummary>
    if (!response.ok) {
      setPageError(parseApiError(data, "อัปเดตบทสนทนาไม่สำเร็จ"))
      return
    }

    setCurrentConversation((value) =>
      value
        ? {
            ...value,
            title: typeof data.title === "string" ? data.title : value.title,
            pinned: typeof data.pinned === "boolean" ? data.pinned : value.pinned,
            archivedAt: typeof data.archivedAt === "string" || data.archivedAt === null ? data.archivedAt : value.archivedAt,
          }
        : value,
    )
    await loadConversations(query)
  }

  async function renameConversation() {
    if (!currentConversation) return
    const title = window.prompt("ตั้งชื่อบทสนทนา", currentConversation.title)?.trim()
    if (!title) return
    await patchConversation({ title })
  }

  async function togglePinConversation() {
    if (!currentConversation) return
    await patchConversation({ pinned: !currentConversation.pinned })
  }

  async function archiveConversation() {
    if (!currentConversation) return
    await patchConversation({ archived: true })
    setCurrentConversation(null)
    setMessages([])
    await loadConversations(query)
  }

  async function deleteConversation(id: string) {
    if (!window.confirm("ลบบทสนทนานี้ใช่ไหมครับ")) return

    const response = await fetch(`/api/chat/conversations/${id}`, { method: "DELETE" })
    if (!response.ok && response.status !== 204) {
      const data = await response.json().catch(() => ({}))
      setPageError(parseApiError(data, "ลบบทสนทนาไม่สำเร็จ"))
      return
    }

    if (currentConversation?.id === id) {
      setCurrentConversation(null)
      setMessages([])
    }
    await loadConversations(query)
  }

  async function copyMessage(messageId: string, content: string) {
    await navigator.clipboard.writeText(content)
    setCopiedMessageId(messageId)
    if (copiedTimeoutRef.current) {
      window.clearTimeout(copiedTimeoutRef.current)
    }
    copiedTimeoutRef.current = window.setTimeout(() => setCopiedMessageId(null), 1200)
  }

  function removeAttachedImage() {
    setImagePreview(null)
    setImageFileName("")
  }

  async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    if (!file.type.startsWith("image/")) {
      setPageError("กรุณาเลือกไฟล์รูปภาพเท่านั้น")
      return
    }

    if (file.size > maxImageSize) {
      setPageError("รูปภาพต้องมีขนาดไม่เกิน 10MB")
      return
    }

    try {
      const optimized = await optimizeChatImage(file)
      if (optimized.size > maxImageUploadSize) {
        setPageError("ไม่สามารถลดขนาดรูปให้ต่ำกว่า 8MB ได้ กรุณาเลือกรูปที่เล็กลง")
        return
      }
      const dataUrl = await readFileAsDataUrl(optimized)
      setImagePreview(dataUrl)
      setImageFileName(file.name)
      setPageError("")
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "แนบรูปภาพไม่สำเร็จ")
    }
  }

  async function stopCurrentGeneration() {
    const active = streamRef.current
    if (!active) return

    if (active.assistantMessageId && active.conversationId) {
      await fetch("/api/chat/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: active.conversationId,
          assistantMessageId: active.assistantMessageId,
        }),
      }).catch(() => undefined)
    }

    active.controller.abort()
    setSubmitting(false)
    setMessages((current) =>
      current.map((message) =>
        message.id === active.localAssistantId || message.id === active.assistantMessageId
          ? { ...message, status: "stopped" }
          : message,
      ),
    )
    streamRef.current = null
  }

  async function handleRetry(messageId: string) {
    const index = messages.findIndex((item) => item.id === messageId)
    if (index < 1) return
    const userMessage = [...messages.slice(0, index)].reverse().find((item) => item.role === "user")
    if (!userMessage?.content) return
    await handleSend(userMessage.content)
  }

  async function analyzeAttachedImage() {
    if (!imagePreview) return null

    const hasImageConsent = consents.some((item) => item.scope === "image_analysis")
    if (!hasImageConsent) {
      throw new Error("หากต้องการแนบรูปในแชต กรุณาเปิด consent การวิเคราะห์รูปภาพก่อน")
    }

    setImageLoading(true)
    const response = await fetch("/api/chat/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: imagePreview }),
    })
    const data = (await response.json().catch(() => ({}))) as Partial<FoodAnalysisResult>
    setImageLoading(false)

    if (!response.ok) {
      throw new Error(parseApiError(data, "วิเคราะห์รูปภาพไม่สำเร็จ"))
    }

    return data as FoodAnalysisResult
  }

  async function handleSend(override?: string) {
    const rawContent = (override ?? draft).trim()
    if ((!rawContent && !imagePreview) || submitting || !hasChatConsent) return

    const previousDraft = draft
    const previousImagePreview = imagePreview
    const previousImageFileName = imageFileName
    const displayContent = rawContent || (imagePreview ? "ช่วยดูรูปอาหารนี้ให้หน่อย" : "")

    setSubmitting(true)
    setPageError("")
    if (!override) setDraft("")

    let imageContextNote = ""
    let localProvenance: string[] = []

    try {
      if (imagePreview) {
        const imageResult = await analyzeAttachedImage()
        imageContextNote = imageResult?.contextNote || ""
        localProvenance = imageResult?.provenanceLabel ? [imageResult.provenanceLabel] : []
      }

      const clientRequestId = crypto.randomUUID()
      const tempUserId = `local-user-${clientRequestId}`
      const tempAssistantId = `local-assistant-${clientRequestId}`
      const now = new Date().toISOString()

      setMessages((current) => [
        ...current,
        {
          id: tempUserId,
          role: "user",
          content: displayContent,
          status: "complete",
          clientRequestId,
          createdAt: now,
        },
        {
          id: tempAssistantId,
          role: "assistant",
          content: "",
          status: "streaming",
          createdAt: now,
          provenanceLabels: localProvenance,
        },
      ])

      const controller = new AbortController()
      streamRef.current = {
        controller,
        conversationId: currentConversation?.id ?? null,
        assistantMessageId: null,
        localAssistantId: tempAssistantId,
      }

      removeAttachedImage()
      setContextLabels(localProvenance)

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: currentConversation?.id,
          message: displayContent,
          clientRequestId,
          contextNote: imageContextNote || undefined,
        }),
        signal: controller.signal,
      })

      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({}))
        throw new Error(parseApiError(data, "ส่งข้อความไม่สำเร็จ"))
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const blocks = readSseBlocks(buffer)
        buffer = blocks.rest

        for (const block of blocks.complete) {
          if (!block.trim()) continue
          const { event, data } = parseSseEvent(block)

          if (event === "meta") {
            const nextConversationId = typeof data.conversationId === "string" ? data.conversationId : currentConversation?.id ?? null
            const assistantMessageId = typeof data.assistantMessageId === "string" ? data.assistantMessageId : tempAssistantId
            streamRef.current = {
              controller,
              conversationId: nextConversationId,
              assistantMessageId,
              localAssistantId: tempAssistantId,
            }
            setCurrentConversation((value) =>
              value ?? {
                id: nextConversationId || "pending",
                title: displayContent.slice(0, 60),
                pinned: false,
                archivedAt: null,
                updatedAt: now,
                preview: "",
              },
            )
            setMessages((current) =>
              current.map((message) =>
                message.id === tempAssistantId ? { ...message, id: assistantMessageId, status: "streaming" } : message,
              ),
            )
          }

          if (event === "delta") {
            const text = typeof data.text === "string" ? data.text : ""
            const assistantId = streamRef.current?.assistantMessageId ?? tempAssistantId
            queueStreamingText(assistantId, tempAssistantId, text)
          }

          if (event === "done") {
            flushStreamingText()
            const assistantId = streamRef.current?.assistantMessageId ?? tempAssistantId
            const provenance = Array.isArray(data.provenance)
              ? data.provenance.filter((item): item is string => typeof item === "string")
              : localProvenance
            setContextLabels(provenance)
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId || message.id === tempAssistantId
                  ? {
                      ...message,
                      id: assistantId,
                      status: "complete",
                      finishReason: typeof data.finishReason === "string" ? data.finishReason : "stop",
                      provenanceLabels: provenance,
                    }
                  : message,
              ),
            )
          }

          if (event === "error") {
            flushStreamingText()
            const assistantId = streamRef.current?.assistantMessageId ?? tempAssistantId
            const message = typeof data.message === "string" ? data.message : "เกิดข้อผิดพลาดระหว่างตอบ"
            setMessages((current) =>
              current.map((item) =>
                item.id === assistantId || item.id === tempAssistantId
                  ? {
                      ...item,
                      id: assistantId,
                      content: item.content || message,
                      status: data.code === "GENERATION_STOPPED" ? "stopped" : "error",
                      provenanceLabels: localProvenance,
                    }
                  : item,
              ),
            )
            setPageError(data.code === "GENERATION_STOPPED" ? "" : message)
          }
        }
      }

    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        const message = error instanceof Error ? error.message : "ส่งข้อความไม่สำเร็จ"
        setPageError(message)
        if (!override) {
          setDraft(previousDraft)
        }
        setImagePreview(previousImagePreview)
        setImageFileName(previousImageFileName)
      }
    } finally {
      flushStreamingText()
      streamRef.current = null
      setSubmitting(false)
      setImageLoading(false)
      await loadConversations(query)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void handleSend()
  }

  const selectedConversationId = currentConversation?.id
  const activeOptionalScopes = optionalConsentScopes.filter((item) => consents.some((consent) => consent.scope === item.scope))
  const currentContextSummary = [
    ...activeOptionalScopes
      .filter((item) => item.scope !== "image_analysis")
      .map((item) => item.title),
    ...(imagePreview ? ["ภาพอาหารที่แนบ"] : []),
  ]

  return (
    <section className="overflow-hidden bg-white">
      <div className="grid h-dvh min-h-0 grid-rows-[auto_minmax(0,1fr)] lg:min-h-[640px] lg:grid-cols-[270px_minmax(0,1fr)] lg:grid-rows-1">
        <aside
          className="relative z-40 flex h-14 min-h-0 flex-col overflow-visible border-b border-neutral-200 bg-[#f7f7f8] lg:h-auto lg:max-h-none lg:overflow-hidden lg:border-r lg:border-b-0"
        >
          <div className="flex h-14 shrink-0 items-center justify-between gap-2 px-3 lg:hidden">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
                <MessageCircleMore className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold text-neutral-900">ScanZapp AI</p>
                <p className="truncate text-[11px] text-neutral-500">สวัสดี {userName}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="เริ่มแชตใหม่"
                onClick={() => {
                  setCurrentConversation(null)
                  setMessages([])
                  setPageError("")
                  setMobileHistoryOpen(false)
                }}
                className="rounded-full"
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={mobileHistoryOpen ? "ปิดประวัติแชต" : "เปิดประวัติแชต"}
                aria-expanded={mobileHistoryOpen}
                onClick={() => setMobileHistoryOpen((open) => !open)}
                className="rounded-full"
              >
                <Menu className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className={`${mobileHistoryOpen ? "flex" : "hidden"} absolute inset-x-0 top-14 max-h-[min(70dvh,32rem)] min-h-0 flex-col border-b border-neutral-200 bg-[#f7f7f8] shadow-xl lg:static lg:flex lg:max-h-none lg:flex-1 lg:border-b-0 lg:shadow-none`}>
          <div className="p-3">
            <div className="mb-3 hidden items-center gap-3 px-2 py-2 lg:flex">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white">
                <MessageCircleMore className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold text-neutral-900">ScanZapp AI</p>
                <p className="truncate text-xs text-neutral-500">สวัสดี {userName}</p>
              </div>
            </div>

            <Button
              type="button"
              onClick={() => {
                setCurrentConversation(null)
                setMessages([])
                setPageError("")
              }}
              className="hidden h-11 w-full justify-start rounded-xl bg-neutral-900 px-3 text-white hover:bg-neutral-800 lg:flex"
            >
              <Plus className="h-4 w-4" />
              แชตใหม่
            </Button>

            <div className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 lg:mt-3">
              <Search className="h-4 w-4 text-neutral-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ค้นหาแชต"
                className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-400"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-3">
            {conversationsLoading ? (
              <div className="flex items-center gap-2 px-3 py-4 text-sm text-neutral-500">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                กำลังโหลด
              </div>
            ) : conversations.length === 0 ? (
              <p className="px-3 py-4 text-xs leading-5 text-neutral-500">บทสนทนาจะปรากฏที่นี่หลังส่งข้อความแรก</p>
            ) : (
              conversations.map((conversation) => {
                const active = selectedConversationId === conversation.id
                return (
                  <div
                    key={conversation.id}
                    className={`group flex items-center gap-1 rounded-xl px-2 py-1.5 ${
                      active ? "bg-white shadow-sm" : "hover:bg-neutral-200/60"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setMobileHistoryOpen(false)
                        void openConversation(conversation.id, conversation)
                      }}
                      className="min-w-0 flex-1 px-1 py-1.5 text-left"
                    >
                      <p className="truncate text-sm font-semibold text-neutral-800">
                        {conversation.pinned ? "📌 " : ""}
                        {conversation.title}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-neutral-400">{formatUpdatedAt(conversation.updatedAt)}</p>
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`ลบ ${conversation.title}`}
                      onClick={() => void deleteConversation(conversation.id)}
                      className="opacity-50 hover:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )
              })
            )}
          </div>
          <div className="border-t border-neutral-200 p-2">
            <Link
              href="/"
              className="flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-neutral-600 transition-colors hover:bg-white hover:text-neutral-900"
            >
              <ArrowLeft className="h-4 w-4" />
              กลับแดชบอร์ด
            </Link>
          </div>
          </div>
        </aside>

        <div className="flex min-h-0 flex-col bg-white">
          <header className="flex h-16 shrink-0 items-center justify-between border-b border-neutral-100 px-4 sm:px-6">
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold text-neutral-900">
                {currentConversation?.title || "ScanZapp AI"}
              </h1>
              <p className="text-xs text-neutral-400">ผู้ช่วยด้านอาหารและสุขภาพทั่วไป</p>
            </div>

            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="เปลี่ยนชื่อ"
                title="เปลี่ยนชื่อ"
                onClick={() => void renameConversation()}
                disabled={!currentConversation}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={currentConversation?.pinned ? "เลิกปักหมุด" : "ปักหมุด"}
                title={currentConversation?.pinned ? "เลิกปักหมุด" : "ปักหมุด"}
                onClick={() => void togglePinConversation()}
                disabled={!currentConversation}
              >
                <Pin className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="เก็บบทสนทนา"
                title="เก็บบทสนทนา"
                onClick={() => void archiveConversation()}
                disabled={!currentConversation}
              >
                <Archive className="h-4 w-4" />
              </Button>
            </div>
          </header>

          {!hasChatConsent ? (
            <div className="flex flex-1 items-center justify-center overflow-y-auto p-6">
              <div className="w-full max-w-lg text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-100">
                  <MessageCircleMore className="h-7 w-7" />
                </span>
                <h2 className="mt-5 text-2xl font-black text-neutral-950">เริ่มคุยกับ ScanZapp AI</h2>
                <p className="mt-3 text-sm leading-6 text-neutral-500">
                  ระบบจะส่งข้อความที่คุณพิมพ์ให้ AI เพื่อให้คำแนะนำทั่วไปด้านอาหารและพฤติกรรมสุขภาพ
                  ไม่ใช่การวินิจฉัยหรือการรักษา และคุณเพิกถอนความยินยอมได้ภายหลัง
                </p>
                {pageError && <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">{pageError}</p>}
                <Button
                  type="button"
                  onClick={() => void grantBasicConsent()}
                  disabled={grantingConsent || consentLoading}
                  className="mt-6 h-12 rounded-2xl bg-emerald-600 px-6 text-white hover:bg-emerald-700"
                >
                  {grantingConsent ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  ยินยอมและเริ่มใช้งาน
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 py-6 sm:px-6">
                  <details className="mb-5 rounded-2xl border border-neutral-200 bg-neutral-50/70 px-4 py-3">
                    <summary className="cursor-pointer text-sm font-semibold text-neutral-700">
                      ข้อมูลที่อนุญาตให้ AI ใช้
                      {savingScopes && <LoaderCircle className="ml-2 inline h-3.5 w-3.5 animate-spin" />}
                    </summary>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {optionalConsentScopes.map((item) => {
                        const checked = consents.some((consent) => consent.scope === item.scope)
                        return (
                          <label key={item.scope} className="flex cursor-pointer items-start gap-2 rounded-xl bg-white p-3">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={savingScopes}
                              onChange={() => void persistConsentScopes([{ scope: item.scope, granted: !checked }])}
                              className="mt-1 h-4 w-4 rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            <span>
                              <span className="block text-xs font-bold text-neutral-800">{item.title}</span>
                              <span className="mt-1 block text-[11px] leading-4 text-neutral-500">{item.description}</span>
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </details>

                  {messagesLoading ? (
                    <div className="flex flex-1 items-center justify-center gap-2 text-sm text-neutral-500">
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      กำลังโหลดข้อความ
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-1 flex-col items-center justify-center pb-10 text-center">
                      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white">
                        <MessageCircleMore className="h-7 w-7" />
                      </span>
                      <h2 className="mt-5 text-2xl font-black text-neutral-950">วันนี้อยากดูแลสุขภาพเรื่องไหน?</h2>
                      <p className="mt-2 max-w-md text-sm leading-6 text-neutral-500">
                        ถามเรื่องมื้ออาหาร โภชนาการ การดื่มน้ำ หรือเป้าหมายสุขภาพได้เลย
                      </p>
                      <div className="mt-6 grid w-full max-w-xl gap-2 sm:grid-cols-2">
                        {[
                          "ช่วยวางแผนมื้ออาหารวันนี้",
                          "วันนี้ควรกินโปรตีนเท่าไร?",
                          "แนะนำของว่างแคลอรี่ไม่สูง",
                          "ช่วยดูพฤติกรรมการดื่มน้ำ",
                        ].map((suggestion) => (
                          <button
                            key={suggestion}
                            type="button"
                            onClick={() => setDraft(suggestion)}
                            className="rounded-2xl border border-neutral-200 px-4 py-3 text-left text-sm font-medium text-neutral-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-7 pb-4">
                      {messages.map((message) => {
                        const isAssistant = message.role === "assistant"
                        return (
                          <article key={message.id} className={isAssistant ? "flex gap-3" : "flex justify-end"}>
                            {isAssistant && (
                              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                                <MessageCircleMore className="h-4 w-4" />
                              </span>
                            )}
                            <div
                              className={
                                isAssistant
                                  ? "min-w-0 max-w-[calc(100%-2.75rem)] flex-1"
                                  : "max-w-[85%] rounded-3xl bg-neutral-100 px-4 py-3 text-neutral-900"
                              }
                            >
                              {isAssistant && <p className="mb-1 text-sm font-bold text-neutral-900">ScanZapp AI</p>}
                              <p className="whitespace-pre-wrap text-sm leading-7 text-neutral-700">
                                {message.content ||
                                  (message.status === "streaming"
                                    ? "กำลังคิด..."
                                    : message.status === "stopped"
                                      ? "หยุดการตอบแล้ว"
                                      : "ยังไม่มีคำตอบ")}
                              </p>

                              {isAssistant && (
                                <div className="mt-2 flex flex-wrap items-center gap-1 text-neutral-400">
                                  {message.status === "streaming" && <LoaderCircle className="h-3.5 w-3.5 animate-spin text-emerald-600" />}
                                  {(message.provenanceLabels?.length ?? 0) > 0 &&
                                    message.provenanceLabels?.map((label) => (
                                      <span key={label} className="rounded-full bg-neutral-100 px-2 py-1 text-[10px] text-neutral-500">
                                        อ้างอิง {label}
                                      </span>
                                    ))}
                                  {message.content && (
                                    <Button type="button" variant="ghost" size="icon-sm" aria-label="คัดลอกคำตอบ" onClick={() => void copyMessage(message.id, message.content)}>
                                      <Copy className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                  <Button type="button" variant="ghost" size="icon-sm" aria-label="ลองตอบใหม่" onClick={() => void handleRetry(message.id)} disabled={submitting}>
                                    <MoreHorizontal className="h-3.5 w-3.5" />
                                  </Button>
                                  {copiedMessageId === message.id && <span className="text-[10px] text-emerald-600">คัดลอกแล้ว</span>}
                                </div>
                              )}
                            </div>
                          </article>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="shrink-0 bg-gradient-to-t from-white via-white to-white/70 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2 sm:px-6 sm:pb-4">
                <form className="mx-auto max-w-3xl" onSubmit={handleSubmit}>
                  {pageError && (
                    <div className="mb-2 flex items-center justify-between gap-3 rounded-xl bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-600">
                      <span>{pageError}</span>
                      <button type="button" onClick={() => setPageError("")} aria-label="ปิดข้อความผิดพลาด">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}

                  <div className="rounded-[28px] border border-neutral-200 bg-white p-2 shadow-[0_8px_30px_rgba(0,0,0,0.08)] focus-within:border-neutral-300">
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
                      className="hidden"
                      onChange={(event) => void handleImageChange(event)}
                    />

                    {imagePreview && (
                      <div className="m-1 flex items-center justify-between gap-3 rounded-2xl bg-emerald-50 p-3">
                        <div className="flex min-w-0 items-center gap-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={imagePreview} alt="ตัวอย่างรูปที่แนบ" className="h-14 w-14 rounded-xl object-cover" />
                          <p className="truncate text-xs font-semibold text-neutral-700">{imageFileName || "รูปภาพอาหาร"}</p>
                        </div>
                        <button type="button" onClick={removeAttachedImage} className="rounded-full p-2 hover:bg-white" aria-label="ลบรูปที่แนบ">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )}

                    <Textarea
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      rows={1}
                      placeholder="ส่งข้อความถึง ScanZapp AI"
                      className="min-h-11 max-h-32 resize-none border-0 px-3 py-2 text-[15px] leading-6 shadow-none focus-visible:ring-0 sm:min-h-[54px]"
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault()
                          void handleSend()
                        }
                      }}
                    />

                    <div className="flex items-center justify-between px-1 pb-1">
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="แนบรูป"
                          title="แนบรูป"
                          onClick={() => imageInputRef.current?.click()}
                          disabled={submitting || imageLoading}
                          className="rounded-full"
                        >
                          {imageLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                        </Button>
                        {(contextLabels.length > 0 || currentContextSummary.length > 0) && (
                          <span className="hidden text-[11px] text-neutral-400 sm:inline">
                            ใช้บริบท {(contextLabels.length > 0 ? contextLabels : currentContextSummary).join(", ")}
                          </span>
                        )}
                      </div>

                      {submitting ? (
                        <Button type="button" size="icon" aria-label="หยุดการตอบ" onClick={() => void stopCurrentGeneration()} className="rounded-full bg-neutral-900 text-white hover:bg-neutral-700">
                          <Square className="h-4 w-4 fill-current" />
                        </Button>
                      ) : (
                        <Button
                          type="submit"
                          size="icon"
                          aria-label="ส่งข้อความ"
                          disabled={imageLoading || (!draft.trim() && !imagePreview) || !isReady}
                          className="rounded-full bg-neutral-900 text-white hover:bg-neutral-700"
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 text-center text-[11px] text-neutral-400">
                    AI อาจให้ข้อมูลคลาดเคลื่อนได้ โปรดตรวจสอบข้อมูลสำคัญเสมอ
                  </p>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
