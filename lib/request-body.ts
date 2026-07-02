export type LimitedJsonResult<T> =
  | { body: T | null }
  | { error: string; status: 413 }

export async function readJsonBodyWithLimit<T>(request: Request, maxBytes: number, tooLargeMessage: string): Promise<LimitedJsonResult<T>> {
  const contentLength = Number(request.headers.get("content-length"))
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return { error: tooLargeMessage, status: 413 }
  }
  if (!request.body) return { body: null }

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    totalBytes += value.byteLength
    if (totalBytes > maxBytes) {
      await reader.cancel()
      return { error: tooLargeMessage, status: 413 }
    }
    chunks.push(value)
  }

  const payload = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    payload.set(chunk, offset)
    offset += chunk.byteLength
  }

  try {
    return { body: JSON.parse(new TextDecoder().decode(payload)) as T }
  } catch {
    return { body: null }
  }
}
