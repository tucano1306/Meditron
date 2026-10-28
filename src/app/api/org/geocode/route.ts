import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth-utils'
import { geocodeAddress } from '@/lib/org-server'
import { countHits, recordHit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET - Coordenadas de una dirección (?q=), para ubicar la oficina antes de guardarla
export async function GET(request: NextRequest) {
  try {
    const auth = await validateSession()
    if (!auth.success) return auth.response

    const q = new URL(request.url).searchParams.get('q')?.trim() ?? ''
    if (q.length < 5 || q.length > 200) {
      return NextResponse.json({ success: false, error: 'Escribe la dirección completa' }, { status: 400 })
    }
    // El servicio de mapas es gratuito: se usa con moderación
    const key = `geocode:${auth.user.id}`
    if (await countHits(key, 3600 * 1000) >= 30) {
      return NextResponse.json({ success: false, error: 'Demasiadas búsquedas. Prueba en un rato.' }, { status: 429 })
    }
    await recordHit(key)

    const found = await geocodeAddress(q)
    if (!found) return NextResponse.json({ success: false, error: 'No encontramos esa dirección' }, { status: 404 })
    return NextResponse.json({ success: true, data: found })
  } catch (error) {
    console.error('Error geocoding address:', error)
    return NextResponse.json({ success: false, error: 'No se pudo buscar la dirección' }, { status: 502 })
  }
}
