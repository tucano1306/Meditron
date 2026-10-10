'use client'

import { FileDown } from 'lucide-react'
import type { CompanyId } from '@/lib/companies'

interface WeeklyPdfButtonProps {
  readonly company: CompanyId
  /** Cualquier día (YYYY-MM-DD) de la semana de pago a imprimir */
  readonly date: string
  readonly label?: string
  readonly className?: string
}

// Abre el PDF de la semana de pago (lo genera el servidor). En el móvil se ve
// en el visor del sistema, desde donde se puede guardar, imprimir o compartir.
export function WeeklyPdfButton({ company, date, label = 'PDF', className = '' }: WeeklyPdfButtonProps) {
  const href = `/api/reports/weekly-pdf?company=${company}&date=${date.slice(0, 10)}`
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#37352f] bg-white text-[#37352f] text-xs font-semibold hover:bg-[rgba(55,53,47,0.06)] transition-colors touch-manipulation ${className}`}
    >
      <FileDown className="h-3.5 w-3.5" />
      {label}
    </a>
  )
}
