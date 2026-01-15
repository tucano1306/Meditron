import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Rutas públicas que no requieren autenticación
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register')
  const isApiAuthRoute = pathname.startsWith('/api/auth')
  const isPublicAsset = pathname.startsWith('/_next') || 
                        pathname.startsWith('/favicon') ||
                        pathname === '/manifest.json' ||
                        pathname === '/sw.js' ||
                        pathname.startsWith('/icons')
  
  if (isPublicAsset) {
    return NextResponse.next()
  }

  // Obtener sesión
  const session = await auth()
  const isLoggedIn = !!session

  // Si es una ruta de API (excepto auth), verificar autenticación
  if (pathname.startsWith('/api') && !isApiAuthRoute) {
    if (!isLoggedIn) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }
    return NextResponse.next()
  }

  // Si está logueado y trata de ir a login/register, redirigir a mode-select
  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL('/mode-select', request.url))
  }

  // Si no está logueado y trata de ir a rutas protegidas (no públicas)
  if (!isLoggedIn && !isAuthPage && !isApiAuthRoute && pathname !== '/') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
