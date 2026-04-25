import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const jobs = ['224071', '224815', '221032', '227660', '222886']

const entries = await prisma.timeEntry.findMany({
  where: { jobNumber: { in: jobs } },
  select: {
    id: true, jobNumber: true, duration: true,
    calculatedAmount: true, weekId: true, date: true, userId: true
  }
})

const weeksToUpdate = new Set()
const monthsToUpdate = new Set()

for (const e of entries) {
  const dur = e.duration ?? 0
  const correct = (dur / 3600) * 30
  const h = Math.floor(dur / 3600)
  const m = Math.floor((dur % 3600) / 60)

  console.log(`Job ${e.jobNumber}: ${h}h${m}m × $30 = $${correct.toFixed(2)}  (antes: $${e.calculatedAmount?.toFixed(2)})`)

  await prisma.timeEntry.update({
    where: { id: e.id },
    data: { calculatedAmount: correct }
  })

  if (e.weekId) weeksToUpdate.add({ weekId: e.weekId, userId: e.userId })
  const d = new Date(e.date)
  monthsToUpdate.add(JSON.stringify({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, userId: e.userId }))
}

// Recalcular totales de semanas afectadas
for (const w of weeksToUpdate) {
  const weekEntries = await prisma.timeEntry.findMany({
    where: { weekId: w.weekId, endTime: { not: null } },
    select: { duration: true, calculatedAmount: true }
  })
  const earnings = weekEntries.reduce((s, e) => s + (e.calculatedAmount ?? (e.duration ?? 0) / 3600 * 30), 0)
  const totalHours = weekEntries.reduce((s, e) => s + (e.duration ?? 0), 0) / 3600
  await prisma.week.update({ where: { id: w.weekId }, data: { totalHours, earnings } })
  console.log(`  Semana ${w.weekId} → ${totalHours.toFixed(2)}h  $${earnings.toFixed(2)}`)
}

// Recalcular totales de meses afectados
for (const raw of monthsToUpdate) {
  const { year, month, userId } = JSON.parse(raw)
  const monthEntries = await prisma.timeEntry.findMany({
    where: { userId, endTime: { not: null }, week: { year, month } },
    select: { duration: true, calculatedAmount: true }
  })
  const earnings = monthEntries.reduce((s, e) => s + (e.calculatedAmount ?? (e.duration ?? 0) / 3600 * 30), 0)
  const totalHours = monthEntries.reduce((s, e) => s + (e.duration ?? 0), 0) / 3600
  await prisma.monthSummary.updateMany({
    where: { userId, year, month },
    data: { totalHours, earnings }
  })
  console.log(`  Mes ${year}-${String(month).padStart(2,'0')} → ${totalHours.toFixed(2)}h  $${earnings.toFixed(2)}`)
}

console.log('\n✓ Correcciones aplicadas')
await prisma.$disconnect()
