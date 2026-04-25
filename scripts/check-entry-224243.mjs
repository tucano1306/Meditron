import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const entries = await prisma.timeEntry.findMany({
  where: { jobNumber: '224243' },
  select: {
    id: true,
    startTime: true,
    endTime: true,
    duration: true,
    calculatedAmount: true,
    accumulatedSeconds: true,
    pausedAt: true,
    lastResumeTime: true,
    userId: true,
  }
})

for (const e of entries) {
  const dur = e.duration ?? 0
  const h = Math.floor(dur / 3600)
  const m = Math.floor((dur % 3600) / 60)
  const s = dur % 60

  const elapsed = e.endTime && e.startTime
    ? Math.floor((new Date(e.endTime).getTime() - new Date(e.startTime).getTime()) / 1000)
    : null

  console.log('ID:', e.id)
  console.log('startTime:', e.startTime)
  console.log('endTime:', e.endTime)
  console.log('duration (stored):', dur, '=', `${h}h ${m}m ${s}s`)
  if (elapsed !== null) {
    const eh = Math.floor(elapsed / 3600)
    const em = Math.floor((elapsed % 3600) / 60)
    console.log('real elapsed (endTime-startTime):', elapsed, 's =', `${eh}h ${em}m`)
  }
  console.log('accumulatedSeconds:', e.accumulatedSeconds)
  console.log('pausedAt:', e.pausedAt)
  console.log('lastResumeTime:', e.lastResumeTime)
  console.log('calculatedAmount:', e.calculatedAmount)
  console.log('---')
}

await prisma.$disconnect()
