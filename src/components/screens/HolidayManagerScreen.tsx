'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  ChevronLeft, Plus, Trash2, Loader2, PartyPopper, RefreshCw,
  CalendarDays, Sparkles
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { MONTH_NAMES } from './shared'

// ─── Types ────────────────────────────────────────────────────────
interface Holiday {
  id: string
  date: string
  name: string
  recurring: boolean
}

// ─── Common Indian Holidays as suggestions ────────────────────────
const INDIAN_HOLIDAY_SUGGESTIONS = [
  { date: '01-26', name: 'Republic Day', recurring: true },
  { date: '08-15', name: 'Independence Day', recurring: true },
  { date: '10-02', name: 'Gandhi Jayanti', recurring: true },
  { date: '01-01', name: 'New Year\'s Day', recurring: true },
  { date: '12-25', name: 'Christmas', recurring: true },
  { date: '05-01', name: 'May Day / Labour Day', recurring: true },
  { date: '11-01', name: 'Karnataka Rajyotsava', recurring: true },
  { date: '04-14', name: 'Ambedkar Jayanti', recurring: true },
  { date: '09-05', name: 'Teachers\' Day', recurring: true },
  { date: '03-08', name: 'International Women\'s Day', recurring: true },
]

export function HolidayManagerScreen() {
  const { setCurrentScreen, showToast } = useAppStore()

  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Form state
  const [newDate, setNewDate] = useState('')
  const [newName, setNewName] = useState('')
  const [newRecurring, setNewRecurring] = useState(false)

  // Current year for suggestions
  const currentYear = useMemo(() => new Date().getFullYear(), [])
  const [suggestionYear, setSuggestionYear] = useState(currentYear)

  // Filter year for display
  const [filterYear, setFilterYear] = useState(currentYear)

  // Track if we've done initial load to avoid calling fetchHolidays via useEffect
  const hasFetchedRef = useRef(false)

  // Fetch holidays - called programmatically, not from useEffect
  const fetchHolidays = async (year?: number) => {
    setLoading(true)
    try {
      const y = year ?? filterYear
      const res = await fetch(`/api/holidays?year=${y}`)
      if (res.ok) {
        const data = await res.json()
        setHolidays(data.holidays || [])
      }
    } catch {
      showToast('Failed to load holidays', 'error')
    }
    setLoading(false)
  }

  // Initial load and when filterYear changes
  useEffect(() => {
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true
    }
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/holidays?year=${filterYear}`)
        if (res.ok && !cancelled) {
          const data = await res.json()
          setHolidays(data.holidays || [])
        }
      } catch {
        // silent
      }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [filterYear])

  // Group holidays by month
  const holidaysByMonth = useMemo(() => {
    const grouped: Record<number, Holiday[]> = {}
    for (const h of holidays) {
      const month = parseInt(h.date.split('-')[1], 10)
      if (!grouped[month]) grouped[month] = []
      grouped[month].push(h)
    }
    // Sort within each month by date
    for (const key of Object.keys(grouped)) {
      grouped[Number(key)].sort((a, b) => a.date.localeCompare(b.date))
    }
    return grouped
  }, [holidays])

  // Add a holiday
  const handleAddHoliday = async () => {
    if (!newDate || !newName.trim()) {
      showToast('Please fill in date and name', 'error')
      return
    }

    setAdding(true)
    try {
      const res = await fetch('/api/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: newDate, name: newName.trim(), recurring: newRecurring }),
      })
      if (res.ok) {
        showToast('Holiday added!', 'success')
        setNewDate('')
        setNewName('')
        setNewRecurring(false)
        await fetchHolidays()
      } else {
        const data = await res.json()
        showToast(data.error || 'Failed to add holiday', 'error')
      }
    } catch {
      showToast('Network error', 'error')
    }
    setAdding(false)
  }

  // Add a suggested holiday
  const handleAddSuggestion = async (suggestion: { date: string; name: string; recurring: boolean }) => {
    const fullDate = `${suggestionYear}-${suggestion.date}`
    // Check if already exists
    if (holidays.some(h => h.date === fullDate)) {
      showToast(`${suggestion.name} already exists for ${suggestionYear}`, 'info')
      return
    }

    setAdding(true)
    try {
      const res = await fetch('/api/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: fullDate, name: suggestion.name, recurring: suggestion.recurring }),
      })
      if (res.ok) {
        showToast(`${suggestion.name} added!`, 'success')
        await fetchHolidays()
      } else {
        const data = await res.json()
        showToast(data.error || 'Failed to add holiday', 'error')
      }
    } catch {
      showToast('Network error', 'error')
    }
    setAdding(false)
  }

  // Delete a holiday
  const handleDeleteHoliday = async (date: string, name: string) => {
    setDeleting(date)
    try {
      const res = await fetch(`/api/holidays/${date}`, { method: 'DELETE' })
      if (res.ok) {
        showToast(`"${name}" removed`, 'info')
        await fetchHolidays()
      } else {
        showToast('Failed to delete holiday', 'error')
      }
    } catch {
      showToast('Network error', 'error')
    }
    setDeleting(null)
  }

  // Filtered suggestions (exclude already added)
  const filteredSuggestions = useMemo(() => {
    return INDIAN_HOLIDAY_SUGGESTIONS.filter(s => {
      const fullDate = `${suggestionYear}-${s.date}`
      return !holidays.some(h => h.date === fullDate)
    })
  }, [holidays, suggestionYear])

  // Year navigation
  const prevYear = () => setFilterYear(y => y - 1)
  const nextYear = () => setFilterYear(y => y + 1)

  return (
    <div className="screen-container screen-container-medium">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5 animate-card-in">
        <button
          onClick={() => setCurrentScreen('settings')}
          className="btn-press w-9 h-9 rounded-xl bg-card signature-shadow flex items-center justify-center"
        >
          <ChevronLeft className="w-4 h-4 text-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground">Holidays</h1>
          <p className="text-xs text-muted-foreground">Manage public holidays</p>
        </div>
        <PartyPopper className="w-5 h-5 text-amber-500" />
      </div>

      {/* Add Holiday Form */}
      <div className="glass-card rounded-2xl p-5 mb-5 animate-card-in delay-100">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-primary" /> Add Holiday
        </h3>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Date</Label>
            <Input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="rounded-xl h-10 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Holiday Name</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g., Republic Day"
              className="rounded-xl h-10 text-sm"
            />
          </div>
          <div className="flex flex-col gap-3 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Recurring</p>
              <p className="text-[10px] text-muted-foreground">Repeats every year on this date</p>
            </div>
            <Switch checked={newRecurring} onCheckedChange={setNewRecurring} />
          </div>
          <Button
            onClick={handleAddHoliday}
            disabled={adding || !newDate || !newName.trim()}
            className="w-full bg-primary hover:bg-primary/90 text-white rounded-xl h-10 text-sm font-semibold btn-press"
          >
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            {adding ? 'Adding...' : 'Add Holiday'}
          </Button>
        </div>
      </div>

      {/* Quick Add Suggestions */}
      <div className="glass-card rounded-2xl p-5 mb-5 animate-card-in delay-200">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" /> Quick Add
          </h3>
          <div className="flex items-center gap-1">
            <button onClick={() => setSuggestionYear(y => y - 1)} className="btn-press w-6 h-6 rounded-md bg-muted flex items-center justify-center">
              <ChevronLeft className="w-3 h-3 text-foreground" />
            </button>
            <span className="text-xs font-medium text-foreground w-10 text-center">{suggestionYear}</span>
            <button onClick={() => setSuggestionYear(y => y + 1)} className="btn-press w-6 h-6 rounded-md bg-muted flex items-center justify-center">
              <ChevronLeft className="w-3 h-3 text-foreground rotate-180" />
            </button>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mb-3">Common Indian holidays — tap to add</p>
        <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
          {filteredSuggestions.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">All suggestions added for {suggestionYear}!</p>
          ) : (
            filteredSuggestions.map((s) => (
              <button
                key={s.date}
                onClick={() => handleAddSuggestion(s)}
                disabled={adding}
                className="w-full flex items-center justify-between p-2.5 rounded-xl border border-border hover:border-primary/40 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all btn-press text-left"
              >
                <div className="flex items-center gap-2.5">
                  <PartyPopper className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-foreground">{s.name}</p>
                    <p className="text-[10px] text-muted-foreground">{s.date}</p>
                  </div>
                </div>
                <Plus className="w-3.5 h-3.5 text-primary" />
              </button>
            ))
          )}
        </div>
      </div>

      {/* Holiday List by Year */}
      <div className="glass-card rounded-2xl p-5 mb-5 animate-card-in delay-300">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-primary" /> Holidays
          </h3>
          <div className="flex items-center gap-1.5">
            <button onClick={prevYear} className="btn-press w-7 h-7 rounded-lg bg-muted flex items-center justify-center">
              <ChevronLeft className="w-3.5 h-3.5 text-foreground" />
            </button>
            <span className="text-sm font-semibold text-foreground min-w-[3rem] text-center">{filterYear}</span>
            <button onClick={nextYear} className="btn-press w-7 h-7 rounded-lg bg-muted flex items-center justify-center">
              <ChevronLeft className="w-3.5 h-3.5 text-foreground rotate-180" />
            </button>
            <button onClick={() => fetchHolidays()} className="btn-press w-7 h-7 rounded-lg bg-muted flex items-center justify-center ml-1">
              <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          </div>
        ) : holidays.length === 0 ? (
          <div className="text-center py-8">
            <PartyPopper className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No holidays for {filterYear}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Add one above or use Quick Add</p>
          </div>
        ) : (
          <div className="space-y-4 max-h-96 overflow-y-auto custom-scrollbar">
            {MONTH_NAMES.map((monthName, idx) => {
              const month = idx + 1
              const monthHolidays = holidaysByMonth[month]
              if (!monthHolidays || monthHolidays.length === 0) return null

              return (
                <div key={month}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{monthName}</p>
                  <div className="space-y-1.5">
                    {monthHolidays.map((h) => {
                      const day = parseInt(h.date.split('-')[2], 10)
                      const dayOfWeek = new Date(h.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })

                      return (
                        <div
                          key={h.id}
                          className="flex flex-col gap-3 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between p-3 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50/40 dark:bg-amber-900/10"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-800/30 flex items-center justify-center flex-shrink-0">
                              <PartyPopper className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground">{h.name}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {day} {monthName.slice(0, 3)} &middot; {dayOfWeek}
                                {h.recurring && <span className="ml-1.5 text-amber-600 dark:text-amber-400 font-medium">🔄 Yearly</span>}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteHoliday(h.date, h.name)}
                            disabled={deleting === h.date}
                            className="btn-press w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          >
                            {deleting === h.date ? (
                              <Loader2 className="w-3.5 h-3.5 text-red-500 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5 text-red-400 hover:text-red-600" />
                            )}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {holidays.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] text-muted-foreground">{holidays.length} holiday{holidays.length !== 1 ? 's' : ''} in {filterYear}</p>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <PartyPopper className="w-3 h-3" /> Auto-marked as OFF
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
