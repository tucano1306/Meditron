import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  const { nextUrl } = req
  const isLoggedIn = !!req.auth

  const isAuthPage = nextUrl.pathname.startsWith('/login') || nextUrl.pathname.startsWith('/register')
  const isApiAuthRoute = nextUrl.pathname.startsWith('/api/auth')
  const isPublicRoute = nextUrl.pathname === '/' || isAuthPage || isApiAuthRoute

  // Si es una ruta de API (excepto auth), verificar autenticación
  if (nextUrl.pathname.startsWith('/api') && !isApiAuthRoute) {
    if (!isLoggedIn) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }
  }

  // Si está logueado y trata de ir a login/register, redirigir a mode-select
  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL('/mode-select', nextUrl))
  }

  // Si no está logueado y trata de ir a rutas protegidas
  if (!isLoggedIn && !isPublicRoute) {
    return NextResponse.redirect(new URL('/login', nextUrl))
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons).*)',
  ],
}
