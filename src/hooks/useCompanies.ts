'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { useSession } from 'next-auth/react'
import type { Company } from '@/lib/companies'

// Compañías del usuario compartidas por toda la app (selector, cronómetro,
// editor de trabajos...). Se cargan una vez y se refrescan al editarlas.
//
// La lista queda guardada en memoria mientras la app está abierta, así que va
// marcada con la cuenta a la que pertenece: si entra otra persona en el mismo
// teléfono nunca ve las compañías de la anterior (al cerrar sesión se borra y,
// por si acaso, una lista de otra cuenta no se muestra).

interface CompaniesState {
  /** Cuenta dueña de la lista; null = todavía no se sabe */
  owner: string | null
  companies: Company[] | null
}

/** Siempre el mismo objeto: React exige una instantánea estable en el servidor */
const EMPTY: CompaniesState = { owner: null, companies: null }

let state: CompaniesState = EMPTY
let inflight: Promise<Company[]> | null = null
/** Sube al cerrar sesión: lo que llegue de pedidos anteriores se descarta */
let generation = 0
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function setState(next: CompaniesState) {
  state = next
  listeners.forEach(listener => listener())
}

const getSnapshot = () => state
const getServerSnapshot = () => EMPTY

/** Olvida las compañías guardadas en memoria (al cerrar sesión). */
export function resetCompanies(): void {
  generation += 1
  inflight = null
  setState(EMPTY)
}

/** Vuelve a pedir las compañías al servidor y avisa a todos los componentes. */
export function refreshCompanies(): Promise<Company[]> {
  if (inflight) return inflight
  const startedIn = generation
  const request: Promise<Company[]> = fetch('/api/companies')
    .then(res => res.json())
    .then(json => {
      if (!json.success) throw new Error(json.error || 'Error al cargar las compañías')
      const companies = json.data as Company[]
      // Se cerró sesión mientras llegaba: no es de la cuenta actual
      if (startedIn === generation) setState({ ...state, companies })
      return companies
    })
    .finally(() => {
      if (inflight === request) inflight = null
    })
  inflight = request
  return request
}

export function useCompanies(): Company[] | null {
  const { data: session } = useSession()
  const userId = session?.user?.id ?? null
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  useEffect(() => {
    if (!userId) return
    if (state.owner === null) {
      // Lo que haya llegado desde el último cierre de sesión es de esta cuenta
      setState({ owner: userId, companies: state.companies })
    } else if (state.owner !== userId) {
      // Entró otra cuenta sin cerrar sesión antes: se empieza de cero
      resetCompanies()
      setState({ owner: userId, companies: null })
    }
    if (state.companies === null) refreshCompanies().catch(err => console.error(err))
  }, [userId])

  return userId && snapshot.owner === userId ? snapshot.companies : null
}
