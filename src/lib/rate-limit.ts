// Límite de intentos guardado en la base de datos (funciona aunque Vercel
// reparta las peticiones entre varias instancias). Se usa para frenar la
// fuerza bruta en el inicio de sesión y la creación masiva de cuentas.

import { prisma } from './prisma'

/** Registros más viejos que esto ya no cuentan y se borran de vez en cuando */
const KEEP_MS = 24 * 3600 * 1000

/** Cuántos intentos lleva `key` dentro de la ventana */
export async function countHits(key: string, windowMs: number): Promise<number> {
  return prisma.rateLimitHit.count({ where: { key, createdAt: { gte: new Date(Date.now() - windowMs) } } })
}

/** Anota un intento de `key` */
export async function recordHit(key: string): Promise<void> {
  await prisma.rateLimitHit.create({ data: { key } })
  // Limpieza ocasional para que la tabla no crezca
  if (Math.random() < 0.05) {
    await prisma.rateLimitHit.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - KEEP_MS) } } })
  }
}

/** Olvida los intentos de `key` (p. ej. tras iniciar sesión bien) */
export async function clearHits(key: string): Promise<void> {
  await prisma.rateLimitHit.deleteMany({ where: { key } })
}

/** IP de quien hace la petición (Vercel la pone en x-forwarded-for) */
export function clientIp(headers: Headers | undefined | null): string {
  const forwarded = headers?.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || headers?.get('x-real-ip') || 'unknown'
}
