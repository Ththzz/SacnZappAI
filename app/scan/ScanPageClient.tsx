'use client'

import { ChangeEvent, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import {
  ActivityIcon,
  AlertCircleIcon,
  CameraIcon,
  CheckIcon,
  ChevronRightIcon,
  LoaderCircleIcon,
  SaveIcon,
  UploadCloudIcon,
  XIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { addMealEntry } from '@/lib/user-data'

type ScanResult = {
  name: string
  calories: number
  protein: number
  carbs: number
  fat: number
  confidence: number
  note?: string
}

type ApiResult = ScanResult & {
  isFood: boolean
  reason?: string
}

const macroItems = [
  { key: 'protein', label: 'Protein', unit: 'g', color: 'bg-emerald-500', soft: 'bg-emerald-50 text-emerald-700' },
  { key: 'carbs', label: 'Carb', unit: 'g', color: 'bg-sky-500', soft: 'bg-sky-50 text-sky-700' },
  { key: 'fat', label: 'Fat', unit: 'g', color: 'bg-amber-500', soft: 'bg-amber-50 text-amber-700' },
] as const

type ProcessingStepStatus = 'done' | 'active' | 'pending'

const processingSteps = [
  { label: 'รับรูปภาพ', caption: 'เตรียมรูปสำหรับส่งวิเคราะห์', startsAt: 0 },
  { label: 'ตรวจจับวัตถุ', caption: 'แยกอาหารออกจากฉากหลัง', startsAt: 700 },
  { label: 'วิเคราะห์อาหาร', caption: 'ระบุเมนูและส่วนประกอบหลัก', startsAt: 1700 },
  { label: 'คำนวณโภชนาการ', caption: 'ประเมินแคลอรี่และมาโคร', startsAt: 3000 },
  { label: 'สร้างรายงาน', caption: 'จัดรูปแบบผลลัพธ์ให้พร้อมบันทึก', startsAt: 4400 },
] as const

const maxFileSize = 10 * 1024 * 1024
const modelLabel = process.env.NEXT_PUBLIC_GEMINI_MODEL?.trim() || 'gemini-2.5-flash'

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('ไม่สามารถอ่านรูปภาพได้'))
    reader.readAsDataURL(file)
  })
}

function getFriendlyScanError(message?: string) {
  if (!message) return 'วิเคราะห์รูปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'

  const normalized = message.toLowerCase()
  const modelIsBusy =
    normalized.includes('high demand') ||
    normalized.includes('try again later') ||
    normalized.includes('overloaded') ||
    normalized.includes('rate limit') ||
    normalized.includes('temporarily unavailable') ||
    normalized.includes('unavailable')

  if (modelIsBusy) {
    return 'ระบบวิเคราะห์กำลังมีผู้ใช้งานเยอะ กรุณารอสักครู่แล้วลองสแกนใหม่อีกครั้ง'
  }

  return message
}

export default function ScanPageClient() {
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [scanning, setScanning] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const hasResult = Boolean(result)
  const isProcessing = scanning && Boolean(preview) && !hasResult

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCameraReady(false)
    setCameraOpen(false)
  }

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  const analyzeDataUrl = async (image: string) => {
    setError(null)
    setResult(null)
    setPreview(image)
    setSaved(false)
    setScanning(true)

    try {
      const response = await fetch('/api/scan-food', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image }),
      })
      const data = (await response.json()) as Partial<ApiResult> & { error?: string }

      if (!response.ok) {
        throw new Error(getFriendlyScanError(data.error))
      }

      if (!data.isFood) {
        setPreview(null)
        setError(data.reason ?? 'ภาพนี้ไม่ใช่อาหาร กรุณาเลือกรูปอาหารเพื่อสแกน')
        return
      }

      setResult({
        name: data.name ?? 'อาหารไม่ทราบชื่อ',
        calories: data.calories ?? 0,
        protein: data.protein ?? 0,
        carbs: data.carbs ?? 0,
        fat: data.fat ?? 0,
        confidence: data.confidence ?? 0,
        note: data.note,
      })
    } catch (scanError) {
      setPreview(null)
      setError(getFriendlyScanError(scanError instanceof Error ? scanError.message : undefined))
    } finally {
      setScanning(false)
    }
  }

  const analyzeImage = async (file: File) => {
    setError(null)
    setResult(null)

    if (!file.type.startsWith('image/')) {
      setPreview(null)
      setError('กรุณาเลือกไฟล์รูปภาพเท่านั้น')
      return
    }

    if (file.size > maxFileSize) {
      setPreview(null)
      setError('รูปภาพต้องมีขนาดไม่เกิน 10MB')
      return
    }

    const image = await readFileAsDataUrl(file)
    await analyzeDataUrl(image)
  }

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    stopCamera()
    await analyzeImage(file)
  }

  const openUpload = () => uploadInputRef.current?.click()

  const openCamera = async () => {
    setError(null)
    setResult(null)
    setPreview(null)
    setCameraOpen(true)
    setCameraReady(false)

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraOpen(false)
      setError('เบราว์เซอร์นี้ไม่รองรับการเปิดกล้อง กรุณาใช้อัปโหลดรูปแทน')
      return
    }

    try {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
      })

      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraReady(true)
    } catch {
      setCameraOpen(false)
      setError('ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตการใช้กล้องหรือใช้อัปโหลดรูปแทน')
    }
  }

  const capturePhoto = async () => {
    const video = videoRef.current
    const canvas = canvasRef.current

    if (!video || !canvas || video.videoWidth === 0 || video.videoHeight === 0) {
      setError('กล้องยังไม่พร้อม กรุณาลองอีกครั้ง')
      return
    }

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    if (!context) {
      setError('ไม่สามารถถ่ายภาพจากกล้องได้')
      return
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    const image = canvas.toDataURL('image/jpeg', 0.9)
    stopCamera()
    await analyzeDataUrl(image)
  }

  const saveScanResult = () => {
    if (!result) return
    const now = new Date()
    addMealEntry({
      id: `scan-${now.getTime()}`,
      name: result.name,
      calories: result.calories,
      protein: result.protein,
      carbs: result.carbs,
      fat: result.fat,
      confidence: result.confidence,
      note: result.note,
      time: now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }),
      date: now.toISOString().slice(0, 10),
      source: 'scan',
    })
    setSaved(true)
  }

  return (
    <div
      className={`mx-auto flex min-h-[calc(100vh-7rem)] w-full flex-col transition-all duration-700 ease-out ${
        hasResult ? 'max-w-6xl justify-start gap-5 pt-3' : isProcessing ? 'max-w-6xl justify-center' : 'max-w-3xl justify-center'
      }`}
    >
      <input ref={uploadInputRef} className="sr-only" type="file" accept="image/*" onChange={handleFileChange} />
      <canvas ref={canvasRef} className="hidden" />

      {isProcessing && preview && <ScanProcessingView preview={preview} />}

      {!hasResult && !isProcessing && (
        <section className="mx-auto w-full max-w-xl animate-[resultIn_.45s_ease-out_both] rounded-[2rem] border border-emerald-100 bg-white p-7 shadow-sm shadow-emerald-950/5">
          <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-white p-6">
            {cameraOpen ? (
              <div className="w-full">
                <div className="relative aspect-[4/3] overflow-hidden rounded-[1.25rem] bg-neutral-950">
                  <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
                  {!cameraReady && (
                    <div className="absolute inset-0 flex items-center justify-center bg-neutral-950/70 text-white">
                      <LoaderCircleIcon className="mr-2 size-5 animate-spin" />
                      กำลังเปิดกล้อง
                    </div>
                  )}
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Button className="h-12 rounded-full bg-emerald-600 text-white hover:bg-emerald-700" onClick={capturePhoto} disabled={!cameraReady || scanning}>
                    <CameraIcon className="size-4" />
                    ถ่ายรูป
                  </Button>
                  <Button variant="outline" className="h-12 rounded-full border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={stopCamera} disabled={scanning}>
                    <XIcon className="size-4" />
                    ยกเลิก
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div
                  className={`mb-8 flex size-20 items-center justify-center rounded-3xl shadow-lg transition-all duration-500 ${
                    scanning ? 'scale-105 bg-white text-emerald-600 shadow-emerald-500/15' : 'bg-emerald-600 text-white shadow-emerald-600/20'
                  }`}
                >
                  {scanning ? <LoaderCircleIcon className="size-10 animate-spin" /> : <CameraIcon className="size-10" />}
                </div>

                <div className="grid w-full max-w-sm gap-3 sm:grid-cols-2">
                  <Button className="h-12 rounded-full bg-emerald-600 text-white hover:bg-emerald-700" onClick={openCamera} disabled={scanning}>
                    <CameraIcon className="size-4" />
                    {scanning ? 'กำลังสแกน' : 'สแกน'}
                  </Button>
                  <Button
                    variant="outline"
                    className="h-12 rounded-full border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    onClick={openUpload}
                    disabled={scanning}
                  >
                    <UploadCloudIcon className="size-4" />
                    อัปโหลดรูป
                  </Button>
                </div>
              </>
            )}

            {scanning && (
              <div className="mt-6 flex items-center gap-2 text-sm font-medium text-emerald-700">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                </span>
                {`กำลังวิเคราะห์ด้วย ${modelLabel}`}
              </div>
            )}

            {error && (
              <div className="mt-6 flex max-w-sm items-start gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
        </section>
      )}

      {result && preview && (
        <>
          <section className="grid gap-5 transition-all duration-700 ease-out lg:grid-cols-[1.05fr_0.95fr]">
            <div className="animate-[resultIn_.5s_ease-out_both] rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm shadow-emerald-950/5">
              <div className="relative aspect-[4/3] overflow-hidden rounded-[1.5rem] bg-emerald-50">
                <Image className="object-cover" src={preview} alt="รูปอาหารที่สแกน" fill sizes="(max-width: 1024px) 100vw, 52vw" unoptimized />
                {scanning && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                    <LoaderCircleIcon className="size-10 animate-spin text-emerald-600" />
                  </div>
                )}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Button className="h-11 rounded-full bg-emerald-600 text-white hover:bg-emerald-700" onClick={openCamera} disabled={scanning}>
                  <CameraIcon className="size-4" />
                  สแกนใหม่
                </Button>
                <Button
                  variant="outline"
                  className="h-11 rounded-full border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  onClick={openUpload}
                  disabled={scanning}
                >
                  <UploadCloudIcon className="size-4" />
                  อัปโหลดใหม่
                </Button>
              </div>
            </div>

            <aside className="animate-[resultIn_.55s_ease-out_both] rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm shadow-emerald-950/5">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-emerald-600">AI Result</p>
                  <h2 className="mt-1 text-xl font-bold text-neutral-950">ผลการวิเคราะห์</h2>
                </div>
                <div className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  <CheckIcon className="size-3.5" />
                  ความมั่นใจ {result.confidence}%
                </div>
              </div>

              <div className="flex items-center gap-4">
                <Image
                  className="size-20 rounded-2xl bg-emerald-50 object-cover shadow-inner ring-1 ring-emerald-100"
                  src={preview}
                  alt="รูปอาหารที่สแกน"
                  width={80}
                  height={80}
                  unoptimized
                />
                <div>
                  <h3 className="text-2xl font-bold text-neutral-950">{result.name}</h3>
                  <p className="mt-1 text-sm text-neutral-500">
                    ประมาณ <span className="font-semibold text-orange-500">{result.calories} kcal</span> / จาน
                  </p>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-3 gap-3">
                {macroItems.map((item) => (
                  <div key={item.key} className={`rounded-2xl p-3 ${item.soft}`}>
                    <p className="text-xl font-bold">
                      {result[item.key]}
                      <span className="ml-0.5 text-xs">{item.unit}</span>
                    </p>
                    <p className="mt-1 text-xs font-medium text-neutral-500">{item.label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 space-y-4">
                <div className="flex items-center gap-2 text-sm font-bold text-neutral-900">
                  <ActivityIcon className="size-4 text-emerald-600" />
                  สารอาหารหลัก
                </div>
                {macroItems.map((item) => {
                  const value = result[item.key]
                  const max = item.key === 'protein' ? 50 : item.key === 'carbs' ? 120 : 40
                  const width = Math.min((value / max) * 100, 100)

                  return (
                    <div key={item.key} className="grid grid-cols-[72px_1fr_48px] items-center gap-3 text-sm">
                      <span className="text-neutral-500">{item.label}</span>
                      <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
                        <div className={`h-full rounded-full ${item.color}`} style={{ width: `${width}%` }} />
                      </div>
                      <span className="text-right font-semibold text-neutral-700">
                        {value}
                        {item.unit}
                      </span>
                    </div>
                  )
                })}
              </div>

              {result.note && <p className="mt-5 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{result.note}</p>}

              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <Button className="h-11 rounded-full bg-emerald-600 text-white hover:bg-emerald-700" onClick={saveScanResult}>
                  <SaveIcon className="size-4" />
                  {saved ? 'บันทึกแล้ว' : 'บันทึกข้อมูล'}
                </Button>
                <Button variant="outline" className="h-11 rounded-full border-emerald-100 text-emerald-700 hover:bg-emerald-50">
                  ดูรายละเอียด
                  <ChevronRightIcon className="size-4" />
                </Button>
              </div>
            </aside>
          </section>

          <section className="animate-[resultIn_.65s_ease-out_.08s_both] grid gap-4 md:grid-cols-3">
            {[
              { title: 'พลังงานมื้อนี้', value: `${result.calories} kcal`, detail: 'บันทึกจากภาพอาหารล่าสุด' },
              { title: 'คุณภาพข้อมูล', value: `${result.confidence}%`, detail: `ประเมินโดย ${modelLabel}` },
              { title: 'คำแนะนำ', value: result.protein >= 15 ? 'โปรตีนดี' : 'เพิ่มโปรตีน', detail: 'ตรวจสอบส่วนประกอบจริงก่อนบันทึก' },
            ].map((card) => (
              <div key={card.title} className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm shadow-emerald-950/5">
                <p className="text-sm text-neutral-500">{card.title}</p>
                <p className="mt-2 text-xl font-bold text-neutral-950">{card.value}</p>
                <p className="mt-1 text-sm text-emerald-700">{card.detail}</p>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  )
}

function ScanProcessingView({ preview }: { preview: string }) {
  const [elapsedMs, setElapsedMs] = useState(0)

  useEffect(() => {
    const startedAt = Date.now()
    const timer = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAt)
    }, 180)

    return () => window.clearInterval(timer)
  }, [])

  const activeStepIndex = processingSteps.reduce((currentIndex, step, index) => {
    return elapsedMs >= step.startsAt ? index : currentIndex
  }, 0)
  const progress = Math.min(92, Math.max(12, Math.round(12 + (elapsedMs / 5600) * 80)))

  return (
    <section className="mx-auto w-full animate-[resultIn_.45s_ease-out_both] rounded-[2rem] bg-white p-5 shadow-sm shadow-emerald-950/5 ring-1 ring-black/5 sm:p-6">
      <div className="grid min-h-[560px] gap-6 lg:grid-cols-[minmax(0,1.25fr)_380px]">
        <div className="flex flex-col">
          <div className="relative min-h-[390px] flex-1 overflow-hidden rounded-[1.75rem] bg-neutral-100">
            <Image src={preview} alt="รูปที่กำลังสแกน" fill className="object-cover" sizes="(max-width: 1024px) 100vw, 720px" unoptimized />
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/35" />
            <div className="absolute inset-x-8 top-0 h-20 animate-[scanFood_2.35s_ease-in-out_infinite]">
              <div className="absolute inset-x-0 top-10 h-px bg-emerald-300 shadow-[0_0_24px_rgba(46,199,143,0.85)]" />
              <div className="absolute inset-x-0 top-10 h-16 bg-gradient-to-b from-emerald-300/20 to-transparent" />
            </div>
            <div className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-extrabold text-emerald-600 shadow-sm backdrop-blur">
              <LoaderCircleIcon className="size-4 animate-spin" />
              AI Processing
            </div>
            <p className="absolute bottom-5 left-5 right-5 text-sm font-semibold text-white drop-shadow">
              {processingSteps[activeStepIndex].caption}
            </p>
          </div>

          <div className="mt-4 h-10 overflow-hidden rounded-full bg-neutral-100">
            <div
              className="flex h-full items-center justify-center rounded-full bg-[#2EC78F] text-sm font-extrabold text-neutral-950 transition-[width] duration-300"
              style={{ width: `${progress}%` }}
            >
              {progress}%
            </div>
          </div>
        </div>

        <aside className="flex flex-col justify-center">
          <p className="text-sm font-medium text-neutral-400">07 · AI Processing</p>
          <h1 className="mt-1 text-2xl font-extrabold text-neutral-950">กำลังวิเคราะห์...</h1>
          <p className="mt-2 text-sm font-medium leading-6 text-neutral-500">
            ระบบกำลังประมวลผลรูปจริงที่คุณถ่ายหรืออัปโหลด และจะเปลี่ยนไปหน้าผลลัพธ์ทันทีเมื่อ API วิเคราะห์เสร็จ
          </p>

          <h2 className="mb-4 mt-8 text-sm font-extrabold text-neutral-950">ขั้นตอนการวิเคราะห์</h2>
          <div className="space-y-2.5">
            {processingSteps.map((step, index) => {
              const status: ProcessingStepStatus = index < activeStepIndex ? 'done' : index === activeStepIndex ? 'active' : 'pending'

              return (
              <div
                key={step.label}
                className={`grid grid-cols-[28px_1fr_auto] items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold ${
                  status === 'active' ? 'bg-emerald-50 text-orange-500' : 'bg-neutral-50 text-neutral-400'
                }`}
              >
                <StepStatusIcon status={status} />
                <span className={status === 'done' ? 'text-[#2EC78F]' : ''}>{step.label}</span>
                <span className={status === 'done' ? 'text-[#2EC78F]' : status === 'active' ? 'text-orange-400' : 'text-neutral-400'}>
                  {status === 'done' ? 'เสร็จสิ้น' : status === 'active' ? 'กำลังดำเนินการ...' : 'รอ'}
                </span>
              </div>
              )
            })}
          </div>
        </aside>
      </div>
    </section>
  )
}

function StepStatusIcon({ status }: { status: ProcessingStepStatus }) {
  if (status === 'done') {
    return (
      <span className="flex size-6 items-center justify-center rounded-full bg-[#2EC78F] text-white">
        <CheckIcon className="size-3.5" />
      </span>
    )
  }

  if (status === 'active') {
    return (
      <span className="flex size-6 items-center justify-center rounded-full bg-orange-400 text-white">
        <LoaderCircleIcon className="size-3.5 animate-spin" />
      </span>
    )
  }

  return <span className="flex size-6 items-center justify-center rounded-full bg-neutral-200" />
}

