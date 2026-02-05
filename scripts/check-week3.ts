import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Limpiar todos los valores companyPaid
  const result = await prisma.timeEntry.updateMany({
    data: { companyPaid: null }
  })
  
  console.log('Entradas limpiadas:', result.count)
}

main().finally(() => prisma.$disconnect())
