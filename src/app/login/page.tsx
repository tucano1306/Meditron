'use client'

import { useState, useRef } from 'react'
import { signIn } from 'next-auth/react'
import Link from 'next/link'
import { Clock, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const passwordInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('Login attempt:', { email })
    setIsLoading(true)
    setError('')

    try {
      console.log('Calling signIn...')
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false
      })
      console.log('SignIn result:', result)

      if (result?.error) {
        setError('Email o contraseña incorrectos')
        setIsLoading(false)
      } else if (result?.ok) {
        // Usar globalThis.location para forzar redirección completa
        globalThis.location.href = '/mode-select'
      }
    } catch (err) {
      console.error('Login error:', err)
      setError('Error de conexión')
      setIsLoading(false)
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
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-blue-50 flex items-center justify-center p-4 pb-20">
      <div className="w-full max-w-md">
        {/* Logo y título */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl shadow-lg shadow-emerald-200 mb-4">
            <Clock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent">
            Meditron
          </h1>
          <p className="text-gray-500 mt-1">Control de Tiempo y Pagos</p>
        </div>

        <Card className="border-0 shadow-xl shadow-gray-200/50">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl">Iniciar Sesión</CardTitle>
            <CardDescription>
              Ingresa tus credenciales para continuar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div className="space-y-2">
                <label htmlFor="login-email" className="text-sm font-medium text-gray-700">
                  Correo electrónico
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={handleInputFocus}
                    placeholder="tu@email.com"
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all outline-none"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <label htmlFor="login-password" className="text-sm font-medium text-gray-700">
                  Contraseña
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    ref={passwordInputRef}
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={handleInputFocus}
                    placeholder="••••••••"
                    className="w-full pl-11 pr-14 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all outline-none"
                    required
                  />
                  <button
                    type="button"
                    onClick={toggleShowPassword}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 text-gray-400 hover:text-gray-600 active:text-emerald-600 touch-manipulation"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl text-center">
                  {error}
                </div>
              )}

              {/* Submit */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full py-6 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl font-medium text-lg shadow-lg shadow-emerald-200 transition-all"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Ingresando...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    Ingresar
                    <ArrowRight className="w-5 h-5" />
                  </div>
                )}
              </Button>
            </form>

            {/* Link a registro */}
            <div className="mt-6 text-center">
              <p className="text-gray-500">
                ¿No tienes cuenta?{' '}
                <Link href="/register" className="text-emerald-600 font-medium hover:underline">
                  Regístrate
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
