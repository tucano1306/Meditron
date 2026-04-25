import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function fmtDur(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}h ${m}m ${s}s`;
}

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
  console.log('AUDITORÍA COMPLETA — TRABAJOS A $30/HR');
  console.log('═'.repeat(100));

  let errors = 0;
  let ok = 0;

  for (const e of at30) {
    const start = new Date(e.startTime);
    const end = new Date(e.endTime);

    // Real elapsed from timestamps (accounting for accumulated pause seconds)
    const rawElapsed = Math.round((end - start) / 1000);
    const pausedSeconds = e.accumulatedSeconds ?? 0;
    const realElapsed = rawElapsed - pausedSeconds;

    // Duration discrepancy tolerance: 2 seconds rounding
    const durOk = Math.abs(realElapsed - e.duration) <= 2;

    // Expected amount at $30
    const expected = Math.round((e.duration / 3600) * 30 * 100) / 100;
    const amountOk = Math.abs(e.calculatedAmount - expected) < 0.02;

    // Florida date display
    const floridaOffset = -4 * 60; // EDT
    const floridaDate = new Date(start.getTime() + floridaOffset * 60000);
    const dateStr = floridaDate.toISOString().slice(0, 10);

    const status = durOk && amountOk ? '✓ OK ' : '✗ ERR';
    if (durOk && amountOk) ok++; else errors++;

    console.log(`\n${status}  ${dateStr}  Job ${e.jobNumber}  ${e.vehicle ?? 'sin vehículo'}  ${fmtDur(e.duration)}`);
    console.log(`   startTime: ${e.startTime.toISOString()}`);
    console.log(`   endTime:   ${e.endTime.toISOString()}`);
    console.log(`   elapsed real (end-start): ${fmtDur(rawElapsed)}  |  pausedSeconds: ${pausedSeconds}  |  neto: ${fmtDur(realElapsed)}`);
    console.log(`   duration stored: ${e.duration}s = ${fmtDur(e.duration)}`);
    console.log(`   calculatedAmount: $${e.calculatedAmount.toFixed(2)}  |  esperado ($30): $${expected.toFixed(2)}  |  pagado: ${e.paidAmount == null ? 'sin registro' : '$' + e.paidAmount.toFixed(2)}`);  

    if (!durOk) {
      console.log(`   ⚠️  DURACIÓN INCORRECTA: stored=${e.duration}s vs real=${realElapsed}s (diff=${realElapsed - e.duration}s)`);
    }
    if (!amountOk) {
      console.log(`   ⚠️  MONTO INCORRECTO: $${e.calculatedAmount.toFixed(2)} vs esperado $${expected.toFixed(2)} (diff=$${(e.calculatedAmount - expected).toFixed(2)})`);
    }
  }

  console.log('\n' + '═'.repeat(100));
  console.log(`RESUMEN: ${at30.length} entradas auditadas — ${errors} con errores — ${ok} correctas`);
  console.log('═'.repeat(100));
} catch (err) {
  console.error(err);
} finally {
  await prisma.$disconnect();
}
