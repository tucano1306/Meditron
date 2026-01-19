// Script para corregir asignaciones de semana incorrectas
// Ejecutar con: npx tsx scripts/fix-week-assignment.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function getWeekNumber(date: Date): number {
  // Cálculo ISO 8601 usando fecha LOCAL
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const dayNum = d.getDay() || 7
  d.setDate(d.getDate() + 4 - dayNum)
  const yearStart = new Date(d.getFullYear(), 0, 1)
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

function getWeekStartEnd(date: Date): { start: Date; end: Date } {
  const day = date.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  
  const start = new Date(date)
  start.setDate(date.getDate() + diffToMonday)
  start.setHours(0, 0, 0, 0)
  
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  
  return { start, end }
}

async function getOrCreateWeek(date: Date, userId: string) {
  const { start, end } = getWeekStartEnd(date)
  const weekNumber = getWeekNumber(date)
  const year = date.getFullYear()
  const month = date.getMonth() + 1

  const existingWeek = await prisma.week.findUnique({
    where: {
      weekNumber_year_userId: { weekNumber, year, userId }
    }
  })

  if (existingWeek) return existingWeek

  return await prisma.week.create({
    data: {
      weekNumber,
      year,
      month,
      startDate: start,
      endDate: end,
      totalHours: 0,
      earnings: 0,
      userId
    }
  })
}

async function main() {
  console.log('🔍 Buscando entradas con asignación de semana incorrecta...\n')

  // Buscar todas las entradas de tiempo
  const timeEntries = await prisma.timeEntry.findMany({
    include: { week: true }
  })

  console.log(`📊 Total de TimeEntries: ${timeEntries.length}`)

  let fixedCount = 0
  for (const entry of timeEntries) {
    const entryDate = new Date(entry.date)
    const correctWeekNumber = getWeekNumber(entryDate)
    
    if (entry.week.weekNumber !== correctWeekNumber) {
      console.log(`\n❌ Entrada ID: ${entry.id}`)
      console.log(`   Job Number: ${entry.jobNumber || 'N/A'}`)
      console.log(`   Fecha: ${entryDate.toDateString()}`)
      console.log(`   Semana actual: ${entry.week.weekNumber} → Semana correcta: ${correctWeekNumber}`)
      
      // Obtener o crear la semana correcta
      const correctWeek = await getOrCreateWeek(entryDate, entry.userId)
      
      // Actualizar la entrada
      await prisma.timeEntry.update({
        where: { id: entry.id },
        data: { weekId: correctWeek.id }
      })
      
      console.log(`   ✅ Corregido! Ahora en semana ${correctWeek.weekNumber}`)
      fixedCount++
    }
  }

  if (fixedCount === 0) {
    console.log('\n✅ Todas las entradas tienen la semana correcta!')
  } else {
    console.log(`\n🔧 Se corrigieron ${fixedCount} entradas`)
    
    // Recalcular totales de semanas afectadas
    console.log('\n📊 Recalculando totales de semanas...')
    const weeks = await prisma.week.findMany()
    for (const week of weeks) {
      const entries = await prisma.timeEntry.findMany({
        where: { weekId: week.id, duration: { not: null } }
      })
      const totalSeconds = entries.reduce((sum, e) => sum + (e.duration || 0), 0)
      const totalHours = totalSeconds / 3600
      await prisma.week.update({
        where: { id: week.id },
        data: { totalHours, earnings: totalHours * 25 }
      })
    }
    console.log('✅ Totales recalculados')
  }

  await prisma.$disconnect()
}

await main()
