'use client'

import { useState, useRef } from 'react'
import { signIn } from 'next-auth/react'
import Link from 'next/link'
import { Clock, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'


export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const passwordInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false
    })

    if (result?.error) {
      setError('Email o contraseña incorrectos')
      setIsLoading(false)
    } else {
      globalThis.location.href = '/mode-select'
    }
  }

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    // Scroll para que el input sea visible sobre el teclado
    setTimeout(() => {
      e.target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 300)
  }

  const toggleShowPassword = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setShowPassword(!showPassword)
    // Mantener el foco en el input
    passwordInputRef.current?.focus()
  }

  return (
    <div className="min-h-[100dvh] bg-[#ffffff] flex items-center justify-center px-4 py-6">
      <div className="w-full max-w-[360px]">
        {/* Logo y título */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-10 h-10 bg-[#37352f] rounded-lg mb-4">
            <Clock className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-[28px] font-bold text-[#37352f] leading-tight tracking-tight">
            Meditron
          </h1>
          <p className="text-[#787774] mt-1 text-sm">Inicia sesión para continuar</p>
        </div>

        <div className="space-y-5">
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="login-email" className="text-[13px] font-medium text-[#37352f]">
                Correo electrónico
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#787774]" />
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={handleInputFocus}
                  placeholder="tu@email.com"
                  className="w-full pl-9 pr-4 py-2.5 text-sm rounded-[6px] border border-[rgba(55,53,47,0.16)] bg-white text-[#37352f] placeholder-[#787774] focus:outline-none focus:border-[#37352f] focus:ring-2 focus:ring-[rgba(55,53,47,0.12)] transition-all"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="login-password" className="text-[13px] font-medium text-[#37352f]">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#787774]" />
                <input
                  ref={passwordInputRef}
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={handleInputFocus}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-12 py-2.5 text-sm rounded-[6px] border border-[rgba(55,53,47,0.16)] bg-white text-[#37352f] placeholder-[#787774] focus:outline-none focus:border-[#37352f] focus:ring-2 focus:ring-[rgba(55,53,47,0.12)] transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={toggleShowPassword}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-[#787774] hover:text-[#37352f] touch-manipulation"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-[#fef2f2] text-[#dc2626] text-[13px] px-3 py-2.5 rounded-[6px] border border-[#fecaca]">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 mt-1 bg-[#37352f] hover:bg-[#2f2d28] disabled:opacity-60 text-white text-sm font-medium rounded-[6px] transition-colors flex items-center justify-center gap-2 touch-manipulation active:scale-[0.99]"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Ingresando...
                </>
              ) : (
                <>
                  Ingresar
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="border-t border-[rgba(55,53,47,0.09)]" />

          {/* Link a registro */}
          <p className="text-center text-[13px] text-[#787774]">
            ¿No tienes cuenta?{' '}
            <Link href="/register" className="text-[#37352f] font-medium underline underline-offset-2 hover:text-black">
              Regístrate
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
