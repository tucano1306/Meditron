'use client'

import { useEffect, useState, useCallback } from 'react'

export function useWakeLock() {
  const [isSupported, setIsSupported] = useState(false)
  const [isActive, setIsActive] = useState(false)
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null)

  useEffect(() => {
    setIsSupported('wakeLock' in navigator)
  }, [])

  const requestWakeLock = useCallback(async () => {
    if (!isSupported) return false

    try {
      const lock = await navigator.wakeLock.request('screen')
      setWakeLock(lock)
      setIsActive(true)

      lock.addEventListener('release', () => {
        setIsActive(false)
        setWakeLock(null)
      })

      return true
    } catch (err) {
      console.error('Wake Lock error:', err)
      return false
    }
  }, [isSupported])

  const releaseWakeLock = useCallback(async () => {
    if (wakeLock) {
      await wakeLock.release()
      setWakeLock(null)
      setIsActive(false)
    }
  }, [wakeLock])

  // Re-acquire wake lock when page becomes visible again
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && isActive && !wakeLock) {
        await requestWakeLock()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isActive, wakeLock, requestWakeLock])

  return {
    isSupported,
    isActive,
    requestWakeLock,
    releaseWakeLock
  }
}
