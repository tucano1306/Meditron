import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const entries = await prisma.timeEntry.findMany({
  where: { endTime: { not: null }, duration: { not: null }, calculatedAmount: { not: null } },
  select: { date: true, jobNumber: true, vehicle: true, duration: true, calculatedAmount: true, paidAmount: true },
  orderBy: { date: 'asc' }
})

const at25 = entries.filter(e => Math.abs((e.calculatedAmount / e.duration) * 3600 - 25) < 0.02)

let totalCalc = 0, totalPaid = 0, totalDur = 0

console.log('Fecha        Job      Vehículo     Duración   A $25      Pagado     Diferencia')
console.log('-'.repeat(88))

for (const e of at25) {
  const dur = e.duration
  const calc = e.calculatedAmount
  const paid = e.paidAmount ?? 0
  const h = Math.floor(dur / 3600)
  const m = Math.floor((dur % 3600) / 60)
  const diff = paid - calc
  const d = new Date(e.date).toISOString().split('T')[0]
  totalCalc += calc
  totalPaid += paid
  totalDur += dur

  const diffStr = (diff >= 0 ? '+' : '') + '$' + diff.toFixed(2)
  console.log(
    d.padEnd(13) +
    (e.jobNumber ?? '').padEnd(9) +
    (e.vehicle ?? '-').padEnd(13) +
    (h + 'h ' + m + 'm').padEnd(11) +
    ('$' + calc.toFixed(2)).padEnd(11) +
    ('$' + paid.toFixed(2)).padEnd(11) +
    diffStr
  )
}

console.log('-'.repeat(88))
const th = Math.floor(totalDur / 3600)
const tm = Math.floor(((totalDur / 3600) % 1) * 60)
const tdiff = totalPaid - totalCalc
console.log(
  'TOTAL'.padEnd(13) + ''.padEnd(9) + ''.padEnd(13) +
  (th + 'h ' + tm + 'm').padEnd(11) +
  ('$' + totalCalc.toFixed(2)).padEnd(11) +
  ('$' + totalPaid.toFixed(2)).padEnd(11) +
  (tdiff >= 0 ? '+' : '') + '$' + tdiff.toFixed(2)
)
console.log('\nTotal entradas a $25/hr: ' + at25.length)

// También mostrar el job 224110 (16 abril, quedó en $25 después del fix)
const extra = entries.filter(e => e.jobNumber === '224110')
if (extra.length) {
  console.log('\n⚠️  Job 224110 (16 abril) sigue a $25/hr — ¿fue intencional?')
  for (const e of extra) {
    const dur = e.duration, h = Math.floor(dur/3600), m = Math.floor((dur%3600)/60)
    console.log(`   ${e.jobNumber}  ${h}h${m}m  calculado=$${e.calculatedAmount?.toFixed(2)}  pagado=$${e.paidAmount?.toFixed(2) ?? '-'}`)
  }
}

await prisma.$disconnect()
