import { prisma } from '../src/lib/prisma'
import { HOURLY_RATE } from '../src/lib/utils'

async function fixEntry() {
  const entryId = 'cmkuxp4zv0003sjxjjeor6wpf'
  const correctWeekId = 'cmkuxp4ye0001sjxj9eu0ttw3'  // Semana 5 (26 ene - 1 feb)
  const wrongWeekId = 'cmkkj86ka0001b54b4tee0qu9'     // Semana 4 (19-25 ene)
  
  // Obtener la entrada
  const entry = await prisma.timeEntry.findUnique({
    where: { id: entryId },
    include: { week: true }
  })
  
  if (!entry) {
    console.log('Entrada no encontrada')
    return
  }
  
  console.log('=== ANTES DE CORREGIR ===')
  console.log('Entry weekId:', entry.weekId)
  console.log('Week:', entry.week?.startDate, '-', entry.week?.endDate)
  
  // Actualizar la entrada para ponerla en la semana correcta
  await prisma.timeEntry.update({
    where: { id: entryId },
    data: { weekId: correctWeekId }
  })
  
  console.log('\n=== ENTRADA ACTUALIZADA ===')
  console.log('Nuevo weekId:', correctWeekId)
  
  // Recalcular totales de ambas semanas
  const userId = entry.userId
  
  // Semana 4 (la vieja)
  const week4Entries = await prisma.timeEntry.findMany({
    where: { weekId: wrongWeekId, userId, duration: { not: null } }
  })
  const week4Seconds = week4Entries.reduce((sum, e) => sum + (e.duration || 0), 0)
  const week4Hours = week4Seconds / 3600
  
  await prisma.week.update({
    where: { id: wrongWeekId },
    data: { totalHours: week4Hours, earnings: week4Hours * HOURLY_RATE }
  })
  console.log('\nSemana 4 actualizada: ', week4Hours, 'horas')
  
  // Semana 5 (la nueva)
  const week5Entries = await prisma.timeEntry.findMany({
    where: { weekId: correctWeekId, userId, duration: { not: null } }
  })
  const week5Seconds = week5Entries.reduce((sum, e) => sum + (e.duration || 0), 0)
  const week5Hours = week5Seconds / 3600
  
  await prisma.week.update({
    where: { id: correctWeekId },
    data: { totalHours: week5Hours, earnings: week5Hours * HOURLY_RATE }
  })
  console.log('Semana 5 actualizada: ', week5Hours, 'horas')
  
  // Verificar
  const verifyEntry = await prisma.timeEntry.findUnique({
    where: { id: entryId },
    include: { week: true }
  })
  
  console.log('\n=== VERIFICACIÓN ===')
  console.log('Entry weekId:', verifyEntry?.weekId)
  console.log('Week:', verifyEntry?.week?.startDate, '-', verifyEntry?.week?.endDate)
  
  await prisma.$disconnect()
}

await fixEntry()
