import { prisma } from './prisma'
import { getWeekNumber, getWeekStartEnd, HOURLY_RATE } from './utils'

export async function getOrCreateWeek(date: Date, userId: string) {
  const { start, end } = getWeekStartEnd(date)
  const weekNumber = getWeekNumber(date)
  const year = date.getFullYear()
  const month = date.getMonth() + 1

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
      startDate: start,
      endDate: end,
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
