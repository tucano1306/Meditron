import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Search in paymentEntry
  const payments = await prisma.paymentEntry.findMany({
    where: { jobNumber: '216578' },
    orderBy: { startTime: 'desc' }
  })

  if (payments.length > 0) {
    console.log('PaymentEntries found:', payments.length)
    for (const e of payments) {
      console.log({
        id: e.id,
        date: e.date.toISOString().slice(0, 10),
        startTime: e.startTime.toISOString(),
        endTime: e.endTime?.toISOString(),
        completed: e.completed,
        amount: e.amount
      })
    }
  }

  // Search in timeEntry
  const timeEntries = await prisma.timeEntry.findMany({
    where: { jobNumber: '216578' },
    include: { week: true },
    orderBy: { startTime: 'desc' }
  })

  if (timeEntries.length > 0) {
    console.log('TimeEntries found:', timeEntries.length)
    for (const e of timeEntries) {
      console.log({
        id: e.id,
        date: e.date.toISOString().slice(0, 10),
        startTime: e.startTime.toISOString(),
        weekNumber: e.week.weekNumber,
        weekYear: e.week.year,
        weekId: e.weekId
      })
    }
  }

  if (payments.length === 0 && timeEntries.length === 0) {
    console.log('No entries found with jobNumber 216578')
  }
}

try {
  await main()
} catch (err) {
  console.error(err)
} finally {
  await prisma.$disconnect()
}
