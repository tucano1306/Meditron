// Migración de datos a compañías configurables (una sola vez, tras aplicar la
// migración 20261010000000_add_companies).
//
// Antes, la compañía de cada trabajo salía de su nota: si decía "Tecnofuel" era
// de Tecnofuel y si no, de Larry's Private. Este script, para cada usuario con
// trabajos y sin compañías, crea esas dos compañías con su configuración y
// asigna cada trabajo a la suya. Es idempotente: no toca usuarios que ya tienen
// compañías ni trabajos que ya tienen compañía.
//
// Uso:  npx jiti scripts/backfill-companies.ts            (muestra lo que haría)
//       npx jiti scripts/backfill-companies.ts --apply    (lo aplica)

import { prisma } from '../src/lib/prisma'
import { getUserCompanies } from '../src/lib/company-store'
import { recalculateCompanyAmounts } from '../src/lib/pay-periods'
import { dateKeyToUTC, FIRST_RULE_DATE, toDateKey } from '../src/lib/companies'

const APPLY = process.argv.includes('--apply')
const TECNOFUEL_NOTE = /te(?:c|ch)no[\s-]*fuel/i

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, email: true, hourlyRate: true } })
  for (const user of users) {
    const label = user.email.replace(/^(.).*@/, '$1***@')
    const existing = await prisma.company.count({ where: { userId: user.id } })
    const entries = await prisma.timeEntry.findMany({
      where: { userId: user.id, companyId: null },
      select: { id: true, observation: true, date: true },
    })
    const tecnofuelIds = entries.filter(e => e.observation && TECNOFUEL_NOTE.test(e.observation)).map(e => e.id)
    console.log(`${label}: ${existing} compañías, ${entries.length} trabajos sin compañía (${tecnofuelIds.length} de Tecnofuel)`)

    if (existing > 0 || entries.length === 0) continue
    if (!APPLY) {
      console.log(`  → crearía "Larry's Private" ($${user.hourlyRate}/h, lun–dom)${tecnofuelIds.length ? ' y "Tecnofuel" ($28/h, +40 h a 1.5x, dom–sáb)' : ''} y asignaría los trabajos`)
      continue
    }

    const firstRule = dateKeyToUTC(FIRST_RULE_DATE)
    const larrys = await prisma.company.create({
      data: {
        userId: user.id,
        name: "Larry's Private",
        color: '#37352f',
        weekStartsOn: 1,
        trackJobNumber: true,
        trackVehicle: true,
        trackServiceType: true,
        trackCompanyPaid: true,
        sortOrder: 0,
        payRules: { create: { effectiveFrom: firstRule, payType: 'hourly', hourlyRate: user.hourlyRate } },
      },
    })
    const tecnofuel = tecnofuelIds.length === 0 ? null : await prisma.company.create({
      data: {
        userId: user.id,
        name: 'Tecnofuel',
        color: '#d9730d',
        weekStartsOn: 0,
        sortOrder: 1,
        payRules: {
          create: { effectiveFrom: firstRule, payType: 'weekly_overtime', hourlyRate: 28, overtimeAfterHours: 40, overtimeMultiplier: 1.5 },
        },
      },
    })

    if (tecnofuel) {
      await prisma.timeEntry.updateMany({ where: { id: { in: tecnofuelIds }, companyId: null }, data: { companyId: tecnofuel.id } })
    }
    const rest = await prisma.timeEntry.updateMany({ where: { userId: user.id, companyId: null }, data: { companyId: larrys.id } })
    console.log(`  → Larry's Private: ${rest.count} trabajos${tecnofuel ? ` · Tecnofuel: ${tecnofuelIds.length} trabajos` : ''}`)

    // Montos de Tecnofuel con el overtime de cada semana
    if (tecnofuel) {
      const companies = await getUserCompanies(user.id)
      const config = companies.find(c => c.id === tecnofuel.id)
      const dates = [...new Set(entries.filter(e => tecnofuelIds.includes(e.id)).map(e => toDateKey(e.date)))]
      if (config) await recalculateCompanyAmounts(user.id, config, dates)
    }
  }
  if (!APPLY) console.log('\nModo prueba: no se cambió nada. Ejecuta con --apply para aplicar.')
}

main()
  .catch(err => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
