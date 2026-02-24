// Script para corregir entradas que están asignadas a la semana incorrecta
// debido al bug de doble conversión de timezone.
//
// El bug: cuando se creaba una entrada manual o se editaba una entrada,
// la fecha se creaba como midnight LOCAL time del servidor. Cuando el servidor
// está en UTC, midnight UTC se convertía a Florida (7pm del día anterior),
// causando que la semana se calculara incorrectamente.
//
// EJECUTAR EN PRODUCCIÓN:
// DATABASE_URL="postgresql://..." npx tsx scripts/fix-week-assignments-v2.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Calcula el número de semana ISO desde componentes de fecha (año, mes 0-indexed, día)
function getISOWeekAndYear(year: number, month: number, day: number): { weekNumber: number; isoYear: number } {
  const d = new Date(year, month, day)
  const dayOfWeek = d.getDay()
  const isoDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek
  const thursday = new Date(d)
  thursday.setDate(d.getDate() + (4 - isoDayOfWeek))
  const isoYear = thursday.getFullYear()
  const jan4 = new Date(isoYear, 0, 4)
  const jan4DayOfWeek = jan4.getDay() === 0 ? 7 : jan4.getDay()
  const firstThursday = new Date(isoYear, 0, 4 - jan4DayOfWeek + 4)
  const weekNum = Math.round((thursday.getTime() - firstThursday.getTime()) / 604800000) + 1
  return { weekNumber: weekNum, isoYear }
}

function getWeekStartEnd(weekNumber: number, year: number) {
  const jan4 = new Date(year, 0, 4)
  const jan4DayOfWeek = jan4.getDay()
  const isoJan4DayOfWeek = jan4DayOfWeek === 0 ? 7 : jan4DayOfWeek
  const firstMonday = new Date(year, 0, 4 - isoJan4DayOfWeek + 1)
  const start = new Date(firstMonday)
  start.setDate(firstMonday.getDate() + (weekNumber - 1) * 7)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

async function fixMisassignedEntries() {
  console.log('=== Fixing misassigned time entries (v2) ===\n')

  const entries = await prisma.timeEntry.findMany({
    include: { week: true },
    orderBy: { startTime: 'asc' }
  })

  let fixedCount = 0
  let okCount = 0

  for (const entry of entries) {
    const entryDate = new Date(entry.date)
    // Use UTC components from the stored @db.Date (which is UTC midnight)
    const utcYear = entryDate.getUTCFullYear()
    const utcMonth = entryDate.getUTCMonth()
    const utcDay = entryDate.getUTCDate()
    
    const { weekNumber: correctWeekNumber, isoYear: correctYear } = getISOWeekAndYear(utcYear, utcMonth, utcDay)

    if (entry.week.weekNumber !== correctWeekNumber || entry.week.year !== correctYear) {
      console.log(`MISMATCH: Entry ${entry.id}`)
      console.log(`  Date: ${entryDate.toISOString().slice(0, 10)}`)
      console.log(`  Current: Week ${entry.week.weekNumber}/${entry.week.year}`)
      console.log(`  Correct: Week ${correctWeekNumber}/${correctYear}`)

      let correctWeek = await prisma.week.findUnique({
        where: {
          weekNumber_year_userId: {
            weekNumber: correctWeekNumber,
            year: correctYear,
            userId: entry.userId
          }
        }
      })

      if (!correctWeek) {
        const { start, end } = getWeekStartEnd(correctWeekNumber, correctYear)
        const startDate = new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()))
        const endDate = new Date(Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()))
        
        correctWeek = await prisma.week.create({
          data: {
            weekNumber: correctWeekNumber,
            year: correctYear,
            month: utcMonth + 1,
            startDate,
            endDate,
            totalHours: 0,
            earnings: 0,
            userId: entry.userId
          }
        })
        console.log(`  Created new week: ${correctWeekNumber}/${correctYear}`)
      }

      await prisma.timeEntry.update({
        where: { id: entry.id },
        data: { weekId: correctWeek.id }
      })

      fixedCount++
      console.log(`  → Fixed!`)
    } else {
      okCount++
    }
  }

  console.log(`\nResults: ${fixedCount} fixed, ${okCount} already correct`)

  // Recalculate week totals
  if (fixedCount > 0) {
    console.log('\nRecalculating week totals...')
    const weeks = await prisma.week.findMany({
      include: { entries: true }
    })

    for (const week of weeks) {
      const totalSeconds = week.entries.reduce((sum, e) => sum + (e.duration || 0), 0)
      const totalHours = totalSeconds / 3600
      const earnings = totalHours * 25 // HOURLY_RATE

      if (week.entries.length === 0) {
        await prisma.week.delete({ where: { id: week.id } })
        console.log(`  Deleted empty week ${week.weekNumber}/${week.year}`)
      } else {
        await prisma.week.update({
          where: { id: week.id },
          data: { totalHours, earnings }
        })
      }
    }
    console.log('Done recalculating!')
  }
}

try {
  await fixMisassignedEntries()
} catch (err) {
  console.error(err)
} finally {
  await prisma.$disconnect()
}
