import { prisma } from './prisma'
import { getWeekNumber, getWeekStartEnd, HOURLY_RATE } from './utils'

export async function getOrCreateWeek(date: Date) {
  const { start, end } = getWeekStartEnd(date)
  const weekNumber = getWeekNumber(date)
  const year = date.getFullYear()
  const month = date.getMonth() + 1

  let week = await prisma.week.findUnique({
    where: {
      weekNumber_year: {
        weekNumber,
        year
      }
    }
  })

  if (!week) {
    week = await prisma.week.create({
      data: {
        weekNumber,
        year,
        month,
        startDate: start,
        endDate: end,
        totalHours: 0,
        earnings: 0
      }
    })
  }

  return week
}

export async function updateWeekTotals(weekId: string) {
  const entries = await prisma.timeEntry.findMany({
    where: {
      weekId,
      duration: { not: null }
    }
  })

  const totalSeconds = entries.reduce((sum, entry) => sum + (entry.duration || 0), 0)
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

export async function updateMonthSummary(year: number, month: number) {
  const weeks = await prisma.week.findMany({
    where: { year, month }
  })

  const totalHours = weeks.reduce((sum, week) => sum + week.totalHours, 0)
  const earnings = totalHours * HOURLY_RATE

  await prisma.monthSummary.upsert({
    where: {
      year_month: { year, month }
    },
    update: {
      totalHours,
      earnings
    },
    create: {
      year,
      month,
      totalHours,
      earnings
    }
  })

  return { totalHours, earnings }
}
