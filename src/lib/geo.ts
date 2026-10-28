// Distancias para marcar entrada y salida desde la oficina. Sin dependencias:
// lo usan el servidor (que decide) y las pantallas (que avisan antes).

export const METERS_PER_MILE = 1609.344

/** Precisión máxima aceptada del GPS: con más error la ubicación no sirve */
export const MAX_ACCURACY_METERS = 800

/** Distancia en metros entre dos puntos (fórmula de haversine) */
export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)))
}

/** "0.4 millas", "250 pies" */
export function formatDistance(meters: number): string {
  const miles = meters / METERS_PER_MILE
  if (miles < 0.1) return `${Math.round(meters * 3.28084)} pies`
  const value = miles.toFixed(miles < 10 ? 1 : 0).replace(/\.0$/, '')
  return `${value} ${value === '1' ? 'milla' : 'millas'}`
}

export function isValidCoordinate(lat: unknown, lng: unknown): boolean {
  return typeof lat === 'number' && typeof lng === 'number'
    && Number.isFinite(lat) && Number.isFinite(lng)
    && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
}

export interface Place {
  latitude: number
  longitude: number
  radiusMeters: number
}

/** Oficina más cercana a un punto y a cuántos metros está */
export function nearestPlace<T extends Place>(places: T[], lat: number, lng: number): { place: T; distance: number } | null {
  let best: { place: T; distance: number } | null = null
  for (const place of places) {
    const distance = distanceMeters(lat, lng, place.latitude, place.longitude)
    if (!best || distance < best.distance) best = { place, distance }
  }
  return best
}

/** Enlace para ver un punto en Google Maps */
export function mapsLink(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`
}
