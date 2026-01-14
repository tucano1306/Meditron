export interface TimeEntry {
  id: string
  startTime: string
  endTime: string | null
  duration: number | null
  date: string
  weekId: string
  createdAt: string
  updatedAt: string
}

export interface Week {
  id: string
  weekNumber: number
  startDate: string
  endDate: string
  year: number
  month: number
  totalHours: number
  earnings: number
  entries?: TimeEntry[]
  createdAt: string
  updatedAt: string
}

export interface MonthSummary {
  id: string
  year: number
  month: number
  totalHours: number
  earnings: number
  createdAt: string
  updatedAt: string
}

export interface TimerState {
  isRunning: boolean
  startTime: string | null
  currentEntryId: string | null
  elapsedSeconds: number
}

export interface DailySummary {
  date: string
  entries: TimeEntry[]
  totalSeconds: number
  totalHours: number
  earnings: number
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}
