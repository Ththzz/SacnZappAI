"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

const chunkErrorPattern =
  /ChunkLoadError|Loading chunk .* failed|Failed to fetch dynamically imported module/i

function getErrorMessage(value: unknown) {
  if (value instanceof Error) return `${value.name}: ${value.message}`
  if (typeof value === "string") return value
  return ""
}

export default function ChunkLoadRecovery() {
  const pathname = usePathname()

  useEffect(() => {
    const recoveryKey = `scanzapp.chunk-reload:${pathname}`

    const recover = (value: unknown) => {
      if (!chunkErrorPattern.test(getErrorMessage(value))) return

      try {
        if (window.sessionStorage.getItem(recoveryKey)) return
        window.sessionStorage.setItem(recoveryKey, String(Date.now()))
      } catch {
        // Without a persistent marker, reloading could create an infinite loop.
        return
      }

      window.location.reload()
    }

    const handleError = (event: ErrorEvent) => {
      recover(event.error ?? event.message)
    }
    const handleRejection = (event: PromiseRejectionEvent) => {
      recover(event.reason)
    }

    window.addEventListener("error", handleError)
    window.addEventListener("unhandledrejection", handleRejection)

    const clearRecoveryMarker = window.setTimeout(() => {
      try {
        window.sessionStorage.removeItem(recoveryKey)
      } catch {
        // Ignore unavailable storage after a successful page load.
      }
    }, 10_000)

    return () => {
      window.removeEventListener("error", handleError)
      window.removeEventListener("unhandledrejection", handleRejection)
      window.clearTimeout(clearRecoveryMarker)
    }
  }, [pathname])

  return null
}
