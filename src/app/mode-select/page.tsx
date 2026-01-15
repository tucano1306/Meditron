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
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-blue-50 p-4">
      <div className="max-w-2xl mx-auto pt-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center">
              <Clock className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Meditron</h1>
              <p className="text-sm text-gray-500">Control de Tiempo</p>
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
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">
            ¡Bienvenido{session?.user?.name ? `, ${session.user.name}` : ''}!
          </h2>
          <p className="text-gray-500 text-lg">
            Selecciona el modo de trabajo
          </p>
        </div>

        {/* Mode Cards */}
        <div className="grid sm:grid-cols-2 gap-6">
          {/* Por Hora */}
          <Card 
            className="border-0 shadow-xl shadow-emerald-100 cursor-pointer transition-all hover:scale-105 hover:shadow-2xl hover:shadow-emerald-200 group"
            onClick={() => handleModeSelect('hourly')}
          >
            <CardContent className="p-8 text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                <Clock className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Por Hora</h3>
              <p className="text-gray-500 mb-6">
                Registra tu tiempo de trabajo y calcula automáticamente tus ganancias basado en tu tarifa por hora.
              </p>
              <div className="bg-emerald-50 rounded-xl p-4">
                <ul className="text-sm text-gray-600 space-y-2 text-left">
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                    Cronómetro en tiempo real
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                    Cálculo automático de ganancias
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                    Reportes semanales y mensuales
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Por Pago */}
          <Card 
            className="border-0 shadow-xl shadow-blue-100 cursor-pointer transition-all hover:scale-105 hover:shadow-2xl hover:shadow-blue-200 group"
            onClick={() => handleModeSelect('payment')}
          >
            <CardContent className="p-8 text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                <DollarSign className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Por Pago</h3>
              <p className="text-gray-500 mb-6">
                Registra el tiempo de trabajo y al finalizar ingresa el monto del pago para calcular tu tarifa por hora.
              </p>
              <div className="bg-blue-50 rounded-xl p-4">
                <ul className="text-sm text-gray-600 space-y-2 text-left">
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                    Cronómetro de trabajo
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                    Ingreso de monto al finalizar
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                    Cálculo de tarifa por hora real
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
