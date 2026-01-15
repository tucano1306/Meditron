'use client'

import { useState, useEffect } from 'react'
import { Download, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Image from 'next/image'

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
  prompt(): Promise<void>
}

export function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showInstallBanner, setShowInstallBanner] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    // Check if already installed
    const isInstalled = globalThis.matchMedia('(display-mode: standalone)').matches
    setIsStandalone(isInstalled)

    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(globalThis as unknown as { MSStream?: unknown }).MSStream
    setIsIOS(iOS)

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShowInstallBanner(true)
    }

    globalThis.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // Show iOS instructions after a delay
    if (iOS && !isInstalled) {
      const timer = setTimeout(() => {
        setShowInstallBanner(true)
      }, 3000)
      return () => clearTimeout(timer)
    }

    return () => {
      globalThis.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'accepted') {
      setDeferredPrompt(null)
      setShowInstallBanner(false)
    }
  }

  const handleDismiss = () => {
    setShowInstallBanner(false)
    // Store dismissal in localStorage
    localStorage.setItem('pwa-install-dismissed', 'true')
  }

  // Don't show if already installed or dismissed
  if (isStandalone || !showInstallBanner) {
    return null
  }

  // Check if previously dismissed (only check on client side)
  if (globalThis.window !== undefined && localStorage.getItem('pwa-install-dismissed')) {
    return null
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg p-4 z-50 animate-slide-up">
      <div className="max-w-md mx-auto flex items-center gap-4">
        <div className="flex-shrink-0">
          <Image 
            src="/logo.png" 
            alt="Meditron" 
            width={48} 
            height={48} 
            className="rounded-xl"
          />
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 text-sm">Instalar Meditron</h3>
          {isIOS ? (
            <p className="text-xs text-gray-500 mt-0.5">
              Toca <span className="inline-flex items-center"><svg className="h-4 w-4 inline" fill="currentColor" viewBox="0 0 24 24"><path d="M12 16a1 1 0 0 1-.707-.293l-4-4a1 1 0 1 1 1.414-1.414L12 13.586l3.293-3.293a1 1 0 0 1 1.414 1.414l-4 4A1 1 0 0 1 12 16z"/><path d="M12 16a1 1 0 0 1-1-1V4a1 1 0 0 1 2 0v11a1 1 0 0 1-1 1z"/><path d="M20 21H4a1 1 0 0 1 0-2h16a1 1 0 0 1 0 2z"/></svg></span> y luego &quot;Agregar a inicio&quot;
            </p>
          ) : (
            <p className="text-xs text-gray-500 mt-0.5">
              Accede rápido desde tu pantalla de inicio
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!isIOS && (
            <Button
              onClick={handleInstallClick}
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Download className="h-4 w-4 mr-1" />
              Instalar
            </Button>
          )}
          <button
            onClick={handleDismiss}
            className="p-1 text-gray-400 hover:text-gray-600"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
