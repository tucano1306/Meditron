'use client'

import { useEffect, useSyncExternalStore } from 'react'
import type { Company } from '@/lib/companies'

// Compañías del usuario compartidas por toda la app (selector, cronómetro,
// editor de trabajos...). Se cargan una vez y se refrescan al editarlas.

let companies: Company[] | null = null
let inflight: Promise<Company[]> | null = null
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const getSnapshot = () => companies
const getServerSnapshot = () => null

/** Vuelve a pedir las compañías al servidor y avisa a todos los componentes. */
export function refreshCompanies(): Promise<Company[]> {
  inflight ??= fetch('/api/companies')
    .then(res => res.json())
    .then(json => {
      if (!json.success) throw new Error(json.error || 'Error al cargar las compañías')
      companies = json.data as Company[]
      listeners.forEach(listener => listener())
      return companies
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

export function useCompanies(): Company[] | null {
  const list = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  useEffect(() => {
    if (companies === null) refreshCompanies().catch(err => console.error(err))
  }, [])
  return list
}
