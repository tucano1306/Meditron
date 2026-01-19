// Script para corregir el trabajo 203913 específicamente
// Ejecutar con: npx tsx scripts/fix-job-203913.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function getWeekNumber(date: Date): number {
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

async function main() {
  console.log('🔍 Buscando trabajo 203913...\n')

  const entry = await prisma.timeEntry.findFirst({
    where: { jobNumber: '203913' },
    include: { week: true, user: true }
  })

  if (!entry) {
    console.log('❌ No se encontró el trabajo 203913')
    await prisma.$disconnect()
    return
  }

  console.log('📝 Trabajo encontrado:')
  console.log(`   ID: ${entry.id}`)
  console.log(`   Fecha actual: ${new Date(entry.date).toDateString()}`)
  console.log(`   Start time: ${new Date(entry.startTime).toLocaleString()}`)
  console.log(`   Semana actual: ${entry.week.weekNumber}`)

  // Corregir: restar un día para que sea domingo 18 en lugar de lunes 19
  const correctStartTime = new Date(entry.startTime)
  correctStartTime.setDate(correctStartTime.getDate() - 1)
  
  const correctEndTime = entry.endTime ? new Date(entry.endTime) : null
  if (correctEndTime) {
    correctEndTime.setDate(correctEndTime.getDate() - 1)
  }

  const correctDate = new Date(correctStartTime.getFullYear(), correctStartTime.getMonth(), correctStartTime.getDate())
  const correctWeekNumber = getWeekNumber(correctDate)

  console.log(`\n✨ Fecha corregida: ${correctDate.toDateString()}`)
  console.log(`   Start time corregido: ${correctStartTime.toLocaleString()}`)
  console.log(`   Semana correcta: ${correctWeekNumber}`)

  // Obtener o crear la semana correcta
  const { start, end } = getWeekStartEnd(correctDate)
  const year = correctDate.getFullYear()
  const month = correctDate.getMonth() + 1

  let correctWeek = await prisma.week.findUnique({
    where: {
      weekNumber_year_userId: { 
        weekNumber: correctWeekNumber, 
        year, 
        userId: entry.userId 
      }
    }
  })

  if (!correctWeek) {
    console.log(`\n📅 Creando semana ${correctWeekNumber}...`)
    correctWeek = await prisma.week.create({
      data: {
        weekNumber: correctWeekNumber,
        year,
        month,
        startDate: start,
        endDate: end,
        totalHours: 0,
        earnings: 0,
        userId: entry.userId
      }
    })
  }

  // Actualizar la entrada
  console.log(`\n🔧 Actualizando entrada...`)
  await prisma.timeEntry.update({
    where: { id: entry.id },
    data: {
      date: correctDate,
      startTime: correctStartTime,
      endTime: correctEndTime,
      weekId: correctWeek.id
    }
  })

  console.log(`✅ Trabajo 203913 corregido!`)
  console.log(`   Ahora está en la semana ${correctWeekNumber} (${correctDate.toDateString()})`)

  // Recalcular totales
  console.log(`\n📊 Recalculando totales...`)
  
  // Recalcular semana vieja
  const oldWeekEntries = await prisma.timeEntry.findMany({
    where: { weekId: entry.weekId, duration: { not: null } }
  })
  const oldTotalSeconds = oldWeekEntries.reduce((sum, e) => sum + (e.duration || 0), 0)
  await prisma.week.update({
    where: { id: entry.weekId },
    data: { 
      totalHours: oldTotalSeconds / 3600,
      earnings: (oldTotalSeconds / 3600) * 25
    }
  })

  // Recalcular semana nueva
  const newWeekEntries = await prisma.timeEntry.findMany({
    where: { weekId: correctWeek.id, duration: { not: null } }
  })
  const newTotalSeconds = newWeekEntries.reduce((sum, e) => sum + (e.duration || 0), 0)
  await prisma.week.update({
    where: { id: correctWeek.id },
    data: { 
      totalHours: newTotalSeconds / 3600,
      earnings: (newTotalSeconds / 3600) * 25
    }
  })

  console.log(`✅ Totales recalculados`)

  await prisma.$disconnect()
}

await main()
