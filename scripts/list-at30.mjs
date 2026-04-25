import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  const entries = await prisma.timeEntry.findMany({
    where: { endTime: { not: null } },
    orderBy: { startTime: 'asc' },
  });

  const at30 = entries.filter(e => {
    if (!e.calculatedAmount || !e.duration) return false;
    const implied = e.calculatedAmount / (e.duration / 3600);
    return Math.abs(implied - 30) < 0.5;
  });

  console.log('═'.repeat(100));
  console.log('TRABAJOS A $30/HR — LISTA COMPLETA');
  console.log('═'.repeat(100));

  let total = 0;
  for (const e of at30) {
    const start = new Date(e.startTime);

    // Florida date (UTC-4 in April, UTC-5 rest)
    const floridaOffset = -4 * 60;
    const floridaDate = new Date(start.getTime() + floridaOffset * 60000);
    const dateStr = floridaDate.toISOString().slice(0, 10);

    const h = Math.floor(e.duration / 3600);
    const m = Math.floor((e.duration % 3600) / 60);
    const s = e.duration % 60;
    const durStr = `${h}h ${m}m ${s}s`;

    const expected = Math.round((e.duration / 3600) * 30 * 100) / 100;

    console.log(`\n${dateStr}  Job ${e.jobNumber}  ${e.vehicle ?? 'sin vehículo'}  ${durStr}`);
    console.log(`   calculatedAmount: $${e.calculatedAmount.toFixed(2)}  |  esperado ($30): $${expected.toFixed(2)}  |  pagado: ${e.paidAmount == null ? 'sin registro' : '$' + e.paidAmount.toFixed(2)}`);  

    total += e.calculatedAmount;
  }

  console.log('\n' + '═'.repeat(100));
  console.log(`TOTAL: ${at30.length} trabajos  |  Suma calculatedAmount: $${total.toFixed(2)}`);
  console.log('═'.repeat(100));
} catch (err) {
  console.error(err);
} finally {
  await prisma.$disconnect();
}
