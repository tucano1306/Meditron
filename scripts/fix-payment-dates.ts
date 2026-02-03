// Script para corregir las fechas de PaymentEntry
// La fecha debe basarse en la hora de FIN del trabajo en Florida timezone
// 
// EJECUTAR EN PRODUCCIÓN:
// DATABASE_URL="postgresql://..." npx tsx scripts/fix-payment-dates.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const FLORIDA_TIMEZONE = 'America/New_York'

function getFloridaDateComponents(date: Date): { year: number; month: number; day: number; hour: number; minute: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: FLORIDA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
  
  const parts = formatter.formatToParts(date)
  const get = (type: string) => parts.find(p => p.type === type)?.value || '0'
  
  return {
    year: Number.parseInt(get('year')),
    month: Number.parseInt(get('month')),
    day: Number.parseInt(get('day')),
    hour: Number.parseInt(get('hour')),
    minute: Number.parseInt(get('minute'))
  }
}

function getWeekNumber(year: number, month: number, day: number): number {
  const d = new Date(year, month - 1, day)
  const dayOfWeek = d.getDay()
  const isoDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek
  const thursday = new Date(d)
  thursday.setDate(d.getDate() + (4 - isoDayOfWeek))
  const isoYear = thursday.getFullYear()
  const jan4 = new Date(isoYear, 0, 4)
  const jan4DayOfWeek = jan4.getDay() === 0 ? 7 : jan4.getDay()
  const firstThursday = new Date(isoYear, 0, 4 - jan4DayOfWeek + 4)
  const weekNum = Math.round((thursday.getTime() - firstThursday.getTime()) / 604800000) + 1
  return weekNum
}

async function main() {
  console.log('=== Corrección de fechas de PaymentEntry ===\n')
  
  // Obtener todas las entradas completadas
  const entries = await prisma.paymentEntry.findMany({
    where: { completed: true },
    orderBy: { startTime: 'desc' }
  })
  
  console.log(`Total entradas completadas: ${entries.length}\n`)
  
  let corrected = 0
  
  for (const entry of entries) {
    if (!entry.endTime) {
      console.log(`⚠️  Entry ${entry.id} (Job #${entry.jobNumber}) - No tiene endTime, saltando`)
      continue
    }
    
    // Calcular la fecha correcta basada en endTime en Florida
    const floridaEnd = getFloridaDateComponents(entry.endTime)
    const correctDate = new Date(Date.UTC(floridaEnd.year, floridaEnd.month - 1, floridaEnd.day))
    
    // Obtener la fecha actual guardada
    const currentDate = new Date(entry.date)
    const currentDateStr = currentDate.toISOString().split('T')[0]
    const correctDateStr = correctDate.toISOString().split('T')[0]
    
    // Ver también la fecha basada en startTime para comparar
    const floridaStart = getFloridaDateComponents(entry.startTime)
    
    // Calcular semanas
    const currentWeek = getWeekNumber(currentDate.getUTCFullYear(), currentDate.getUTCMonth() + 1, currentDate.getUTCDate())
    const correctWeek = getWeekNumber(floridaEnd.year, floridaEnd.month, floridaEnd.day)
    
    console.log(`--- Job #${entry.jobNumber || 'N/A'} (ID: ${entry.id}) ---`)
    console.log(`  Vehicle: ${entry.vehicle || 'NO VEHICLE'}`)
    console.log(`  Start (Florida): ${floridaStart.day}/${floridaStart.month}/${floridaStart.year} ${String(floridaStart.hour).padStart(2, '0')}:${String(floridaStart.minute).padStart(2, '0')}`)
    console.log(`  End (Florida): ${floridaEnd.day}/${floridaEnd.month}/${floridaEnd.year} ${String(floridaEnd.hour).padStart(2, '0')}:${String(floridaEnd.minute).padStart(2, '0')}`)
    console.log(`  Fecha guardada: ${currentDateStr} (Semana ${currentWeek})`)
    console.log(`  Fecha correcta: ${correctDateStr} (Semana ${correctWeek})`)
    
    if (currentDateStr === correctDateStr) {
      console.log(`  ✓ Fecha correcta`)
    } else {
      console.log(`  🔧 CORRIGIENDO: ${currentDateStr} -> ${correctDateStr} (Semana ${currentWeek} -> ${correctWeek})`)
      
      await prisma.paymentEntry.update({
        where: { id: entry.id },
        data: { date: correctDate }
      })
      
      corrected++
    }
    console.log('')
  }
  
  console.log(`\n=== Resumen ===`)
  console.log(`Total entradas: ${entries.length}`)
  console.log(`Corregidas: ${corrected}`)
}

try {
  await main()
} catch (err) {
  console.error(err)
} finally {
  await prisma.$disconnect()
}
