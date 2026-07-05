'use client'

import { ChangeEvent, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import {
  ActivityIcon,
  AlertCircleIcon,
  CameraIcon,
  CheckIcon,
  ChevronRightIcon,
  ImageIcon,
  LoaderCircleIcon,
  SaveIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UploadCloudIcon,
  XIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  getLocalDateKey,
  getTimeBasedMealCategory,
  MEAL_CATEGORY_LABELS,
  notifyMealHistoryUpdated,
  type MealCategory,
} from '@/lib/user-data'

type ScanResult = {
  name: string
  calories: number
  protein: number
  carbs: number
  fat: number
  confidence: number
  note?: string
  mealKind: 'main_meal' | 'snack'
}

type ApiResult = ScanResult & {
  isFood: boolean
  reason?: string
}

const macroItems = [
  { key: 'protein', label: 'โปรตีน', unit: 'g', soft: 'bg-emerald-50 text-emerald-700' },
  { key: 'carbs', label: 'คาร์บ', unit: 'g', soft: 'bg-sky-50 text-sky-700' },
  { key: 'fat', label: 'ไขมัน', unit: 'g', soft: 'bg-amber-50 text-amber-700' },
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
const maxUploadBytes = 3 * 1024 * 1024
const maxImageDimension = 1600
const modelLabel = process.env.NEXT_PUBLIC_AI_MODEL?.trim() || 'qwen/qwen3.7-plus'

function readFileAsDataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('ไม่สามารถอ่านรูปภาพได้'))
    reader.readAsDataURL(file)
  })
}

async function optimizeFoodImage(file: File): Promise<Blob> {
  if (!('createImageBitmap' in window) || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    return file
  }

  let bitmap: ImageBitmap | null = null
  try {
    bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxImageDimension / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return file
    context.drawImage(bitmap, 0, 0, width, height)

    return await new Promise<Blob>((resolve) => {
      canvas.toBlob((blob) => resolve(blob ?? file), 'image/jpeg', 0.82)
    })
  } catch {
    return file
  } finally {
    bitmap?.close()
  }
}

function getFriendlyScanError(message?: string) {
  if (!message) return 'วิเคราะห์รูปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'

  const normalized = message.toLowerCase()
  const isHtmlResponse =
    normalized.includes('<!doctype html') ||
    normalized.includes('<html') ||
    normalized.includes('cloudflare') ||
    normalized.includes("unexpected token '<'")

  if (isHtmlResponse) {
    return 'บริการวิเคราะห์อาหารขัดข้องชั่วคราว กรุณารอสักครู่แล้วลองสแกนใหม่อีกครั้ง'
  }

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
  const previewObjectUrlRef = useRef<string | null>(null)

  const [scanning, setScanning] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [savePending, setSavePending] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)

  const hasResult = Boolean(result)
  const isProcessing = scanning && Boolean(preview) && !hasResult
  const resultMealCategory: MealCategory | null = result
    ? result.mealKind === 'snack'
      ? 'snack'
      : getTimeBasedMealCategory(
          new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }),
        )
    : null

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCameraReady(false)
    setCameraOpen(false)
  }

  const replacePreview = (value: string | null, objectUrl: string | null = null) => {
    if (previewObjectUrlRef.current) URL.revokeObjectURL(previewObjectUrlRef.current)
    previewObjectUrlRef.current = objectUrl
    setPreview(value)
  }

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      if (previewObjectUrlRef.current) URL.revokeObjectURL(previewObjectUrlRef.current)
    }
  }, [])

  const analyzeDataUrl = async (image: string, previewUrl = image, objectUrl: string | null = null) => {
    setError(null)
    setResult(null)
    replacePreview(previewUrl, objectUrl)
    setSaved(false)
    setDetailsOpen(false)
    setScanning(true)

    try {
      const response = await fetch('/api/scan-food', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image }),
      })
      const rawBody = await response.text()
      let data: Partial<ApiResult> & { error?: string }
      try {
        data = JSON.parse(rawBody) as Partial<ApiResult> & { error?: string }
      } catch {
        throw new Error(
          response.status >= 500
            ? 'บริการวิเคราะห์อาหารขัดข้องชั่วคราว กรุณารอสักครู่แล้วลองสแกนใหม่อีกครั้ง'
            : 'ระบบสแกนตอบกลับในรูปแบบที่ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง',
        )
      }

      if (!response.ok) {
        throw new Error(getFriendlyScanError(data.error))
      }

      if (!data.isFood) {
        replacePreview(null)
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
        mealKind: data.mealKind === 'snack' ? 'snack' : 'main_meal',
      })
    } catch (scanError) {
      replacePreview(null)
      setError(getFriendlyScanError(scanError instanceof Error ? scanError.message : undefined))
    } finally {
      setScanning(false)
    }
  }

  const analyzeImage = async (file: File) => {
    setError(null)
    setResult(null)

    if (!file.type.startsWith('image/')) {
      replacePreview(null)
      setError('กรุณาเลือกไฟล์รูปภาพเท่านั้น')
      return
    }

    if (file.size > maxFileSize) {
      replacePreview(null)
      setError('รูปภาพต้องมีขนาดไม่เกิน 10MB')
      return
    }

    const optimized = await optimizeFoodImage(file)
    if (optimized.size > maxUploadBytes) {
      replacePreview(null)
      setError('ไม่สามารถลดขนาดรูปให้ต่ำกว่า 3MB ได้ กรุณาเลือกรูปที่เล็กลง')
      return
    }
    const image = await readFileAsDataUrl(optimized)
    const objectUrl = URL.createObjectURL(optimized)
    await analyzeDataUrl(image, objectUrl, objectUrl)
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
    replacePreview(null)
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
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82))
    if (!blob) {
      setError('ไม่สามารถเตรียมรูปจากกล้องได้')
      return
    }
    const image = await readFileAsDataUrl(blob)
    const objectUrl = URL.createObjectURL(blob)
    stopCamera()
    await analyzeDataUrl(image, objectUrl, objectUrl)
  }

  const saveScanResult = async () => {
    if (!result || saved || savePending) return
    const now = new Date()
    const entry = {
      id: `scan-${now.getTime()}`,
      name: result.name,
      calories: result.calories,
      protein: result.protein,
      carbs: result.carbs,
      fat: result.fat,
      confidence: result.confidence,
      note: result.note,
      mealCategory: result.mealKind === 'snack' ? 'snack' : getTimeBasedMealCategory(
        now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }),
      ),
      time: now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }),
      date: getLocalDateKey(now),
      source: 'scan',
    } as const

    setSavePending(true)
    setError(null)

    try {
      const response = await fetch('/api/meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      })

      const payload = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) {
        throw new Error(payload?.error || 'บันทึกมื้ออาหารไม่สำเร็จ')
      }

      notifyMealHistoryUpdated()
      setSaved(true)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'บันทึกมื้ออาหารไม่สำเร็จ')
    } finally {
      setSavePending(false)
    }
  }

  return (
    <div
      className={`mx-auto flex min-h-[calc(100vh-7rem)] w-full flex-col transition-all duration-700 ease-out ${
        hasResult ? 'max-w-6xl justify-start gap-5 pb-6 pt-3' : isProcessing ? 'max-w-6xl justify-center py-4' : 'max-w-3xl justify-center py-4'
      }`}
    >
      <input ref={uploadInputRef} className="sr-only" type="file" accept="image/*" onChange={handleFileChange} />
      <canvas ref={canvasRef} className="hidden" />

      {isProcessing && preview && <ScanProcessingView preview={preview} />}

      {!hasResult && !isProcessing && (
        <section className="mx-auto w-full max-w-2xl animate-[resultIn_.45s_ease-out_both] overflow-hidden rounded-[2rem] border border-emerald-100 bg-white shadow-[0_24px_70px_-42px_rgba(5,150,105,0.38)]">
          <header className="bg-gradient-to-br from-emerald-50 via-white to-white px-6 pb-5 pt-7 text-center sm:px-10 sm:pt-9">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-white px-3 py-1.5 text-xs font-bold text-emerald-700 shadow-sm">
              <SparklesIcon className="size-3.5" />
              ScanZapp AI Food Scanner
            </div>
            <h1 className="mt-4 text-2xl font-black tracking-tight text-neutral-950 sm:text-3xl">วิเคราะห์อาหารจากภาพ</h1>
            <p className="mx-auto mt-2 max-w-md text-sm font-medium leading-6 text-neutral-500">
              ถ่ายรูปหรือเลือกรูปอาหาร ระบบจะประเมินเมนู พลังงาน และสารอาหารหลักให้โดยอัตโนมัติ
            </p>
          </header>

          <div className="px-5 pb-5 sm:px-7 sm:pb-7">
            <div className="flex min-h-[310px] flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-emerald-200 bg-emerald-50/35 p-5 sm:p-7">
            {cameraOpen ? (
              <div className="w-full">
                <div className="relative aspect-[4/3] overflow-hidden rounded-[1.25rem] bg-neutral-950 shadow-lg">
                  <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
                  {!cameraReady && (
                    <div className="absolute inset-0 flex items-center justify-center bg-neutral-950/70 text-white">
                      <LoaderCircleIcon className="mr-2 size-5 animate-spin" />
                      กำลังเปิดกล้อง
                    </div>
                  )}
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Button className="h-12 rounded-xl bg-emerald-600 font-bold text-white shadow-md shadow-emerald-600/15 hover:bg-emerald-700" onClick={capturePhoto} disabled={!cameraReady || scanning}>
                    <CameraIcon className="size-4" />
                    ถ่ายรูป
                  </Button>
                  <Button variant="outline" className="h-12 rounded-xl border-emerald-200 bg-white font-bold text-emerald-700 hover:bg-emerald-50" onClick={stopCamera} disabled={scanning}>
                    <XIcon className="size-4" />
                    ยกเลิก
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div
                  className={`mb-5 flex size-20 items-center justify-center rounded-[1.6rem] shadow-lg transition-all duration-500 ${
                    scanning ? 'scale-105 bg-white text-emerald-600 shadow-emerald-500/15' : 'bg-emerald-600 text-white shadow-emerald-600/20'
                  }`}
                >
                  {scanning ? <LoaderCircleIcon className="size-10 animate-spin" /> : <CameraIcon className="size-10" />}
                </div>

                <h2 className="text-lg font-black text-neutral-900">เลือกรูปอาหารของคุณ</h2>
                <p className="mt-1 text-center text-sm font-medium text-neutral-400">จัดอาหารให้อยู่กลางภาพและมีแสงเพียงพอ</p>

                <div className="mt-6 grid w-full max-w-md gap-3 sm:grid-cols-2">
                  <Button className="h-12 rounded-xl bg-emerald-600 font-bold text-white shadow-md shadow-emerald-600/15 hover:bg-emerald-700" onClick={openCamera} disabled={scanning}>
                    <CameraIcon className="size-4" />
                    {scanning ? 'กำลังสแกน' : 'เปิดกล้อง'}
                  </Button>
                  <Button
                    variant="outline"
                    className="h-12 rounded-xl border-emerald-200 bg-white font-bold text-emerald-700 hover:bg-emerald-50"
                    onClick={openUpload}
                    disabled={scanning}
                  >
                    <UploadCloudIcon className="size-4" />
                    เลือกรูปจากเครื่อง
                  </Button>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] font-semibold text-neutral-400">
                  <span className="inline-flex items-center gap-1.5"><ImageIcon className="size-3.5 text-emerald-500" /> PNG, JPG, WEBP, HEIC</span>
                  <span className="inline-flex items-center gap-1.5"><ShieldCheckIcon className="size-3.5 text-emerald-500" /> ขนาดไม่เกิน 10 MB</span>
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
          </div>
        </section>
      )}

      {result && preview && (
        <>
          <section className="grid items-start gap-5 transition-all duration-700 ease-out lg:grid-cols-[minmax(0,1.08fr)_minmax(390px,0.92fr)]">
            <div className="animate-[resultIn_.5s_ease-out_both] overflow-hidden rounded-[1.75rem] border border-emerald-100 bg-white p-4 shadow-[0_22px_60px_-42px_rgba(5,150,105,0.38)]">
              <div className="relative aspect-[4/3] max-h-[560px] overflow-hidden rounded-[1.35rem] bg-emerald-50">
                <Image className="object-cover" src={preview} alt="รูปอาหารที่สแกน" fill sizes="(max-width: 1024px) 100vw, 52vw" unoptimized />
                <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-emerald-700 shadow-sm backdrop-blur">
                  <CheckIcon className="size-3.5" />
                  วิเคราะห์เสร็จแล้ว
                </div>
                {scanning && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                    <LoaderCircleIcon className="size-10 animate-spin text-emerald-600" />
                  </div>
                )}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Button className="h-11 rounded-xl bg-emerald-600 font-bold text-white hover:bg-emerald-700" onClick={openCamera} disabled={scanning}>
                  <CameraIcon className="size-4" />
                  ถ่ายรูปใหม่
                </Button>
                <Button
                  variant="outline"
                  className="h-11 rounded-xl border-emerald-200 font-bold text-emerald-700 hover:bg-emerald-50"
                  onClick={openUpload}
                  disabled={scanning}
                >
                  <UploadCloudIcon className="size-4" />
                  เลือกรูปใหม่
                </Button>
              </div>
            </div>

            <aside className="animate-[resultIn_.55s_ease-out_both] rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-[0_22px_60px_-42px_rgba(5,150,105,0.38)] sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-600">
                  <SparklesIcon className="size-4" />
                  ผลจาก ScanZapp AI
                </div>
                {resultMealCategory && (
                  <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
                    {MEAL_CATEGORY_LABELS[resultMealCategory]}
                  </span>
                )}
              </div>

              <div className="mt-5 flex items-center gap-4 border-b border-neutral-100 pb-5">
                <Image
                  className="size-20 shrink-0 rounded-2xl bg-emerald-50 object-cover shadow-inner ring-1 ring-emerald-100"
                  src={preview}
                  alt="รูปอาหารที่สแกน"
                  width={80}
                  height={80}
                  unoptimized
                />
                <div className="min-w-0">
                  <h2 className="text-xl font-black leading-tight text-neutral-950 sm:text-2xl">{result.name}</h2>
                  <p className="mt-1 text-sm text-neutral-500">
                    ประมาณ <span className="font-bold text-orange-500">{result.calories} kcal</span> ต่อหนึ่งจาน
                  </p>
                </div>
              </div>

              <div className="mt-5 flex items-center gap-2 text-sm font-black text-neutral-900">
                <ActivityIcon className="size-4 text-emerald-600" />
                สารอาหารหลัก
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2.5">
                {macroItems.map((item) => (
                  <div key={item.key} className={`rounded-2xl px-3 py-4 ${item.soft}`}>
                    <p className="text-xl font-black">
                      {result[item.key]}
                      <span className="ml-0.5 text-xs">{item.unit}</span>
                    </p>
                    <p className="mt-1 text-xs font-medium text-neutral-500">{item.label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3.5 text-sm text-emerald-800">
                <p className="flex items-center gap-2 font-bold">
                  <SparklesIcon className="size-4" />
                  คำแนะนำ
                </p>
                <p className="mt-1.5 leading-6">{result.note || 'ตรวจสอบปริมาณและส่วนประกอบจริงก่อนบันทึก'}</p>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Button className="h-12 rounded-xl bg-emerald-600 font-bold text-white shadow-md shadow-emerald-600/15 hover:bg-emerald-700" onClick={saveScanResult} disabled={saved || savePending}>
                  <SaveIcon className="size-4" />
                  {saved ? 'บันทึกแล้ว' : savePending ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
                </Button>
                <Button
                  variant="outline"
                  className="h-12 rounded-xl border-emerald-200 font-bold text-emerald-700 hover:bg-emerald-50"
                  onClick={() => setDetailsOpen(true)}
                >
                  ดูรายละเอียด
                  <ChevronRightIcon className="size-4" />
                </Button>
              </div>
            </aside>
          </section>

          {detailsOpen && (
            <ScanDetailModal
              result={result}
              mealCategory={resultMealCategory ?? 'special'}
              onClose={() => setDetailsOpen(false)}
            />
          )}
        </>
      )}
    </div>
  )
}

function ScanDetailModal({
  result,
  mealCategory,
  onClose,
}: {
  result: ScanResult
  mealCategory: MealCategory
  onClose: () => void
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-3 backdrop-blur-sm sm:items-center"
      role="presentation"
      onClick={onClose}
    >
      <section
        className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="scan-detail-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-emerald-600">รายละเอียดผลการวิเคราะห์</p>
            <h2 id="scan-detail-title" className="mt-1 text-2xl font-bold text-neutral-950">
              {result.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
            aria-label="ปิดรายละเอียดผลการวิเคราะห์"
          >
            <XIcon className="size-4" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <DetailValue label="หมวดมื้อ" value={MEAL_CATEGORY_LABELS[mealCategory]} />
          <DetailValue label="พลังงาน" value={`${result.calories} kcal`} />
          <DetailValue label="โปรตีน" value={`${result.protein} g`} />
          <DetailValue label="คาร์บ" value={`${result.carbs} g`} />
          <DetailValue label="ไขมัน" value={`${result.fat} g`} />
        </div>

        <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">
          <p className="font-bold">คำแนะนำจาก ScanZapp AI</p>
          <p className="mt-1 leading-6">{result.note || 'ตรวจสอบปริมาณและส่วนประกอบจริงก่อนบันทึก'}</p>
        </div>
      </section>
    </div>
  )
}

function DetailValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-neutral-50 p-4">
      <p className="text-xs font-semibold text-neutral-400">{label}</p>
      <p className="mt-1 font-bold text-neutral-900">{value}</p>
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
    <section className="mx-auto w-full animate-[resultIn_.45s_ease-out_both] rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-[0_24px_70px_-42px_rgba(5,150,105,0.38)] sm:p-6">
      <div className="grid min-h-[480px] gap-6 lg:grid-cols-[minmax(0,1.2fr)_360px]">
        <div className="flex flex-col">
          <div className="relative min-h-[340px] flex-1 overflow-hidden rounded-[1.5rem] bg-neutral-100">
            <Image src={preview} alt="รูปที่กำลังสแกน" fill className="object-cover" sizes="(max-width: 1024px) 100vw, 720px" unoptimized />
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/35" />
            <div className="absolute inset-x-8 top-0 h-20 animate-[scanFood_2.35s_ease-in-out_infinite]">
              <div className="absolute inset-x-0 top-10 h-px bg-emerald-300 shadow-[0_0_24px_rgba(46,199,143,0.85)]" />
              <div className="absolute inset-x-0 top-10 h-16 bg-gradient-to-b from-emerald-300/20 to-transparent" />
            </div>
            <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-white/90 px-3.5 py-2 text-xs font-bold text-emerald-700 shadow-sm backdrop-blur">
              <LoaderCircleIcon className="size-4 animate-spin" />
              กำลังวิเคราะห์ภาพ
            </div>
            <p className="absolute bottom-5 left-5 right-5 text-sm font-semibold text-white drop-shadow">
              {processingSteps[activeStepIndex].caption}
            </p>
          </div>

          <div className="mt-4 flex items-center justify-between text-xs font-bold">
            <span className="text-neutral-500">{processingSteps[activeStepIndex].label}</span>
            <span className="text-emerald-600">{progress}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full bg-[#2EC78F] transition-[width] duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <aside className="flex flex-col justify-center">
          <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <SparklesIcon className="size-6" />
          </div>
          <h1 className="mt-4 text-2xl font-black text-neutral-950">กำลังวิเคราะห์อาหาร</h1>
          <p className="mt-2 text-sm font-medium leading-6 text-neutral-500">
            รอสักครู่ ระบบกำลังตรวจภาพ ระบุเมนู และประเมินสารอาหารให้คุณ
          </p>

          <h2 className="mb-3 mt-7 text-sm font-black text-neutral-950">ขั้นตอนการวิเคราะห์</h2>
          <div className="space-y-2.5">
            {processingSteps.map((step, index) => {
              const status: ProcessingStepStatus = index < activeStepIndex ? 'done' : index === activeStepIndex ? 'active' : 'pending'

              return (
              <div
                key={step.label}
                className={`grid grid-cols-[28px_1fr_auto] items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors ${
                  status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-50 text-neutral-400'
                }`}
              >
                <StepStatusIcon status={status} />
                <span className={status === 'done' ? 'text-[#2EC78F]' : ''}>{step.label}</span>
                <span className={status === 'done' ? 'text-[#2EC78F]' : status === 'active' ? 'text-emerald-600' : 'text-neutral-400'}>
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
      <span className="flex size-6 items-center justify-center rounded-full bg-emerald-500 text-white">
        <LoaderCircleIcon className="size-3.5 animate-spin" />
      </span>
    )
  }

  return <span className="flex size-6 items-center justify-center rounded-full border border-neutral-200 bg-white" />
}
