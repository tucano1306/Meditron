import { prisma } from './prisma'
import { getISOWeekAndYear, getISOWeekAndYearFromUTCDate, getWeekStartEndFromWeekNumber, getFloridaDateComponents, HOURLY_RATE } from './utils'

/**
 * Obtiene o crea una semana a partir de un TIMESTAMP real (UTC).
 * Convierte a Florida timezone para determinar el día y la semana.
 * Usar para: timer start/stop, cualquier operación con hora real.
 */
export async function getOrCreateWeek(date: Date, userId: string) {
  const floridaComponents = getFloridaDateComponents(date)
  const { weekNumber, isoYear } = getISOWeekAndYear(date)
  
  const year = isoYear
  const month = floridaComponents.month
  
  return _findOrCreateWeek(weekNumber, year, month, userId)
}

/**
 * Obtiene o crea una semana a partir de una FECHA CALENDARIO (año, mes, día).
 * NO hace conversión de timezone - los valores ya representan el día correcto.
 * Usar para: entradas manuales, fechas seleccionadas por el usuario.
 */
export async function getOrCreateWeekFromCalendarDate(calYear: number, calMonth: number, calDay: number, userId: string) {
  const dateAsUTC = new Date(Date.UTC(calYear, calMonth - 1, calDay))
  const { weekNumber, isoYear } = getISOWeekAndYearFromUTCDate(dateAsUTC)
  
  return _findOrCreateWeek(weekNumber, isoYear, calMonth, userId)
}

async function _findOrCreateWeek(weekNumber: number, year: number, month: number, userId: string) {
  // Calcular rangos de la semana de forma consistente
  const { start, end } = getWeekStartEndFromWeekNumber(weekNumber, year)
  // Convertir a UTC midnight para almacenamiento @db.Date
  const startDate = new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()))
  const endDate = new Date(Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()))

  // First, verify the user exists
  const userExists = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true }
  })

  if (!userExists) {
    throw new Error(`User not found: ${userId}`)
  }

  // Try to find existing week first
  const existingWeek = await prisma.week.findUnique({
    where: {
      weekNumber_year_userId: {
        weekNumber,
        year,
        userId
      }
    }
  })

  if (existingWeek) {
    return existingWeek
  }

  // Create new week
  const week = await prisma.week.create({
    data: {
      weekNumber,
      year,
      month,
      startDate: startDate,
      endDate: endDate,
      totalHours: 0,
      earnings: 0,
      userId
    }
  })

  return week
}

export async function updateWeekTotals(weekId: string, userId: string) {
  const entries = await prisma.timeEntry.findMany({
    where: {
      weekId,
      userId,
      duration: { not: null }
    }
  })

  const totalSeconds = entries.reduce((sum: number, entry: { duration: number | null }) => sum + (entry.duration || 0), 0)
  const totalHours = totalSeconds / 3600
  const earnings = totalHours * HOURLY_RATE

  await prisma.week.update({
    where: { id: weekId },
    data: {
      totalHours,
      earnings
    }
  })

  return { totalHours, earnings }
}

export async function updateMonthSummary(year: number, month: number, userId: string) {
  const weeks = await prisma.week.findMany({
    where: { year, month, userId }
  })

  const totalHours = weeks.reduce((sum: number, week: { totalHours: number }) => sum + week.totalHours, 0)
  const earnings = totalHours * HOURLY_RATE

  await prisma.monthSummary.upsert({
    where: {
      year_month_userId: { year, month, userId }
    },
    update: {
      totalHours,
      earnings
    },
    create: {
      year,
      month,
      totalHours,
      earnings,
      userId
    }
  })

  return { totalHours, earnings }
}
