import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const found = await prisma.timeEntry.findFirst({ where: { jobNumber: '216814' } });
if (!found) { console.log('No encontrado'); await prisma.$disconnect(); process.exit(1); }

const e = await prisma.timeEntry.update({
  where: { id: found.id },
  data: { accumulatedSeconds: 0, pausedAt: null, lastResumeTime: null }
});

console.log('OK — Job', e.jobNumber, 'limpiado');
console.log('duration:', e.duration, 's =', Math.floor(e.duration/3600)+'h', Math.floor((e.duration%3600)/60)+'m');
console.log('calculatedAmount: $' + e.calculatedAmount);
console.log('accumulatedSeconds:', e.accumulatedSeconds);
console.log('pausedAt:', e.pausedAt);
console.log('lastResumeTime:', e.lastResumeTime);

await prisma.$disconnect();
