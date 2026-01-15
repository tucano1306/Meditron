import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Rutas públicas que no requieren autenticación
  const isAuthPage = pathname === '/login' || pathname === '/register'
  const isApiAuthRoute = pathname.startsWith('/api/auth')
  const isPublicAsset = pathname.startsWith('/_next') || 
                        pathname.includes('.') ||
                        pathname === '/manifest.json' ||
                        pathname === '/sw.js'
  
  if (isPublicAsset || isApiAuthRoute) {
    return NextResponse.next()
  }

  // Verificar token JWT directamente (no usa Prisma)
  const token = await getToken({ 
    req: request, 
    secret: process.env.NEXTAUTH_SECRET 
  })
  const isLoggedIn = !!token

  // Si es una ruta de API protegida, verificar autenticación
  if (pathname.startsWith('/api')) {
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

  // Si no está logueado y trata de ir a rutas protegidas
  if (!isLoggedIn && !isAuthPage && pathname !== '/') {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  
  // Si no está logueado y está en la raíz, redirigir a login
  if (!isLoggedIn && pathname === '/') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
