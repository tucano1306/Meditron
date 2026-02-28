'use client'

import { useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { Clock, DollarSign, LogOut, User } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useEffect } from 'react'

export default function ModeSelectPage() {
  const router = useRouter()
  const { data: session, status } = useSession()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-blue-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const handleModeSelect = (mode: 'hourly' | 'payment') => {
    localStorage.setItem('meditron_mode', mode)
    router.push(mode === 'hourly' ? '/dashboard/hourly' : '/dashboard/payment')
  }

  const handleLogout = async () => {
    await signOut({ redirect: false })
    router.push('/login')
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-emerald-50 via-white to-blue-50 px-4 py-4 sm:p-4 pb-safe">
      <div className="max-w-2xl mx-auto pt-4 sm:pt-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 sm:mb-8">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center">
              <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900">Meditron</h1>
              <p className="text-xs sm:text-sm text-gray-500">Control de Tiempo</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-gray-600">
              <User className="w-4 h-4" />
              <span className="text-sm">{session?.user?.email}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-gray-500 hover:text-red-500"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Welcome */}
        <div className="text-center mb-8 sm:mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 sm:mb-3">
            ¡Bienvenido{session?.user?.name ? `, ${session.user.name}` : ''}!
          </h2>
          <p className="text-gray-500 text-base sm:text-lg">
            Selecciona el modo de trabajo
          </p>
        </div>

        {/* Mode Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {/* Por Hora */}
          <Card 
            className="border-0 shadow-xl shadow-emerald-100 cursor-pointer transition-all hover:scale-[1.02] sm:hover:scale-105 hover:shadow-2xl hover:shadow-emerald-200 group active:scale-[0.98] touch-manipulation"
            onClick={() => handleModeSelect('hourly')}
          >
            <CardContent className="p-6 sm:p-8 text-center">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6 group-hover:scale-110 transition-transform">
                <Clock className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 sm:mb-3">Por Hora</h3>
              <p className="text-gray-500 text-sm sm:text-base">
                Registra tu tiempo de trabajo y calcula automáticamente tus ganancias basado en tu tarifa por hora.
              </p>
            </CardContent>
          </Card>

          {/* Por Pago */}
          <Card 
            className="border-0 shadow-xl shadow-blue-100 cursor-pointer transition-all hover:scale-[1.02] sm:hover:scale-105 hover:shadow-2xl hover:shadow-blue-200 group active:scale-[0.98] touch-manipulation"
            onClick={() => handleModeSelect('payment')}
          >
            <CardContent className="p-6 sm:p-8 text-center">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6 group-hover:scale-110 transition-transform">
                <DollarSign className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 sm:mb-3">Por Pago</h3>
              <p className="text-gray-500 text-sm sm:text-base">
                Registra el tiempo de trabajo y al finalizar ingresa el monto del pago para calcular tu tarifa por hora.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
