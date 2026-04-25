'use client'

import { useState } from 'react'
import { Search, X } from 'lucide-react'
import { EntryList } from './EntryList'

interface Entry {
  id: string
  startTime: string
  endTime: string | null
  duration: number | null
  date: string
  jobNumber?: string | null
  vehicle?: string | null
  observation?: string | null
  calculatedAmount?: number | null
  paidAmount?: number | null
}

interface JobSearchProps {
  readonly hourlyRate?: number
}

export function JobSearch({ hourlyRate = 25 }: Readonly<JobSearchProps>) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Entry[] | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const handleSearch = async () => {
    const trimmed = query.trim()
    if (!trimmed) return

    setIsLoading(true)
    setSearched(true)
    try {
      const res = await fetch(`/api/entries?jobNumber=${encodeURIComponent(trimmed)}`)
      const data = await res.json()
      if (data.success) {
        setResults(data.data as Entry[])
      } else {
        setResults([])
      }
    } catch {
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSearch()
  }

  const handleClear = () => {
    setQuery('')
    setResults(null)
    setSearched(false)
  }

  const handleUpdate = async () => {
    if (query.trim()) await handleSearch()
  }

  return (
    <div className="space-y-4">
      {/* Barra de búsqueda */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              inputMode="numeric"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Número de trabajo..."
              className="w-full pl-9 pr-9 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
              style={{ fontSize: '16px' }}
            />
            {query && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={handleSearch}
            disabled={!query.trim() || isLoading}
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 text-white text-sm font-semibold rounded-xl hover:from-emerald-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            {isLoading ? (
              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              'Buscar'
            )}
          </button>
        </div>
      </div>

      {/* Resultados */}
      {searched && !isLoading && results !== null && (
        results.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
            <div className="text-4xl mb-3">🔍</div>
            <p className="text-gray-500 text-sm font-medium">
              No se encontró ningún trabajo con el número <span className="font-mono font-bold text-gray-700">#{query}</span>
            </p>
          </div>
        ) : (
          <EntryList
            entries={results}
            title={`Trabajo #${query}`}
            showDate
            hourlyRate={hourlyRate}
            onUpdate={handleUpdate}
            onDelete={handleUpdate}
          />
        )
      )}
    </div>
  )
}
