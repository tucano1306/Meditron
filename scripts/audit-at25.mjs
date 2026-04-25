import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const entries = await prisma.timeEntry.findMany({
  where: { endTime: { not: null }, duration: { not: null }, calculatedAmount: { not: null } },
  select: {
    id: true, date: true, jobNumber: true, vehicle: true,
    startTime: true, endTime: true,
    duration: true, accumulatedSeconds: true, pausedAt: true,
    calculatedAmount: true, paidAmount: true,
  },
  orderBy: { date: 'asc' }
})

// Todos los que tienen tasa ~$25
const at25 = entries.filter(e => Math.abs((e.calculatedAmount / e.duration) * 3600 - 25) < 0.02)
// Job 224110 también lo auditamos (quedó a $25 en abril)
const extra = entries.filter(e => e.jobNumber === '224110' && at25.every(x => x.id !== e.id))
const toAudit = [...at25, ...extra]

let issues = 0

console.log('═'.repeat(100))
console.log('AUDITORÍA COMPLETA — TRABAJOS A $25/HR')
console.log('═'.repeat(100))

for (const e of toAudit) {
  const dur = e.duration
  const calc = e.calculatedAmount
  const paid = e.paidAmount
  const h = Math.floor(dur / 3600)
  const m = Math.floor((dur % 3600) / 60)
  const s = dur % 60
  const d = new Date(e.date).toISOString().split('T')[0]

  // Verificar duración vs timestamps
  const realElapsed = Math.floor(
    (new Date(e.endTime).getTime() - new Date(e.startTime).getTime()) / 1000
  )
  const durationMatchesTimestamps = Math.abs(dur - realElapsed) <= 1

  // Si hubo pausas, la duración almacenada debería ser menor que el elapsed real
  const hasPauseHistory = e.accumulatedSeconds > 0 || e.pausedAt !== null

  // Verificar calculatedAmount vs duration × $25
  const expected25 = (dur / 3600) * 25
  const calcMatchesRate = Math.abs(calc - expected25) < 0.02

  // Determinar si hay problemas
  const problems = []
  if (!calcMatchesRate) {
    problems.push(`calculatedAmount=$${calc.toFixed(2)} pero ${h}h${m}m×$25=$${expected25.toFixed(2)} (diff=${(calc-expected25).toFixed(2)})`)
  }
  if (!durationMatchesTimestamps && !hasPauseHistory) {
    problems.push(`duración=${dur}s pero endTime-startTime=${realElapsed}s (diff=${realElapsed-dur}s)`)
  }

  const status = problems.length === 0 ? '✓ OK' : '✗ ERROR'
  if (problems.length > 0) issues++

  console.log(`\n${status}  ${d}  Job ${e.jobNumber}  ${e.vehicle ?? '-'}  ${h}h ${m}m ${s}s`)
  console.log(`   startTime: ${new Date(e.startTime).toISOString()}`)
  console.log(`   endTime:   ${new Date(e.endTime).toISOString()}`)
  console.log(`   elapsed real (end-start): ${Math.floor(realElapsed/3600)}h ${Math.floor((realElapsed%3600)/60)}m ${realElapsed%60}s  |  accumulatedSeconds: ${e.accumulatedSeconds}`)
  console.log(`   duration stored: ${dur}s = ${h}h ${m}m ${s}s`)
  let pagadoStr = 'sin registro'
  if (paid != null) pagadoStr = '$'+paid.toFixed(2)
  console.log(`   calculatedAmount: $${calc.toFixed(2)}  |  esperado ($25): $${expected25.toFixed(2)}  |  pagado: ${pagadoStr}`)
  if (problems.length > 0) {
    for (const p of problems) console.log(`   ⚠️  ${p}`)
  }
}

console.log('\n' + '═'.repeat(100))
console.log(`RESUMEN: ${toAudit.length} entradas auditadas — ${issues} con errores — ${toAudit.length - issues} correctas`)
console.log('═'.repeat(100))

await prisma.$disconnect()
