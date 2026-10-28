import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  floridaDateKey,
  geocodeAddress,
  memberInclude,
  newJoinCode,
  orgAccess,
  orgInclude,
  orgWeek,
  serializeMember,
  serializeOrg,
  serializeShift,
  shiftInclude,
} from '@/lib/org-server'
import { dateKeyToUTC } from '@/lib/companies'
import { METERS_PER_MILE, isValidCoordinate } from '@/lib/geo'
import { optionalText } from '@/lib/input'
import { paidSeconds } from '@/lib/org-shared'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ orgId: string }> }

function bad(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status })
}

// GET - Panel del administrador: empleados (y quién está trabajando ahora),
// solicitudes para unirse y pedidos de corrección pendientes
export async function GET(_request: NextRequest, context: Context) {
  try {
    const { orgId } = await context.params
    const access = await orgAccess(orgId, { admin: true })
    if (!access.ok) return access.response
    const { org } = access

    const now = new Date()
    const today = floridaDateKey(now)
    const week = orgWeek(org, today)
    const [members, open, weekShifts, corrections] = await Promise.all([
      prisma.orgMember.findMany({ where: { orgId }, include: memberInclude, orderBy: { createdAt: 'asc' } }),
      prisma.orgShift.findMany({ where: { orgId, clockOut: null, deletedAt: null }, include: shiftInclude }),
      prisma.orgShift.findMany({
        where: { orgId, deletedAt: null, clockOut: { not: null }, date: { gte: dateKeyToUTC(week.start), lte: dateKeyToUTC(week.end) } },
        include: shiftInclude,
      }),
      prisma.orgShift.findMany({ where: { orgId, correctionStatus: 'pending', deletedAt: null }, include: shiftInclude, orderBy: { clockIn: 'desc' } }),
    ])

    const people = members.map(m => {
      const openShift = open.find(s => s.memberId === m.id)
      const closed = weekShifts.filter(s => s.memberId === m.id).map(serializeShift)
      const todayClosed = closed.filter(s => s.date === today)
      return {
        ...serializeMember(m),
        openShift: openShift ? serializeShift(openShift) : null,
        todaySeconds: todayClosed.reduce((sum, s) => sum + paidSeconds(s), 0),
        todayShifts: todayClosed.length,
        weekSeconds: closed.reduce((sum, s) => sum + paidSeconds(s), 0),
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        serverTime: now.toISOString(),
        org: serializeOrg(org),
        joinCode: org.joinCode,
        week,
        members: people,
        corrections: corrections.map(serializeShift),
      },
    })
  } catch (error) {
    console.error('Error loading admin overview:', error)
    return bad('Error al cargar el panel', 500)
  }
}

// PATCH - Ajustes de la empresa: nombre, semana de pago, overtime, break,
// exigir ubicación, la oficina (dirección o coordenadas y radio) y el código
export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { orgId } = await context.params
    const access = await orgAccess(orgId, { admin: true })
    if (!access.ok) return access.response
    const body = await request.json()

    const data: Record<string, unknown> = {}
    if (body.name !== undefined) {
      const name = optionalText(body.name, 'El nombre', 80)
      if (!name.ok) return bad(name.error)
      if (!name.value || name.value.length < 2) return bad('Escribe el nombre de la empresa')
      data.name = name.value
    }
    if (body.weekStartsOn !== undefined) {
      const day = Number(body.weekStartsOn)
      if (!Number.isInteger(day) || day < 0 || day > 6) return bad('Día de inicio de semana inválido')
      data.weekStartsOn = day
    }
    if (body.requireLocation !== undefined) {
      if (typeof body.requireLocation !== 'boolean') return bad('Datos inválidos')
      data.requireLocation = body.requireLocation
    }
    if (body.overtimeAfterHours !== undefined) {
      const hours = Number(body.overtimeAfterHours)
      if (!Number.isFinite(hours) || hours <= 0 || hours > 168) return bad('Las horas antes del overtime deben estar entre 1 y 168')
      data.overtimeAfterHours = hours
    }
    if (body.overtimeMultiplier !== undefined) {
      const multiplier = Number(body.overtimeMultiplier)
      if (!Number.isFinite(multiplier) || multiplier < 1 || multiplier > 5) return bad('El multiplicador debe estar entre 1 y 5')
      data.overtimeMultiplier = multiplier
    }
    if (body.breakMinutes !== undefined) {
      const minutes = Number(body.breakMinutes)
      if (!Number.isInteger(minutes) || minutes < 0 || minutes > 120) return bad('El break debe ser de 0 a 120 minutos')
      data.breakMinutes = minutes
    }
    if (body.breakAfterHours !== undefined) {
      const hours = Number(body.breakAfterHours)
      if (!Number.isFinite(hours) || hours < 0 || hours > 16) return bad('Las horas mínimas para el break deben estar entre 0 y 16')
      data.breakAfterHours = hours
    }
    if (body.regenerateCode === true) {
      let joinCode = newJoinCode()
      while (await prisma.organization.findUnique({ where: { joinCode }, select: { id: true } })) joinCode = newJoinCode()
      data.joinCode = joinCode
    }

    // Oficina principal: coordenadas exactas o la dirección, y el radio en millas
    let location: { name: string; address: string; latitude: number; longitude: number; radiusMeters: number } | null = null
    if (body.location !== undefined) {
      const loc = body.location ?? {}
      const name = optionalText(loc.name ?? 'Oficina', 'El nombre de la oficina', 60)
      const address = optionalText(loc.address, 'La dirección', 200)
      if (!name.ok) return bad(name.error)
      if (!address.ok) return bad(address.error)
      const radiusMiles = Number(loc.radiusMiles ?? 1)
      if (!Number.isFinite(radiusMiles) || radiusMiles < 0.05 || radiusMiles > 25) return bad('El radio debe estar entre 0.05 y 25 millas')
      let latitude: number
      let longitude: number
      if (isValidCoordinate(loc.latitude, loc.longitude)) {
        latitude = loc.latitude
        longitude = loc.longitude
      } else {
        if (!address.value) return bad('Escribe la dirección de la oficina o usa tu ubicación actual')
        const found = await geocodeAddress(address.value)
        if (!found) return bad('No encontramos esa dirección. Revísala o usa tu ubicación actual estando en la oficina.')
        latitude = found.latitude
        longitude = found.longitude
      }
      location = {
        name: name.value || 'Oficina',
        address: address.value || 'Ubicación marcada en el mapa',
        latitude,
        longitude,
        radiusMeters: radiusMiles * METERS_PER_MILE,
      }
    }

    const org = await prisma.$transaction(async tx => {
      if (Object.keys(data).length > 0) await tx.organization.update({ where: { id: orgId }, data })
      if (location) {
        const primary = await tx.orgLocation.findFirst({ where: { orgId }, orderBy: { createdAt: 'asc' } })
        if (primary) await tx.orgLocation.update({ where: { id: primary.id }, data: location })
        else await tx.orgLocation.create({ data: { ...location, orgId } })
      }
      return tx.organization.findUniqueOrThrow({ where: { id: orgId }, include: orgInclude })
    })
    return NextResponse.json({ success: true, data: { org: serializeOrg(org), joinCode: org.joinCode } })
  } catch (error) {
    console.error('Error updating organization:', error)
    return bad('Error al guardar los ajustes', 500)
  }
}
