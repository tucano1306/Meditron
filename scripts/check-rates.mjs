import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const entries = await prisma.timeEntry.findMany({
  where: {
    endTime: { not: null },
    duration: { not: null },
    calculatedAmount: { not: null },
  },
  select: {
    id: true,
    jobNumber: true,
    date: true,
    duration: true,
    calculatedAmount: true,
  },
  orderBy: { date: 'asc' }
})

let at25 = 0, at30 = 0, other = 0

for (const e of entries) {
  const dur = e.duration ?? 0
  const amt = e.calculatedAmount ?? 0
  if (dur === 0) continue

  const impliedRate = (amt / dur) * 3600
  const r25 = Math.abs(impliedRate - 25) < 0.01
  const r30 = Math.abs(impliedRate - 30) < 0.01

  const d = new Date(e.date).toISOString().split('T')[0]
  const h = Math.floor(dur / 3600)
  const m = Math.floor((dur % 3600) / 60)
  let label
  if (r25) label = '@$25'
  else if (r30) label = '@$30'
  else label = `@$${impliedRate.toFixed(2)}`

  console.log(`${d}  job ${e.jobNumber ?? '(sin job)'}  ${h}h${m}m  $${amt.toFixed(2)}  ${label}`)

  if (r25) at25++
  else if (r30) at30++
  else other++
}

console.log(`\nResumen:`)
console.log(`  A $25/hr: ${at25} entradas`)
console.log(`  A $30/hr: ${at30} entradas`)
console.log(`  Otra tasa: ${other} entradas`)

await prisma.$disconnect()
