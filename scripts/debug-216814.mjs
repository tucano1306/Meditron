import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const e = await prisma.timeEntry.findFirst({ where: { jobNumber: '216814' } });
console.log('jobNumber:', e.jobNumber);
console.log('startTime:', e.startTime);
console.log('endTime:', e.endTime);
console.log('duration:', e.duration, 's =', Math.floor(e.duration/3600)+'h', Math.floor((e.duration%3600)/60)+'m', (e.duration%60)+'s');
console.log('accumulatedSeconds:', e.accumulatedSeconds);
console.log('pausedAt:', e.pausedAt);
console.log('lastResumeTime:', e.lastResumeTime);
console.log('calculatedAmount:', e.calculatedAmount);

const raw = Math.round((new Date(e.endTime) - new Date(e.startTime)) / 1000);
console.log('\nendTime - startTime:', raw, 's =', Math.floor(raw/3600)+'h', Math.floor((raw%3600)/60)+'m', (raw%60)+'s');

if (e.lastResumeTime) {
  const seg = Math.round((new Date(e.endTime) - new Date(e.lastResumeTime)) / 1000);
  console.log('endTime - lastResumeTime:', seg, 's =', Math.floor(seg/3600)+'h', Math.floor((seg%3600)/60)+'m', (seg%60)+'s');
  console.log('accumulatedSeconds + lastSegment:', e.accumulatedSeconds + seg, 's');
  console.log('=> correct duration would be:', e.accumulatedSeconds + seg, 's');
} else {
  console.log('lastResumeTime: NULL — would use startTime as reference');
  const seg = Math.round((new Date(e.endTime) - new Date(e.startTime)) / 1000);
  console.log('accumulatedSeconds + (end-start):', e.accumulatedSeconds + seg, 's');
}

await prisma.$disconnect();
