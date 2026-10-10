// Acciones del cliente sobre compañías.

import { getPayPeriod, ruleFor, type Company } from './companies'
import { getFloridaDateString } from './utils'

/**
 * Cambia la tarifa por hora a partir de la semana de pago actual: crea (o
 * reemplaza) la versión del esquema de pago que empieza esta semana, así las
 * semanas anteriores conservan su tarifa. Devuelve un error o null.
 */
export async function saveCompanyRate(company: Company, hourlyRate: number): Promise<string | null> {
  if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) return 'Tarifa inválida'
  const today = getFloridaDateString()
  const current = ruleFor(company, today)
  try {
    const res = await fetch(`/api/companies/${company.id}/rules`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...current, id: undefined, hourlyRate, effectiveFrom: getPayPeriod(today, company.weekStartsOn).start }),
    })
    const data = await res.json()
    return data.success ? null : data.error || 'No se pudo guardar la tarifa'
  } catch {
    return 'Error de conexión'
  }
}
