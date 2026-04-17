'use client'

import { useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { Clock, DollarSign, LogOut, ChevronRight } from 'lucide-react'
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
      <div className="min-h-screen bg-[#ffffff] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-[#37352f] border-t-transparent rounded-full animate-spin" />
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

  const userName = session?.user?.name || session?.user?.email?.split('@')[0] || ''

  return (
    <div className="min-h-[100dvh] bg-[#ffffff] font-notion">
      {/* Topbar */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-[rgba(55,53,47,0.09)]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-[#37352f] rounded flex items-center justify-center">
            <Clock className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-[14px] font-semibold text-[#37352f]">Meditron</span>
        </div>
        <div className="flex items-center gap-3">
          {userName && (
            <span className="text-[13px] text-[#787774] hidden sm:inline">{userName}</span>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-[13px] text-[#787774] hover:text-[#37352f] hover:bg-[rgba(55,53,47,0.08)] px-2 py-1.5 rounded-[4px] transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-xl mx-auto px-4 pt-16 pb-8">
        {/* Title */}
        <div className="mb-10">
          <h1 className="text-[32px] font-bold text-[#37352f] leading-tight tracking-tight mb-1">
            {userName ? `Hola, ${userName}` : 'Bienvenido'}
          </h1>
          <p className="text-[#787774] text-[15px]">Selecciona el modo de trabajo</p>
        </div>

        {/* Mode cards */}
        <div className="space-y-2">
          {/* Por Hora */}
          <button
            type="button"
            onClick={() => handleModeSelect('hourly')}
            className="w-full flex items-center gap-4 px-4 py-4 rounded-[6px] border border-[rgba(55,53,47,0.09)] bg-white hover:bg-[rgba(55,53,47,0.04)] transition-colors text-left group touch-manipulation"
          >
            <div className="w-10 h-10 bg-[#37352f] rounded-[6px] flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-semibold text-[#37352f]">Por Hora</div>
              <div className="text-[13px] text-[#787774] mt-0.5">Registra tiempo y calcula ganancias por hora</div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#787774] group-hover:text-[#37352f] transition-colors flex-shrink-0" />
          </button>

          {/* Por Pago */}
          <button
            type="button"
            onClick={() => handleModeSelect('payment')}
            className="w-full flex items-center gap-4 px-4 py-4 rounded-[6px] border border-[rgba(55,53,47,0.09)] bg-white hover:bg-[rgba(55,53,47,0.04)] transition-colors text-left group touch-manipulation"
          >
            <div className="w-10 h-10 bg-[#37352f] rounded-[6px] flex items-center justify-center flex-shrink-0">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-semibold text-[#37352f]">Por Pago</div>
              <div className="text-[13px] text-[#787774] mt-0.5">Registra tiempo e ingresa el monto al finalizar</div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#787774] group-hover:text-[#37352f] transition-colors flex-shrink-0" />
          </button>
        </div>
      </main>
    </div>
  )
}
