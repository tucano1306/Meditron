import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// La duración guardada es correcta: 15720s = 4h 22m
// El calculatedAmount incorrecto (143.4375) era el total de la semana × $30
// Lo corregimos: 15720 / 3600 × $30 = $131.00

const entry = await prisma.timeEntry.findFirst({
  where: { jobNumber: '224243' },
  select: { id: true, duration: true, calculatedAmount: true, weekId: true, date: true, userId: true }
})

if (!entry) {
  console.log('Entry not found')
  process.exit(1)
}

const correctAmount = (entry.duration / 3600) * 30
console.log('Entry ID:', entry.id)
console.log('Duration:', entry.duration, 's =', Math.floor(entry.duration/3600) + 'h', Math.floor((entry.duration%3600)/60) + 'm')
console.log('calculatedAmount actual (incorrecto):', entry.calculatedAmount)
console.log('calculatedAmount correcto:', correctAmount)

await prisma.timeEntry.update({
  where: { id: entry.id },
  data: { calculatedAmount: correctAmount }
})

// Recalcular totales de la semana
if (entry.weekId) {
  const weekEntries = await prisma.timeEntry.findMany({
    where: { weekId: entry.weekId, endTime: { not: null } },
    select: { duration: true, calculatedAmount: true }
  })
  const weekEarnings = weekEntries.reduce((sum, e) => {
    return sum + (e.calculatedAmount ?? (e.duration ?? 0) / 3600 * 30)
  }, 0)
  const weekHours = weekEntries.reduce((sum, e) => sum + (e.duration ?? 0), 0) / 3600
  await prisma.week.update({
    where: { id: entry.weekId },
    data: { totalHours: weekHours, earnings: weekEarnings }
  })
  console.log('Week totals updated — totalHours:', weekHours.toFixed(4), 'earnings:', weekEarnings.toFixed(2))
}

// Recalcular totales del mes
const entryDate = new Date(entry.date)
const year = entryDate.getUTCFullYear()
const month = entryDate.getUTCMonth() + 1
const monthEntries = await prisma.timeEntry.findMany({
  where: {
    userId: entry.userId,
    endTime: { not: null },
    week: { year, month }
  },
  select: { duration: true, calculatedAmount: true }
})
const monthEarnings = monthEntries.reduce((sum, e) => {
  return sum + (e.calculatedAmount ?? (e.duration ?? 0) / 3600 * 30)
}, 0)
const monthHours = monthEntries.reduce((sum, e) => sum + (e.duration ?? 0), 0) / 3600
await prisma.monthSummary.updateMany({
  where: { userId: entry.userId, year, month },
  data: { totalHours: monthHours, earnings: monthEarnings }
})
console.log('Month totals updated — totalHours:', monthHours.toFixed(4), 'earnings:', monthEarnings.toFixed(2))

console.log('\n✓ Corrección aplicada: $143.44 → $' + correctAmount.toFixed(2))

await prisma.$disconnect()
