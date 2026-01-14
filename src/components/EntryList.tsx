'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDuration, formatCurrency, HOURLY_RATE } from '@/lib/utils'
import { Clock, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Entry {
  id: string
  startTime: string
  endTime: string | null
  duration: number | null
  date: string
}

interface EntryListProps {
  entries: Entry[]
  title?: string
  onDelete?: (id: string) => void
  showDate?: boolean
}

export function EntryList({ entries, title = "Entradas de Hoy", onDelete, showDate = false }: EntryListProps) {
  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta entrada?')) return
    
    try {
      const res = await fetch(`/api/entries?id=${id}`, {
        method: 'DELETE'
      })
      const data = await res.json()
      
      if (data.success && onDelete) {
        onDelete(id)
      }
    } catch (error) {
      console.error('Error deleting entry:', error)
    }
  }

  if (entries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-8">
            No hay entradas registradas
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex-1">
                {showDate && (
                  <div className="text-xs text-gray-500 mb-1">
                    {new Date(entry.date).toLocaleDateString('es-ES', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short'
                    })}
                  </div>
                )}
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600">
                    {new Date(entry.startTime).toLocaleTimeString('es-ES', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                    {' - '}
                    {entry.endTime
                      ? new Date(entry.endTime).toLocaleTimeString('es-ES', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : 'En progreso...'}
                  </span>
                </div>
              </div>
              <div className="text-right">
                {entry.duration !== null ? (
                  <>
                    <div className="font-mono font-semibold">
                      {formatDuration(entry.duration)}
                    </div>
                    <div className="text-sm text-green-600">
                      {formatCurrency((entry.duration / 3600) * HOURLY_RATE)}
                    </div>
                  </>
                ) : (
                  <div className="text-yellow-600 font-semibold animate-pulse">
                    En curso...
                  </div>
                )}
              </div>
              {entry.endTime && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(entry.id)}
                  className="ml-2 text-gray-400 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
