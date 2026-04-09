'use client'

import { useEffect, useState } from 'react'

export function useServiceWorker() {
  const isSupported = typeof navigator !== 'undefined' && 'serviceWorker' in navigator
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)

  useEffect(() => {
    if (isSupported) {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => {
          setRegistration(reg)
          console.log('Service Worker registered')
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error)
        })

      // Listen for messages from service worker
      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === 'TIMER_SYNC') {
          // Handle timer sync from background
          globalThis.dispatchEvent(new CustomEvent('timer-sync', { detail: event.data.data }))
        }
        if (event.data?.type === 'KEEP_ALIVE_PING') {
          // Respond to keep alive
          console.log('Keep alive ping received')
        }
      }

      navigator.serviceWorker.addEventListener('message', handleMessage)

      return () => {
        navigator.serviceWorker.removeEventListener('message', handleMessage)
      }
    }
  }, [isSupported])

  const sendMessage = (message: object) => {
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage(message)
    }
  }

  const startBackgroundTimer = (startTime: string) => {
    sendMessage({ type: 'TIMER_START', startTime })
    sendMessage({ type: 'KEEP_ALIVE_START' })
  }

  const stopBackgroundTimer = () => {
    sendMessage({ type: 'TIMER_STOP' })
    sendMessage({ type: 'KEEP_ALIVE_STOP' })
  }

  return {
    isSupported,
    registration,
    sendMessage,
    startBackgroundTimer,
    stopBackgroundTimer
  }
}
