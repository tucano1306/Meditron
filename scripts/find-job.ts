// Script para buscar un trabajo específico por número
// Ejecutar con: npx tsx scripts/find-job.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const jobNumber = process.argv[2] || '203913'

console.log(`🔍 Buscando trabajo ${jobNumber}...\n`)

// Buscar en TimeEntry
const timeEntries = await prisma.timeEntry.findMany({
  where: { jobNumber },
  include: { week: true }
})

if (timeEntries.length > 0) {
  console.log(`📝 Encontrado en TimeEntry:`)
  for (const entry of timeEntries) {
    const date = new Date(entry.date)
    console.log(`   ID: ${entry.id}`)
    console.log(`   Fecha: ${date.toDateString()}`)
    console.log(`   Semana: ${entry.week.weekNumber}`)
    console.log(`   Start: ${new Date(entry.startTime).toLocaleString()}`)
    if (entry.endTime) {
      console.log(`   End: ${new Date(entry.endTime).toLocaleString()}`)
    }
    console.log(`   Duración: ${entry.duration ? Math.floor(entry.duration / 3600) : 0} horas`)
    console.log()
  }
}

// Buscar en PaymentEntry
const paymentEntries = await prisma.paymentEntry.findMany({
  where: { jobNumber }
})

if (paymentEntries.length > 0) {
  console.log(`💰 Encontrado en PaymentEntry:`)
  for (const entry of paymentEntries) {
    const date = new Date(entry.date)
    console.log(`   ID: ${entry.id}`)
    console.log(`   Fecha: ${date.toDateString()}`)
    console.log(`   Start: ${new Date(entry.startTime).toLocaleString()}`)
    if (entry.endTime) {
      console.log(`   End: ${new Date(entry.endTime).toLocaleString()}`)
    }
    console.log(`   Monto: $${entry.amount || 0}`)
    console.log()
  }
}

if (timeEntries.length === 0 && paymentEntries.length === 0) {
  console.log(`❌ No se encontró el trabajo ${jobNumber}`)
}

await prisma.$disconnect()
