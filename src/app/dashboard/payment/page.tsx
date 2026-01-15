'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { PaymentTimer } from '@/components/PaymentTimer'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  DollarSign, 
  Clock, 
  TrendingUp, 
  ArrowLeft, 
  LogOut, 
  User,
  Calendar,
  Briefcase,
  Trash2,
  Pencil,
  X,
  Check,
  ChevronDown,
  ChevronRight,
  Eye
} from 'lucide-react'
import { formatDuration, formatCurrency } from '@/lib/utils'

interface PaymentEntry {
  id: string
  startTime: string
  endTime: string | null
  duration: number | null
  amount: number | null
  hourlyRate: number | null
  date: string
  completed: boolean
}

interface DashboardData {
  timerState: {
    isRunning: boolean
    startTime: string | null
    currentEntryId: string | null
    elapsedSeconds: number
  }
  today: {
    date: string
    entries: PaymentEntry[]
    totalSeconds: number
    totalHours: number
    totalAmount: number
    avgHourlyRate: number
    jobCount: number
  }
  month: {
    year: number
    month: number
    totalSeconds: number
    totalHours: number
    totalAmount: number
    avgHourlyRate: number
    jobCount: number
  }
  recentEntries: PaymentEntry[]
}

export default function PaymentDashboardPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [data, setData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editStartTime, setEditStartTime] = useState('')
  const [editEndTime, setEditEndTime] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isEntriesExpanded, setIsEntriesExpanded] = useState(false)

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/payment/dashboard')
      const result = await res.json()
      
      if (result.success) {
        setData(result.data)
      }
    } catch (err) {
      console.error('Error fetching dashboard:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated') {
      fetchDashboard()
    }
  }, [status, router, fetchDashboard])

  const handleComplete = () => {
    fetchDashboard()
  }

  const handleLogout = async () => {
    await signOut({ redirect: false })
    router.push('/login')
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este trabajo?')) return
    
    try {
      const res = await fetch(`/api/payment?id=${id}`, {
        method: 'DELETE'
      })
      const result = await res.json()
      
      if (result.success) {
        fetchDashboard()
      }
    } catch (error) {
      console.error('Error deleting entry:', error)
    }
  }

  const startEditing = (entry: PaymentEntry) => {
    const start = new Date(entry.startTime)
    const end = entry.endTime ? new Date(entry.endTime) : null
    
    setEditStartTime(start.toTimeString().slice(0, 5))
    setEditEndTime(end ? end.toTimeString().slice(0, 5) : '')
    setEditAmount(entry.amount?.toString() || '')
    setEditingId(entry.id)
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditStartTime('')
    setEditEndTime('')
    setEditAmount('')
  }

  const handleSaveEdit = async (entry: PaymentEntry) => {
    if (!editStartTime || !editEndTime || !editAmount) return
    
    setIsSaving(true)
    try {
      const entryDate = new Date(entry.date)
      const [startH, startM] = editStartTime.split(':').map(Number)
      const [endH, endM] = editEndTime.split(':').map(Number)
      
      const newStart = new Date(entryDate)
      newStart.setHours(startH, startM, 0, 0)
      
      const newEnd = new Date(entryDate)
      newEnd.setHours(endH, endM, 0, 0)
      
      // Si el fin es antes que el inicio, asumir día siguiente
      if (newEnd <= newStart) {
        newEnd.setDate(newEnd.getDate() + 1)
      }
      
      const res = await fetch(`/api/payment?id=${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startTime: newStart.toISOString(),
          endTime: newEnd.toISOString(),
          amount: Number(editAmount)
        })
      })
      
      const result = await res.json()
      
      if (result.success) {
        cancelEditing()
        fetchDashboard()
      } else {
        alert(result.error || 'Error al guardar')
      }
    } catch (error) {
      console.error('Error updating entry:', error)
      alert('Error al actualizar el trabajo')
    } finally {
      setIsSaving(false)
    }
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/mode-select')}
              className="text-gray-500"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">Por Pago</h1>
                <p className="text-xs text-gray-500">Calcula tu tarifa por hora</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1 text-gray-500 text-sm">
              <User className="w-4 h-4" />
              <span>{session?.user?.name || session?.user?.email?.split('@')[0]}</span>
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
        </header>

        {/* Timer */}
        <section className="mb-6">
          <PaymentTimer
            onComplete={handleComplete}
            initialState={data?.timerState}
          />
        </section>

        {/* Stats Cards */}
        {data && (
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="border-0 shadow-lg shadow-blue-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-blue-500 mb-1">
                  <Briefcase className="w-4 h-4" />
                  <span className="text-xs font-medium">Trabajos Hoy</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">{data.today.jobCount}</div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg shadow-green-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-green-500 mb-1">
                  <DollarSign className="w-4 h-4" />
                  <span className="text-xs font-medium">Ganado Hoy</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {formatCurrency(data.today.totalAmount)}
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg shadow-purple-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-purple-500 mb-1">
                  <Clock className="w-4 h-4" />
                  <span className="text-xs font-medium">Horas Hoy</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {data.today.totalHours.toFixed(1)}h
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg shadow-orange-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-orange-500 mb-1">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-xs font-medium">$/Hora Prom.</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {formatCurrency(data.today.avgHourlyRate)}
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Month Summary */}
        {data && (
          <section className="mb-6">
            <Card className="border-0 shadow-xl shadow-blue-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-500" />
                  Resumen del Mes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-gray-50 rounded-xl">
                    <div className="text-sm text-gray-500">Trabajos</div>
                    <div className="text-xl font-bold text-gray-900">{data.month.jobCount}</div>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-xl">
                    <div className="text-sm text-gray-500">Total</div>
                    <div className="text-xl font-bold text-green-600">
                      {formatCurrency(data.month.totalAmount)}
                    </div>
                  </div>
                  <div className="text-center p-3 bg-blue-50 rounded-xl">
                    <div className="text-sm text-gray-500">Horas</div>
                    <div className="text-xl font-bold text-blue-600">
                      {data.month.totalHours.toFixed(1)}h
                    </div>
                  </div>
                  <div className="text-center p-3 bg-purple-50 rounded-xl">
                    <div className="text-sm text-gray-500">$/Hora</div>
                    <div className="text-xl font-bold text-purple-600">
                      {formatCurrency(data.month.avgHourlyRate)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Recent Entries */}
        {data && data.today.entries.length > 0 && (
          <section>
            <Card className="border-0 shadow-xl shadow-gray-100">
              <CardHeader 
                className="pb-2 cursor-pointer sm:cursor-default select-none"
                onClick={() => setIsEntriesExpanded(!isEntriesExpanded)}
              >
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {/* Icono de expandir solo en móvil */}
                    <span className="sm:hidden">
                      {isEntriesExpanded ? (
                        <ChevronDown className="h-5 w-5 text-gray-500" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-gray-500" />
                      )}
                    </span>{' '}
                    Trabajos de Hoy{' '}
                    <span className="text-sm font-normal text-gray-500">
                      ({data.today.entries.length})
                    </span>
                  </CardTitle>
                  
                  {/* Botón Ver solo en laptop/desktop */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      setIsEntriesExpanded(!isEntriesExpanded)
                    }}
                    className="hidden sm:flex items-center gap-1"
                  >
                    <Eye className="h-4 w-4" />
                    {isEntriesExpanded ? 'Ocultar' : 'Ver'}
                  </Button>
                </div>
                
                {/* Resumen cuando está colapsado */}
                {!isEntriesExpanded && (
                  <div className="text-sm text-gray-500 mt-1">
                    {formatDuration(data.today.totalSeconds)} total • {formatCurrency(data.today.totalAmount)}
                  </div>
                )}
              </CardHeader>
              
              {isEntriesExpanded && (
              <CardContent>
                <div className="space-y-3">
                  {data.today.entries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg flex items-center justify-center">
                          <DollarSign className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          {editingId === entry.id ? (
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center gap-2">
                                <input
                                  type="time"
                                  value={editStartTime}
                                  onChange={(e) => setEditStartTime(e.target.value)}
                                  className="px-2 py-1 text-sm border rounded w-24"
                                />
                                <span className="text-gray-400">→</span>
                                <input
                                  type="time"
                                  value={editEndTime}
                                  onChange={(e) => setEditEndTime(e.target.value)}
                                  className="px-2 py-1 text-sm border rounded w-24"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-500">$</span>
                                <input
                                  type="number"
                                  value={editAmount}
                                  onChange={(e) => setEditAmount(e.target.value)}
                                  className="px-2 py-1 text-sm border rounded w-24"
                                  step="0.01"
                                  min="0"
                                />
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="font-medium text-gray-900">
                                {new Date(entry.startTime).toLocaleTimeString('es-ES', { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                })}
                                {entry.endTime && (
                                  <span className="text-gray-400">
                                    {' → '}
                                    {new Date(entry.endTime).toLocaleTimeString('es-ES', { 
                                      hour: '2-digit', 
                                      minute: '2-digit' 
                                    })}
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-gray-500">
                                {entry.duration && formatDuration(entry.duration)}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      {editingId !== entry.id && (
                        <div className="text-right mr-2">
                          <div className="font-bold text-green-600">
                            {entry.amount && formatCurrency(entry.amount)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {entry.hourlyRate && `${formatCurrency(entry.hourlyRate)}/h`}
                          </div>
                        </div>
                      )}
                      {entry.completed && (
                        <div className="flex items-center">
                          {editingId === entry.id ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleSaveEdit(entry)}
                                disabled={isSaving}
                                className="text-green-600 hover:text-green-700"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={cancelEditing}
                                disabled={isSaving}
                                className="text-gray-400 hover:text-gray-600"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => startEditing(entry)}
                                className="text-gray-400 hover:text-blue-600"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(entry.id)}
                                className="text-gray-400 hover:text-red-600"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
              )}
            </Card>
          </section>
        )}
      </div>
    </div>
  )
}
