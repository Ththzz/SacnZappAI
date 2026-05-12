export default function Loading() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-6xl items-center justify-center">
      <div className="h-1 w-40 overflow-hidden rounded-full bg-emerald-100">
        <div className="h-full w-1/2 animate-[loadingBar_0.9s_ease-in-out_infinite] rounded-full bg-emerald-500" />
      </div>
    </div>
  )
}
