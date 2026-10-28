import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateSession } from '@/lib/auth-utils'
import { geocodeAddress, newJoinCode, orgInclude, serializeOrg } from '@/lib/org-server'
import { METERS_PER_MILE, isValidCoordinate } from '@/lib/geo'
import { optionalText } from '@/lib/input'
import type { OrgMembership } from '@/lib/org-shared'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Empresas que puede crear una persona (evita abusos) */
const MAX_OWNED_ORGS = 5

function bad(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status })
}

// GET - Empresas a las que pertenece la persona (como administrador o empleado)
export async function GET() {
  try {
    const auth = await validateSession()
    if (!auth.success) return auth.response
    const members = await prisma.orgMember.findMany({
      where: { userId: auth.user.id },
      include: { org: { include: orgInclude } },
      orderBy: { createdAt: 'asc' },
    })
    const data: OrgMembership[] = members.map(m => ({
      memberId: m.id,
      role: m.role === 'admin' ? 'admin' : 'employee',
      status: m.status as OrgMembership['status'],
      org: serializeOrg(m.org),
      ...(m.role === 'admin' && m.status === 'active' ? { joinCode: m.org.joinCode } : {}),
    }))
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Error listing organizations:', error)
    return bad('Error al cargar las empresas', 500)
  }
}

// POST - Crea una empresa; quien la crea queda como administrador.
// Body: name, weekStartsOn y la oficina (address y/o latitude + longitude, radiusMiles)
export async function POST(request: NextRequest) {
  try {
    const auth = await validateSession()
    if (!auth.success) return auth.response
    const body = await request.json()

    const name = optionalText(body.name, 'El nombre de la empresa', 80)
    if (!name.ok) return bad(name.error)
    if (!name.value || name.value.length < 2) return bad('Escribe el nombre de la empresa')
    const address = optionalText(body.address, 'La dirección', 200)
    if (!address.ok) return bad(address.error)
    const weekStartsOn = body.weekStartsOn === undefined ? 1 : Number(body.weekStartsOn)
    if (!Number.isInteger(weekStartsOn) || weekStartsOn < 0 || weekStartsOn > 6) return bad('Día de inicio de semana inválido')
    const radiusMiles = body.radiusMiles === undefined ? 1 : Number(body.radiusMiles)
    if (!Number.isFinite(radiusMiles) || radiusMiles < 0.05 || radiusMiles > 25) return bad('El radio debe estar entre 0.05 y 25 millas')

    const owned = await prisma.orgMember.count({ where: { userId: auth.user.id, role: 'admin' } })
    if (owned >= MAX_OWNED_ORGS) return bad(`Puedes administrar hasta ${MAX_OWNED_ORGS} empresas`)

    // La oficina: coordenadas exactas (p. ej. "usar mi ubicación") o la dirección
    let latitude: number
    let longitude: number
    let label = address.value ?? ''
    if (isValidCoordinate(body.latitude, body.longitude)) {
      latitude = body.latitude
      longitude = body.longitude
    } else {
      if (!address.value) return bad('Escribe la dirección de la oficina o usa tu ubicación actual')
      const found = await geocodeAddress(address.value)
      if (!found) return bad('No encontramos esa dirección. Revísala o usa tu ubicación actual estando en la oficina.')
      latitude = found.latitude
      longitude = found.longitude
      label = address.value
    }

    let joinCode = newJoinCode()
    while (await prisma.organization.findUnique({ where: { joinCode }, select: { id: true } })) joinCode = newJoinCode()

    const org = await prisma.organization.create({
      data: {
        name: name.value,
        joinCode,
        weekStartsOn,
        members: { create: { userId: auth.user.id, role: 'admin', status: 'active' } },
        locations: {
          create: { name: 'Oficina', address: label || 'Ubicación marcada en el mapa', latitude, longitude, radiusMeters: radiusMiles * METERS_PER_MILE },
        },
      },
      include: { ...orgInclude, members: true },
    })
    return NextResponse.json({
      success: true,
      data: { memberId: org.members[0].id, role: 'admin', status: 'active', org: serializeOrg(org), joinCode } satisfies OrgMembership,
    })
  } catch (error) {
    console.error('Error creating organization:', error)
    return bad('Error al crear la empresa', 500)
  }
}
