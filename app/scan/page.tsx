import type { Metadata } from 'next'
import ScanPageClient from './ScanPageClient'

export const metadata: Metadata = {
  title: 'สแกนอาหาร | ScanZapp AI',
  description: 'สแกนรูปอาหารเพื่อประเมินแคลอรี่และโภชนาการด้วย ScanZapp AI',
}

export default function ScanPage() {
  return <ScanPageClient />
}
