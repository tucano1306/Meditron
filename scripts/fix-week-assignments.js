const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Calcula el número de semana ISO desde una fecha UTC midnight (@db.Date)
function getWeekNumberFromDate(date) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const d = new Date(year, month, day);
  const dayOfWeek = d.getDay();
  const isoDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;
  const thursday = new Date(d);
  thursday.setDate(d.getDate() + (4 - isoDayOfWeek));
  const isoYear = thursday.getFullYear();
  const jan4 = new Date(isoYear, 0, 4);
  const jan4DayOfWeek = jan4.getDay() === 0 ? 7 : jan4.getDay();
  const firstThursday = new Date(isoYear, 0, 4 - jan4DayOfWeek + 4);
  return Math.round((thursday.getTime() - firstThursday.getTime()) / 604800000) + 1;
}

function getWeekStartEnd(weekNumber, year) {
  const jan4 = new Date(year, 0, 4);
  const jan4DayOfWeek = jan4.getDay();
  const isoJan4DayOfWeek = jan4DayOfWeek === 0 ? 7 : jan4DayOfWeek;
  const firstMonday = new Date(year, 0, 4 - isoJan4DayOfWeek + 1);
  const start = new Date(firstMonday);
  start.setDate(firstMonday.getDate() + (weekNumber - 1) * 7);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

async function fixMisassignedEntries() {
  console.log('=== Fixing misassigned time entries ===\n');

  // Get all time entries with their weeks
  const entries = await prisma.timeEntry.findMany({
    include: { week: true },
    orderBy: { startTime: 'asc' }
  });

  let fixedCount = 0;
  let skippedCount = 0;

  for (const entry of entries) {
    const entryDate = new Date(entry.date);
    const correctWeekNumber = getWeekNumberFromDate(entryDate);
    const correctYear = entryDate.getUTCFullYear();

    if (entry.week.weekNumber !== correctWeekNumber || entry.week.year !== correctYear) {
      console.log(`MISMATCH: Entry ${entry.id}`);
      console.log(`  Date: ${entryDate.toISOString().slice(0, 10)}`);
      console.log(`  Current: Week ${entry.week.weekNumber}/${entry.week.year} (${entry.week.startDate?.toISOString().slice(0, 10)} - ${entry.week.endDate?.toISOString().slice(0, 10)})`);
      console.log(`  Correct: Week ${correctWeekNumber}/${correctYear}`);

      // Find or create the correct week
      let correctWeek = await prisma.week.findUnique({
        where: {
          weekNumber_year_userId: {
            weekNumber: correctWeekNumber,
            year: correctYear,
            userId: entry.userId
          }
        }
      });

      if (!correctWeek) {
        const { start, end } = getWeekStartEnd(correctWeekNumber, correctYear);
        const month = entryDate.getUTCMonth() + 1;
        correctWeek = await prisma.week.create({
          data: {
            weekNumber: correctWeekNumber,
            year: correctYear,
            month,
            startDate: start,
            endDate: end,
            totalHours: 0,
            earnings: 0,
            userId: entry.userId
          }
        });
        console.log(`  Created new week: ${correctWeek.id}`);
      }

      // Update the entry
      await prisma.timeEntry.update({
        where: { id: entry.id },
        data: { weekId: correctWeek.id }
      });
      console.log(`  FIXED: Moved to week ${correctWeekNumber}\n`);
      fixedCount++;
    } else {
      skippedCount++;
    }
  }

  // Now recalculate all week totals
  console.log('\n=== Recalculating week totals ===');
  const HOURLY_RATE = 25;
  const weeks = await prisma.week.findMany({
    include: { entries: true }
  });

  for (const week of weeks) {
    const totalSeconds = week.entries.reduce((sum, e) => sum + (e.duration || 0), 0);
    const totalHours = totalSeconds / 3600;
    const earnings = totalHours * HOURLY_RATE;

    if (week.entries.length === 0) {
      await prisma.week.delete({ where: { id: week.id } });
      console.log(`  Deleted empty week: ${week.weekNumber}/${week.year}`);
    } else {
      await prisma.week.update({
        where: { id: week.id },
        data: { totalHours, earnings }
      });
    }
  }

  console.log(`\n=== Done ===`);
  console.log(`Fixed: ${fixedCount} entries`);
  console.log(`Already correct: ${skippedCount} entries`);

  await prisma.$disconnect();
}

await fixMisassignedEntries();
