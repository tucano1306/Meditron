'use client'

import { useEffect, useState } from 'react'

export function useServiceWorker() {
  const [isSupported, setIsSupported] = useState(false)
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      setIsSupported(true)
      
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => {
          setRegistration(reg)
          console.log('Service Worker registered')
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error)
        })

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'TIMER_SYNC') {
          // Handle timer sync from background
          globalThis.dispatchEvent(new CustomEvent('timer-sync', { detail: event.data.data }))
        }
        if (event.data?.type === 'KEEP_ALIVE_PING') {
          // Respond to keep alive
          console.log('Keep alive ping received')
        }
      })
    }
  }, [])

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
