'use client'

import { useState } from 'react'
import { OwedBanner, plural } from '@/components/OwedBanner'
import { formatKeyShort } from '@/lib/report-format'
import { formatCurrency } from '@/lib/utils'
import type { PayCompany } from '@/lib/pay-companies'

/** Avisos visibles antes de "ver más" */
const VISIBLE = 3

/** "3 días sin cobrar · desde el lun 3 nov" / "1 trabajo sin cobrar · del mar 4 nov" */
export function owedCompanyDetails(company: PayCompany): string[] {
  const perDay = company.payType === 'per_day'
  const count = perDay ? company.pendingDays : company.pendingCount
  const parts = [perDay ? plural(count, 'día sin cobrar', 'días sin cobrar') : plural(count, 'trabajo sin cobrar', 'trabajos sin cobrar')]
  if (company.pendingSince) parts.push(`${count > 1 ? 'desde el' : 'del'} ${formatKeyShort(company.pendingSince)}`)
  return parts
}

interface PayCompanyOwedProps {
  readonly companies: PayCompany[] | null | undefined
  readonly onReview: (companyId: string) => void
}

/** Un aviso por cada compañía que todavía te debe (la que más debe primero) */
export function PayCompanyOwed({ companies, onReview }: PayCompanyOwedProps) {
  const [showAll, setShowAll] = useState(false)
  const owing = (companies ?? []).filter(c => c.pending > 0).sort((a, b) => b.pending - a.pending)
  if (owing.length === 0) return null

  const visible = showAll ? owing : owing.slice(0, VISIBLE)
  const hidden = owing.slice(VISIBLE)
  return (
    <div className="space-y-2">
      {visible.map(company => (
        <OwedBanner
          key={company.id}
          color={company.color}
          name={company.name}
          amount={formatCurrency(company.pending)}
          details={owedCompanyDetails(company)}
          onReview={() => onReview(company.id)}
        />
      ))}
      {hidden.length > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(v => !v)}
          className="w-full rounded-lg py-1.5 text-[13px] font-semibold text-amber-800 hover:bg-amber-50 touch-manipulation"
        >
          {showAll
            ? 'Ver menos'
            : `${plural(hidden.length, 'compañía más', 'compañías más')} te debe${hidden.length === 1 ? '' : 'n'} ${formatCurrency(hidden.reduce((sum, c) => sum + c.pending, 0))}`}
        </button>
      )}
    </div>
  )
}
