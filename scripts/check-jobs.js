const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Buscar PaymentEntries de los últimos días
  const recent = await p.paymentEntry.findMany({
    orderBy: { startTime: 'desc' },
    take: 30
  });
  
  console.log('PaymentEntry recientes:', recent.length);
  recent.forEach(e => {
    const startUTC = e.startTime ? new Date(e.startTime) : null;
    const endUTC = e.endTime ? new Date(e.endTime) : null;
    const dateField = e.date ? new Date(e.date) : null;
    
    // Convertir a Florida time (UTC-5)
    const floridaStart = startUTC ? new Date(startUTC.toLocaleString('en-US', { timeZone: 'America/New_York' })) : null;
    const floridaEnd = endUTC ? new Date(endUTC.toLocaleString('en-US', { timeZone: 'America/New_York' })) : null;
    
    console.log(`\n--- Job #${e.jobNumber || 'N/A'} (ID: ${e.id}) ---`);
    console.log(`  Vehicle: ${e.vehicle || 'NO VEHICLE'}`);
    console.log(`  Start UTC: ${startUTC?.toISOString()}`);
    console.log(`  End UTC: ${endUTC?.toISOString()}`);
    console.log(`  Start Florida: ${floridaStart?.toLocaleString('es-ES', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`);
    console.log(`  End Florida: ${floridaEnd?.toLocaleString('es-ES', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`);
    console.log(`  Date field: ${dateField?.toISOString().split('T')[0]}`);
    console.log(`  Amount: $${e.amount}`);
    console.log(`  Completed: ${e.completed}`);
  });
}

main().finally(() => p.$disconnect());
