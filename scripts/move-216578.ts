import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

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

async function main() {
  const entryId = 'cmlz9143c0003a62977z0uonk'
  const entry = await prisma.timeEntry.findUnique({ where: { id: entryId } })
  if (!entry) { console.log('Entry not found'); return }

  const correctWeekNumber = 9
  const correctYear = 2026

  // Find or create week 9
  let week9 = await prisma.week.findUnique({
    where: {
      weekNumber_year_userId: {
        weekNumber: correctWeekNumber,
        year: correctYear,
        userId: entry.userId
      }
    }
  })

  if (!week9) {
    const { start, end } = getWeekStartEnd(correctWeekNumber, correctYear)
    const startDate = new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()))
    const endDate = new Date(Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()))
    
    week9 = await prisma.week.create({
      data: {
        weekNumber: correctWeekNumber,
        year: correctYear,
        month: 2,
        startDate,
        endDate,
        totalHours: 0,
        earnings: 0,
        userId: entry.userId
      }
    })
    console.log('Created week 9')
  }

  // Move the entry
  await prisma.timeEntry.update({
    where: { id: entryId },
    data: { weekId: week9.id }
  })
  console.log(`Moved entry ${entryId} to week ${correctWeekNumber}/${correctYear}`)

  // Recalculate old week 8 totals
  const oldWeekId = 'cmlpd4tlv0001z91r3s9wodq1'
  const w8entries = await prisma.timeEntry.findMany({ where: { weekId: oldWeekId } })
  const w8seconds = w8entries.reduce((s, e) => s + (e.duration || 0), 0)
  const w8hours = w8seconds / 3600
  await prisma.week.update({
    where: { id: oldWeekId },
    data: { totalHours: w8hours, earnings: w8hours * 25 }
  })
  console.log(`Week 8 recalculated: ${w8hours.toFixed(2)}h, ${w8entries.length} entries`)

  // Recalculate new week 9 totals
  const w9entries = await prisma.timeEntry.findMany({ where: { weekId: week9.id } })
  const w9seconds = w9entries.reduce((s, e) => s + (e.duration || 0), 0)
  const w9hours = w9seconds / 3600
  await prisma.week.update({
    where: { id: week9.id },
    data: { totalHours: w9hours, earnings: w9hours * 25 }
  })
  console.log(`Week 9 recalculated: ${w9hours.toFixed(2)}h, ${w9entries.length} entries`)

  // If old week is empty, delete it
  if (w8entries.length === 0) {
    await prisma.week.delete({ where: { id: oldWeekId } })
    console.log('Deleted empty week 8')
  }

  console.log('\nDone!')
}

try {
  await main()
} catch (err) {
  console.error(err)
} finally {
  await prisma.$disconnect()
}
