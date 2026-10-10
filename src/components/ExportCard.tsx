'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import { COMPANIES, type CompanyId } from '@/lib/companies'
import { getFloridaDateString } from '@/lib/utils'

interface ExportCardProps {
  readonly company: CompanyId
}

function firstDayOfMonth(key: string): string {
  return `${key.slice(0, 7)}-01`
}

// Exporta a CSV (Excel / Google Sheets) los trabajos de un rango de fechas
export function ExportCard({ company }: ExportCardProps) {
  const today = getFloridaDateString()
  const [from, setFrom] = useState(firstDayOfMonth(today))
  const [to, setTo] = useState(today)
  const isValid = Boolean(from && to && from <= to)
  const href = `/api/reports/csv?company=${company}&from=${from}&to=${to}`
  const inputClass = 'mt-0.5 w-full px-2 py-1.5 text-[13px] border border-[rgba(55,53,47,0.16)] rounded-[4px] bg-white focus:outline-none focus:border-[#37352f]'

  return (
    <div className="rounded-xl border border-[rgba(55,53,47,0.09)] bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Download className="h-4 w-4 text-[#787774]" />
        <span className="text-[14px] font-semibold text-[#37352f]">Exportar {COMPANIES[company].name}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[11px] text-[#787774]">
          Desde
          <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} className={inputClass} style={{ fontSize: '16px' }} />
        </label>
        <label className="text-[11px] text-[#787774]">
          Hasta
          <input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} className={inputClass} style={{ fontSize: '16px' }} />
        </label>
      </div>
      <a
        href={isValid ? href : undefined}
        download
        aria-disabled={!isValid}
        className={`mt-3 flex items-center justify-center gap-1.5 w-full py-2.5 rounded-[6px] text-[13px] font-semibold transition-colors touch-manipulation ${isValid ? 'bg-[#37352f] text-white hover:bg-[#2f2d28]' : 'bg-[rgba(55,53,47,0.08)] text-[#9b9a97] pointer-events-none'}`}
      >
        <Download className="h-4 w-4" />
        Descargar CSV (Excel)
      </a>
    </div>
  )
}
