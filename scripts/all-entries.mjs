import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const entries = await prisma.timeEntry.findMany({
  where: { endTime: { not: null } },
  select: {
    date: true,
    jobNumber: true,
    vehicle: true,
    duration: true,
    calculatedAmount: true,
    paidAmount: true,
  },
  orderBy: { date: 'asc' }
})

let totalHours = 0
let totalCalc = 0
let totalPaid = 0

console.log(`${'Fecha'.padEnd(12)} ${'Job'.padEnd(8)} ${'Vehículo'.padEnd(12)} ${'Duración'.padEnd(10)} ${'Calculado'.padEnd(10)} ${'Pagado'.padEnd(10)}`)
console.log('-'.repeat(70))

for (const e of entries) {
  const dur = e.duration ?? 0
  const calc = e.calculatedAmount ?? 0
  const paid = e.paidAmount ?? 0
  const h = Math.floor(dur / 3600)
  const m = Math.floor((dur % 3600) / 60)
  const d = new Date(e.date).toISOString().split('T')[0]

  totalHours += dur / 3600
  totalCalc += calc
  totalPaid += paid

  let paidStr = '-'
  if (e.paidAmount != null) paidStr = `$${paid.toFixed(2)}`
  console.log(
    `${d.padEnd(12)} ${(e.jobNumber ?? '(sin job)').padEnd(8)} ${(e.vehicle ?? '-').padEnd(12)} ${(h + 'h ' + m + 'm').padEnd(10)} $${calc.toFixed(2).padEnd(9)} ${paidStr}`
  )
}

console.log('-'.repeat(70))
console.log(`${'TOTAL'.padEnd(12)} ${''.padEnd(8)} ${''.padEnd(12)} ${(Math.floor(totalHours) + 'h ' + Math.floor((totalHours % 1) * 60) + 'm').padEnd(10)} $${totalCalc.toFixed(2).padEnd(9)} $${totalPaid.toFixed(2)}`)
console.log(`\nTotal entradas: ${entries.length}`)

await prisma.$disconnect()
