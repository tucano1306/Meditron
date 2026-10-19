import type { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { recalculateCompanyAmounts } from './pay-periods'
import { splitEmails } from './company-input'
import {
  dateKeyToUTC,
  defaultCompany,
  FIRST_RULE_DATE,
  isPayType,
  toDateKey,
  type Company,
} from './companies'

const companyInclude = {
  payRules: { orderBy: { effectiveFrom: 'asc' } },
} satisfies Prisma.CompanyInclude

type DbCompany = Prisma.CompanyGetPayload<{ include: typeof companyInclude }>

export function serializeCompany(c: DbCompany): Company {
  return {
    id: c.id,
    name: c.name,
    color: c.color,
    weekStartsOn: c.weekStartsOn,
    trackJobNumber: c.trackJobNumber,
    trackVehicle: c.trackVehicle,
    trackServiceType: c.trackServiceType,
    trackCompanyPaid: c.trackCompanyPaid,
    archived: c.archived,
    sortOrder: c.sortOrder,
    reportEmails: splitEmails(c.reportEmails),
    autoSendReport: c.autoSendReport,
    breakMinutes: c.breakMinutes,
    breakAfterHours: c.breakAfterHours,
    payRules: c.payRules.map(r => ({
      id: r.id,
      effectiveFrom: toDateKey(r.effectiveFrom),
      payType: isPayType(r.payType) ? r.payType : 'hourly',
      hourlyRate: r.hourlyRate,
      overtimeAfterHours: r.overtimeAfterHours,
      overtimeMultiplier: r.overtimeMultiplier,
    })),
  }
}

async function loadCompanies(userId: string): Promise<Company[]> {
  const rows = await prisma.company.findMany({
    where: { userId },
    include: companyInclude,
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })
  return rows.map(serializeCompany)
}

// Compara el nombre de una compañía con el texto de una nota sin importar
// mayúsculas, acentos, espacios ni apóstrofos ("Larry's" ≈ "larrys").
function normalize(text: string): string {
  return text.normalize('NFD').replaceAll(/[\u0300-\u036f]/g, '').toLowerCase().replaceAll(/[^a-z0-9]/g, '')
}

export function noteMentionsCompany(note: string | null, company: Company): boolean {
  if (!note) return false
  const firstWord = normalize(company.name.split(/\s+/)[0] ?? '')
  return firstWord.length >= 3 && normalize(note).includes(firstWord)
}

/**
 * Trabajos sin compañía (creados antes de existir las compañías): van a la
 * compañía que mencione su nota o, si ninguna, a la compañía por defecto.
 */
async function adoptOrphanEntries(userId: string, companies: Company[]) {
  const orphans = await prisma.timeEntry.findMany({
    where: { userId, companyId: null },
    select: { id: true, observation: true, date: true },
  })
  const fallback = defaultCompany(companies)
  if (orphans.length === 0 || !fallback) return

  const byCompany = new Map<Company, typeof orphans>()
  for (const entry of orphans) {
    const company = companies.find(c => !c.archived && noteMentionsCompany(entry.observation, c)) ?? fallback
    byCompany.set(company, [...(byCompany.get(company) ?? []), entry])
  }
  for (const [company, entries] of byCompany) {
    await prisma.timeEntry.updateMany({
      where: { id: { in: entries.map(e => e.id) }, companyId: null },
      data: { companyId: company.id },
    })
    await recalculateCompanyAmounts(userId, company, entries.map(e => toDateKey(e.date)))
  }
}

/**
 * Compañías del usuario. Un usuario nuevo empieza con "Mi trabajo" (por hora,
 * con su tarifa) y puede crear o editar las suyas desde la app.
 */
export async function getUserCompanies(userId: string): Promise<Company[]> {
  let companies = await loadCompanies(userId)
  if (companies.length === 0) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { hourlyRate: true } })
    await prisma.company.create({
      data: {
        userId,
        name: 'Mi trabajo',
        payRules: {
          create: { effectiveFrom: dateKeyToUTC(FIRST_RULE_DATE), payType: 'hourly', hourlyRate: user?.hourlyRate ?? 25 },
        },
      },
    })
    companies = await loadCompanies(userId)
  }
  await adoptOrphanEntries(userId, companies)
  return companies
}

/** Compañía del usuario por id, o null si no existe o es de otra persona. */
export async function getUserCompany(userId: string, companyId: unknown): Promise<Company | null> {
  if (typeof companyId !== 'string' || !companyId) return null
  const companies = await getUserCompanies(userId)
  return companies.find(c => c.id === companyId) ?? null
}

/**
 * Compañía para guardar un trabajo: la indicada (si es del usuario) o la
 * compañía por defecto si no se indicó ninguna. null = id inválido.
 */
export async function resolveWriteCompany(userId: string, companyId: unknown): Promise<Company | null> {
  const companies = await getUserCompanies(userId)
  if (companyId === undefined || companyId === null || companyId === '') return defaultCompany(companies)
  return companies.find(c => c.id === companyId) ?? null
}
