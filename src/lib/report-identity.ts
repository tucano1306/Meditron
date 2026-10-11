// Cómo se identifica a la persona en sus reportes (PDF, correo y nombre del
// archivo): nombre completo y, si tiene, su empresa — "Leonardo Canepa / Venecoro".
// En nómina puede haber varios "Leo", por eso se pide el nombre completo.

export const MAX_PROFILE_FIELD = 80

export interface ReportIdentity {
  /** Nombre de la persona (o lo que va antes de la @ si no escribió ninguno) */
  name: string
  businessName: string | null
  /** "Leonardo Canepa / Venecoro" o solo el nombre */
  label: string
}

/** Quita espacios de más: "  Leonardo   Canepa " → "Leonardo Canepa" */
export function cleanProfileText(value: string): string {
  return value.replaceAll(/\s+/g, ' ').trim()
}

export function reportIdentity(user: { email: string; name: string | null; businessName?: string | null }): ReportIdentity {
  const name = cleanProfileText(user.name ?? '') || user.email.split('@')[0]
  const businessName = cleanProfileText(user.businessName ?? '') || null
  return { name, businessName, label: businessName ? `${name} / ${businessName}` : name }
}

/** Un solo nombre ("Leo") no basta para que en nómina sepan de quién es el reporte */
export function needsFullName(name: string | null): boolean {
  return cleanProfileText(name ?? '').split(' ').filter(Boolean).length < 2
}
