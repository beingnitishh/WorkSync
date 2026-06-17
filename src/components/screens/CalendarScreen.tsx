'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Sun, Loader2, CalendarDays } from 'lucide-react'
import { useAppStore, type AttendanceStatus } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { DAY_NAMES, MONTH_NAMES, statusConfig, isDateSunday } from './shared'

/** Get ISO week number for a date */
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

/** Payable value for each status — only ABSENT deducts salary */
const payableValues: Record<AttendanceStatus, number> = {
  FULL_DAY: 1.0,
  HALF_DAY: 1.0, // Half day is paid as full day
  ABSENT: 0,      // Only absent deducts salary
  OFF: 1.0,       // Off days are paid
}

interface HolidayInfo {
  id: string
  date: string
  name: string
  recurring: boolean
}

export function CalendarScreen() {
  const {
    employee, selectedMonth, selectedYear, setSelectedMonth, setSelectedYear,
    attendanceRecords, setEditDate,
    dataLoading, fetchMonthData,
  } = useAppStore()

  const [holidays, setHolidays] = useState<HolidayInfo[]>([])

  useEffect(() => {
    if (employee) {
      fetchMonthData()
    }
  }, [employee, selectedMonth, selectedYear, fetchMonthData])

  useEffect(() => {
    let cancelled = false
    const loadHolidays = async () => {
      try {
        const res = await fetch(`/api/holidays?year=${selectedYear}`)
        if (res.ok && !cancelled) {
          const data = await res.json()
          setHolidays(data.holidays || [])
        }
      } catch {
        // silent
      }
    }
    loadHolidays()
    return () => { cancelled = true }
  }, [selectedYear])

  const today = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [])

  // Holiday date lookup
  const holidayMap = useMemo(() => {
    const map = new Map<string, HolidayInfo>()
    for (const h of holidays) {
      map.set(h.date, h)
    }
    return map
  }, [holidays])

  const calendarDays = useMemo(() => {
    const firstDay = new Date(selectedYear, selectedMonth - 1, 1).getDay()
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate()
    const days: Array<{ day: number; dateStr: string; isCurrentMonth: boolean; status?: AttendanceStatus; dayOfWeek: number; isHoliday?: boolean; holidayName?: string }> = []

    const prevMonthDays = new Date(selectedYear, selectedMonth - 1, 0).getDate()
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({ day: prevMonthDays - i, dateStr: '', isCurrentMonth: false, dayOfWeek: days.length % 7 })
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const record = attendanceRecords.find(r => r.date === dateStr)
      const dayOfWeek = (firstDay + d - 1) % 7
      const holiday = holidayMap.get(dateStr)
      days.push({ day: d, dateStr, isCurrentMonth: true, status: record?.status as AttendanceStatus | undefined, dayOfWeek, isHoliday: !!holiday, holidayName: holiday?.name })
    }

    const remaining = 42 - days.length
    for (let i = 1; i <= remaining; i++) {
      days.push({ day: i, dateStr: '', isCurrentMonth: false, dayOfWeek: days.length % 7 })
    }

    return days
  }, [selectedMonth, selectedYear, attendanceRecords, holidayMap])

  // Compute week numbers for each row
  const weekNumbers = useMemo(() => {
    const weeks: number[] = []
    for (let row = 0; row < 6; row++) {
      const midIdx = row * 7 + 3 // Use Thursday of each week for week number
      const cell = calendarDays[midIdx]
      if (cell && cell.dateStr) {
        const d = new Date(cell.dateStr + 'T00:00:00')
        weeks.push(getWeekNumber(d))
      } else {
        // Fallback: use a date from the row
        const anyCell = calendarDays[row * 7]
        if (anyCell?.dateStr) {
          const d = new Date(anyCell.dateStr + 'T00:00:00')
          weeks.push(getWeekNumber(d))
        } else {
          weeks.push(row + 1)
        }
      }
    }
    return weeks
  }, [calendarDays])

  // Month summary calculations
  const monthSummary = useMemo(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate()
    let workingDays = 0
    let attendedDays = 0
    let totalPayable = 0

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const record = attendanceRecords.find(r => r.date === dateStr)
      const isSunday = isDateSunday(dateStr)

      if (!isSunday) workingDays++
      if (record) {
        const pv = payableValues[record.status as AttendanceStatus] ?? 0
        totalPayable += pv
        if (pv > 0) attendedDays += pv
      }
    }

    return { workingDays, attendedDays, totalPayable, daysInMonth }
  }, [selectedMonth, selectedYear, attendanceRecords])

  const prevMonth = () => {
    if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear(selectedYear - 1) }
    else setSelectedMonth(selectedMonth - 1)
  }
  const nextMonth = () => {
    if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear(selectedYear + 1) }
    else setSelectedMonth(selectedMonth + 1)
  }
  const goToToday = () => {
    const d = new Date()
    setSelectedMonth(d.getMonth() + 1)
    setSelectedYear(d.getFullYear())
  }

  const isCurrentMonthToday = useMemo(() => {
    const d = new Date()
    return selectedMonth === d.getMonth() + 1 && selectedYear === d.getFullYear()
  }, [selectedMonth, selectedYear])

  const progressPercent = monthSummary.workingDays > 0
    ? Math.min(100, Math.round((monthSummary.totalPayable / monthSummary.workingDays) * 100))
    : 0

  return (
    <div className="screen-container screen-container-medium">
      {/* Navigation */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <button onClick={prevMonth} className="btn-press w-9 h-9 rounded-xl bg-card signature-shadow flex items-center justify-center">
          <ChevronLeft className="w-4 h-4 text-foreground" />
        </button>
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground">{MONTH_NAMES[selectedMonth - 1]} {selectedYear}</h2>
          {!isCurrentMonthToday && (
            <button
              onClick={goToToday}
              className="btn-press px-2.5 py-1 rounded-lg bg-primary text-white text-[10px] font-semibold flex items-center gap-1"
            >
              <CalendarDays className="w-3 h-3" />
              Today
            </button>
          )}
        </div>
        <button onClick={nextMonth} className="btn-press w-9 h-9 rounded-xl bg-card signature-shadow flex items-center justify-center">
          <ChevronRight className="w-4 h-4 text-foreground" />
        </button>
      </div>

      {dataLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
      ) : (
        <>
          {/* Month Summary Bar */}
          <div className="animate-card-in glass-card rounded-2xl p-4 mb-4 signature-shadow">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-2.5">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex flex-col">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Working</span>
                  <span className="text-base font-bold text-foreground">{monthSummary.workingDays}</span>
                </div>
                <div className="w-px h-8 bg-border" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Attended</span>
                  <span className="text-base font-bold text-[#10b981]">{monthSummary.totalPayable}</span>
                </div>
                <div className="w-px h-8 bg-border" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Days</span>
                  <span className="text-base font-bold text-muted-foreground">{monthSummary.daysInMonth}</span>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-medium text-muted-foreground">{progressPercent}%</span>
                <div className="w-16 h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                  <div
                    className="h-full rounded-full animate-progress"
                    style={{
                      width: `${progressPercent}%`,
                      backgroundColor: progressPercent >= 80 ? '#10b981' : progressPercent >= 50 ? '#f59e0b' : '#ef4444',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Calendar Card */}
          <div className="animate-card-in delay-100 bg-card rounded-2xl p-3 sm:p-4 signature-shadow overflow-hidden">
            <div className="flex">
              {/* Week Number Column */}
              <div className="flex flex-col pr-1.5 mr-1 border-r border-border/60">
                <div className="h-6 mb-2" /> {/* Spacer for day headers */}
                {weekNumbers.map((wn, i) => (
                  <div key={i} className="flex-1 flex items-center justify-center">
                    <span className="text-[9px] font-medium text-muted-foreground/50">{wn}</span>
                  </div>
                ))}
              </div>

              <div className="flex-1">
                {/* Day Headers */}
                <div className="grid grid-cols-7 mb-2">
                  {DAY_NAMES.map((d, i) => (
                    <div key={d} className={`text-center text-xs font-medium py-1 ${i === 0 ? 'text-primary' : 'text-muted-foreground'}`}>{d}</div>
                  ))}
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((cell, idx) => {
                    const isSunday = cell.dateStr ? isDateSunday(cell.dateStr) : (idx % 7 === 0)
                    const isToday = cell.dateStr === today
                    const cfg = cell.status ? statusConfig[cell.status] : null
                    const isHoliday = cell.isHoliday && cell.isCurrentMonth

                    return (
                      <button
                        key={idx}
                        onClick={() => { if (cell.dateStr) setEditDate(cell.dateStr) }}
                        disabled={!cell.isCurrentMonth}
                        title={cell.holidayName || undefined}
                        className={[
                          'cal-cell btn-press',
                          !cell.isCurrentMonth ? 'text-muted-foreground/30 cursor-default' : '',
                          isToday ? 'today' : '',
                          isSunday && cell.isCurrentMonth && !isHoliday ? 'bg-[#dbeafe] dark:bg-blue-900/20' : '',
                          isHoliday ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50' : '',
                        ].filter(Boolean).join(' ')}
                      >
                        <span className={`text-sm leading-none ${cell.isCurrentMonth ? 'text-foreground' : ''} ${isToday ? 'font-bold' : ''} ${isHoliday ? 'text-amber-700 dark:text-amber-300' : ''}`}>
                          {cell.day}
                        </span>
                        {isHoliday && (
                          <span className="text-[8px] leading-none mt-0.5" role="img" aria-label="Holiday">🎉</span>
                        )}
                        {!isHoliday && cfg && cell.isCurrentMonth && (
                          isToday ? (
                            <div className="status-dot-today" style={{ backgroundColor: cfg.color }} />
                          ) : (
                            <div className="status-dot" style={{ backgroundColor: cfg.color }} />
                          )
                        )}
                        {!isHoliday && isSunday && cell.isCurrentMonth && !cfg && (
                          <span className="text-[8px] font-semibold text-primary leading-none mt-0.5">S</span>
                        )}
                        {isToday && !isHoliday && (
                          <span className="text-[7px] font-semibold text-primary leading-none mt-0.5">Today</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Legend with pill badges */}
          <div className="animate-card-in delay-200 flex flex-wrap items-center justify-center gap-2 mt-4">
            {(Object.entries(statusConfig) as [AttendanceStatus, typeof statusConfig[AttendanceStatus]][]).map(([s, c]) => (
              <div
                key={s}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                style={{ backgroundColor: c.bg }}
              >
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                <span className="text-[10px] font-medium" style={{ color: c.textColor }}>{c.label}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#dbeafe] dark:bg-blue-900/30">
              <div className="w-2 h-2 rounded-full bg-[#93c5fd]" />
              <span className="text-[10px] font-medium text-[#1e40af] dark:text-blue-300">Sunday</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-900/30">
              <span className="text-[10px]" role="img" aria-label="Holiday">🎉</span>
              <span className="text-[10px] font-medium text-amber-700 dark:text-amber-300">Holiday</span>
            </div>
          </div>

          {/* Sunday Tracker Button */}
          <div className="animate-card-in delay-300 mt-4">
            <Button onClick={() => useAppStore.getState().setCurrentScreen('sunday-tracker')} variant="outline" className="btn-press w-full rounded-[14px] border-border text-foreground h-11 text-xs font-medium">
              <Sun className="w-4 h-4 mr-2" /> Sunday Tracker
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
