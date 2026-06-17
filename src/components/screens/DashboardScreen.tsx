'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ChevronLeft, ChevronRight, CalendarDays, DollarSign,
  TrendingUp, Flame, Clock, Edit3, Target,
  Zap, TrendingDown, Award, Activity, Check, Timer, X
} from 'lucide-react'
import { useAppStore, type AttendanceStatus } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, MONTH_NAMES, statusConfig } from './shared'

// ─── Helper: format today's date nicely ────────────────────────────
function formatToday(): string {
  const now = new Date()
  return now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

// ─── Helper: get today's date string (YYYY-MM-DD) ─────────────────
function getTodayStr(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

// ─── Helper: get the current week dates (Mon-Sun) ─────────────────
function getWeekDates(): string[] {
  const now = new Date()
  const day = now.getDay() // 0=Sun, 1=Mon...
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((day + 6) % 7)) // shift to Monday
  const dates: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
  }
  return dates
}

// ─── Helper: day short labels for week row ─────────────────────────
const WEEK_DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const HEATMAP_DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// ─── Heatmap color map ──────────────────────────────────────────────
const HEATMAP_COLORS: Record<string, string> = {
  FULL_DAY: '#10b981',
  HALF_DAY: '#f59e0b',
  ABSENT: '#ef4444',
  OFF: '#94a3b8',
}
const HEATMAP_NO_DATA = '#e5e7eb' // very light gray

// ─── Build month grid for heatmap ───────────────────────────────────
function buildMonthGrid(year: number, month: number) {
  const firstDay = new Date(year, month - 1, 1)
  const daysInMonth = new Date(year, month, 0).getDate()
  // 0=Sun, 1=Mon... convert to Mon=0, Sun=6
  let startDow = firstDay.getDay() - 1
  if (startDow < 0) startDow = 6

  const cells: (number | null)[] = []
  // Leading empty cells
  for (let i = 0; i < startDow; i++) cells.push(null)
  // Day cells
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  // Trailing empty cells to complete last row
  const remainder = cells.length % 7
  if (remainder > 0) {
    for (let i = 0; i < 7 - remainder; i++) cells.push(null)
  }

  const rows: (number | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7))
  }
  return rows
}

// ─── Dashboard Skeleton Loader ──────────────────────────────────────
function DashboardSkeleton() {
  return (
    <div className="screen-container screen-container-wide">
      {/* Header skeleton */}
      <div className="mb-5">
        <div className="skeleton-shimmer h-6 w-40 rounded-lg mb-2" />
        <div className="skeleton-shimmer h-4 w-56 rounded-lg" />
      </div>
      {/* Today card skeleton */}
      <div className="skeleton-shimmer rounded-2xl h-32 mb-5" />
      {/* Month nav skeleton */}
      <div className="flex items-center justify-between mb-5">
        <div className="skeleton-shimmer h-9 w-9 rounded-xl" />
        <div className="skeleton-shimmer h-4 w-28 rounded-lg" />
        <div className="skeleton-shimmer h-9 w-9 rounded-xl" />
      </div>
      {/* Salary card skeleton */}
      <div className="skeleton-shimmer rounded-2xl h-36 mb-5" />
      {/* Streak + weekly row */}
      <div className="responsive-grid-2 mb-5">
        <div className="skeleton-shimmer rounded-2xl h-28" />
        <div className="skeleton-shimmer rounded-2xl h-28" />
      </div>
      {/* Status cards */}
      <div className="responsive-grid-4 mb-5">
        <div className="skeleton-shimmer rounded-2xl h-24" />
        <div className="skeleton-shimmer rounded-2xl h-24" />
        <div className="skeleton-shimmer rounded-2xl h-24" />
        <div className="skeleton-shimmer rounded-2xl h-24" />
      </div>
    </div>
  )
}

export function DashboardScreen() {
  const {
    employee, selectedMonth, selectedYear, setSelectedMonth, setSelectedYear,
    attendanceRecords, salaryData, setCurrentScreen, setActiveTab,
    dataLoading, fetchMonthData, setEditDate,
  } = useAppStore()

  useEffect(() => {
    if (employee) {
      fetchMonthData()
    }
  }, [employee, selectedMonth, selectedYear, fetchMonthData])

  // ─── Summary counts ──────────────────────────────────────────────
  const summary = useMemo(() => {
    const counts = { full: 0, half: 0, absent: 0, off: 0 }
    for (const r of attendanceRecords) {
      if (r.status === 'FULL_DAY') counts.full++
      else if (r.status === 'HALF_DAY') counts.half++
      else if (r.status === 'ABSENT') counts.absent++
      else if (r.status === 'OFF') counts.off++
    }
    return counts
  }, [attendanceRecords])

  const totalDays = attendanceRecords.length || 1

  // ─── Today's status ──────────────────────────────────────────────
  const todayStr = getTodayStr()
  const todayRecord = useMemo(
    () => attendanceRecords.find(r => r.date === todayStr),
    [attendanceRecords, todayStr]
  )
  const todayStatus: AttendanceStatus | null = todayRecord?.status ?? null

  // ─── Attendance streak (consecutive FULL_DAY ending at today) ────
  const streak = useMemo(() => {
    if (attendanceRecords.length === 0) return 0
    // Sort records by date descending
    const sorted = [...attendanceRecords].sort((a, b) => b.date.localeCompare(a.date))
    // Walk backwards from the most recent date
    let count = 0
    for (const r of sorted) {
      if (r.status === 'FULL_DAY') count++
      else break
    }
    return count
  }, [attendanceRecords])

  // ─── Best streak this month (longest consecutive FULL_DAY) ─────
  const bestStreak = useMemo(() => {
    if (attendanceRecords.length === 0) return 0
    const sorted = [...attendanceRecords].sort((a, b) => a.date.localeCompare(b.date))
    let maxStreak = 0
    let currentStreak = 0
    for (const r of sorted) {
      if (r.status === 'FULL_DAY') {
        currentStreak++
        maxStreak = Math.max(maxStreak, currentStreak)
      } else {
        currentStreak = 0
      }
    }
    return maxStreak
  }, [attendanceRecords])

  // ─── Monthly Insights ───────────────────────────────────────────
  const monthlyInsights = useMemo(() => {
    const totalHours = summary.full * 8 + summary.half * 4
    const maxSalary = employee?.monthlySalary ?? 0
    const earnedSalary = salaryData?.totalSalary ?? 0
    const deductions = maxSalary - earnedSalary
    // Find best week (week with most FULL_DAYs)
    const sorted = [...attendanceRecords].sort((a, b) => a.date.localeCompare(b.date))
    let bestWeekStart = ''
    let bestWeekCount = 0
    for (let i = 0; i <= sorted.length - 5; i++) {
      const weekSlice = sorted.slice(i, i + 5)
      const fullCount = weekSlice.filter(r => r.status === 'FULL_DAY').length
      if (fullCount > bestWeekCount) {
        bestWeekCount = fullCount
        bestWeekStart = weekSlice[0].date
      }
    }
    return { totalHours, deductions, bestWeekStart, bestWeekCount }
  }, [summary, employee, salaryData, attendanceRecords])

  // ─── Month progress ──────────────────────────────────────────────
  const monthProgress = useMemo(() => {
    if (!salaryData) return 0
    const daysInMonth = salaryData.totalCalendarDays || 1
    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()
    // Only show progress for the current month
    if (selectedMonth === currentMonth && selectedYear === currentYear) {
      const daysPassed = now.getDate()
      return Math.min(Math.round((daysPassed / daysInMonth) * 100), 100)
    }
    // For past months, it's 100%; for future months, 0%
    const monthDate = new Date(selectedYear, selectedMonth - 1)
    return monthDate < now ? 100 : 0
  }, [salaryData, selectedMonth, selectedYear])

  // ─── Working days completed vs total ─────────────────────────────
  const workingDayProgress = useMemo(() => {
    if (!salaryData) return { completed: 0, total: 1, percent: 0 }
    const total = salaryData.workingPayableCapacity || 1
    const completed = salaryData.totalPayableDays || 0
    const percent = Math.min(Math.round((completed / total) * 100), 100)
    return { completed: completed, total, percent }
  }, [salaryData])

  // ─── Weekly summary ──────────────────────────────────────────────
  const weekDates = useMemo(() => getWeekDates(), [])
  const weekSummary = useMemo(() => {
    return weekDates.map(dateStr => {
      const rec = attendanceRecords.find(r => r.date === dateStr)
      const status: AttendanceStatus | null = rec?.status ?? null
      const isToday = dateStr === todayStr
      return { dateStr, status, isToday }
    })
  }, [weekDates, attendanceRecords, todayStr])

  // ─── Month navigation helpers ────────────────────────────────────
  const prevMonth = () => {
    if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear(selectedYear - 1) }
    else setSelectedMonth(selectedMonth - 1)
  }
  const nextMonth = () => {
    if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear(selectedYear + 1) }
    else setSelectedMonth(selectedMonth + 1)
  }
  const goToToday = () => {
    const now = new Date()
    setSelectedMonth(now.getMonth() + 1)
    setSelectedYear(now.getFullYear())
  }
  const isCurrentMonth = useMemo(() => {
    const now = new Date()
    return selectedMonth === now.getMonth() + 1 && selectedYear === now.getFullYear()
  }, [selectedMonth, selectedYear])

  // ─── Handle mark today ───────────────────────────────────────────
  const handleMarkToday = () => {
    setEditDate(todayStr)
  }

  // ─── Quick mark handler (direct API call) ────────────────────────
  const [quickMarking, setQuickMarking] = useState(false)
  const handleQuickMark = useCallback(async (status: AttendanceStatus) => {
    if (!employee || quickMarking) return
    setQuickMarking(true)
    try {
      const res = await fetch(`/api/attendance/${todayStr}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: employee.id,
          status,
          isManualOverride: true,
        }),
      })
      if (res.ok) {
        // Refresh month data to update everything
        await fetchMonthData(true)
      }
    } catch {
      // silent
    } finally {
      setQuickMarking(false)
    }
  }, [employee, todayStr, quickMarking, fetchMonthData])

  return (
    <div className="screen-container screen-container-wide">
      {/* ─── Header ─────────────────────────────────────────────── */}
      <div className="mb-5 animate-card-in">
        <h1 className="text-xl font-bold text-foreground">
          Hello, {employee?.name?.split(' ')[0] || 'User'} 👋
        </h1>
        <p className="text-muted-foreground text-sm">Here&apos;s your attendance overview</p>
      </div>

      {/* ─── Today's Quick Mark Card ────────────────────────────── */}
      <div className="animate-card-in delay-100 mb-5">
        <div className="gradient-primary rounded-2xl p-5 signature-shadow relative overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10" />
          <div className="absolute -bottom-4 -left-4 w-16 h-16 rounded-full bg-white/5" />

          <div className="relative z-10">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-white/80" />
                <span className="text-white/80 text-xs font-medium">{formatToday()}</span>
              </div>
              {todayStatus && (
                <Badge
                  className="bg-white/20 text-white border-white/20 text-xs backdrop-blur-sm"
                >
                  {statusConfig[todayStatus].label}
                </Badge>
              )}
            </div>

            {todayStatus ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-white text-lg font-semibold">
                    Today is marked as{' '}
                    <span className="font-bold">{statusConfig[todayStatus].label}</span>
                  </p>
                </div>
                <Button
                  onClick={handleMarkToday}
                  size="sm"
                  className="bg-white/20 hover:bg-white/30 text-white border-white/20 backdrop-blur-sm btn-press h-9 px-3 text-xs"
                >
                  <Edit3 className="w-3.5 h-3.5 mr-1.5" />
                  Change
                </Button>
              </div>
            ) : (
              <div>
                <div className="flex flex-col gap-3 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between mb-3">
                  <p className="text-white/90 text-sm">You haven&apos;t marked today yet</p>
                  <Button
                    onClick={handleMarkToday}
                    size="sm"
                    className="bg-white text-[#004ac6] hover:bg-white/90 btn-press h-9 px-4 text-xs font-semibold shadow-lg"
                  >
                    <Target className="w-3.5 h-3.5 mr-1.5" />
                    Mark Today
                  </Button>
                </div>
                {/* Quick Mark Shortcuts */}
                <div className="grid grid-cols-1 min-[360px]:grid-cols-3 gap-2">
                  <button
                    onClick={() => handleQuickMark('FULL_DAY')}
                    disabled={quickMarking}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-white text-xs font-medium transition-all btn-press disabled:opacity-50 backdrop-blur-sm border border-emerald-400/20"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Full Day
                  </button>
                  <button
                    onClick={() => handleQuickMark('HALF_DAY')}
                    disabled={quickMarking}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-white text-xs font-medium transition-all btn-press disabled:opacity-50 backdrop-blur-sm border border-amber-400/20"
                  >
                    <Timer className="w-3.5 h-3.5" />
                    Half Day
                  </button>
                  <button
                    onClick={() => handleQuickMark('ABSENT')}
                    disabled={quickMarking}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-white text-xs font-medium transition-all btn-press disabled:opacity-50 backdrop-blur-sm border border-red-400/20"
                  >
                    <X className="w-3.5 h-3.5" />
                    Absent
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Month Navigation ───────────────────────────────────── */}
      <div className="flex items-center justify-between mb-5 animate-card-in delay-200">
        <button
          onClick={prevMonth}
          className="w-9 h-9 rounded-xl bg-card signature-shadow flex items-center justify-center hover:shadow-md transition btn-press"
        >
          <ChevronLeft className="w-4 h-4 text-foreground" />
        </button>
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground">
            {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
          </h2>
          {!isCurrentMonth && (
            <Button
              onClick={goToToday}
              variant="secondary"
              size="sm"
              className="h-6 px-2 text-[10px] font-semibold rounded-full btn-press"
            >
              Today
            </Button>
          )}
        </div>
        <button
          onClick={nextMonth}
          className="w-9 h-9 rounded-xl bg-card signature-shadow flex items-center justify-center hover:shadow-md transition btn-press"
        >
          <ChevronRight className="w-4 h-4 text-foreground" />
        </button>
      </div>

      {dataLoading ? (
        <DashboardSkeleton />
      ) : (
        <>
          {/* ─── Salary Card with Progress ─────────────────────────── */}
          <div className="animate-card-in delay-300 mb-5">
            <div className="gradient-salary gradient-salary-overlay rounded-2xl p-5 signature-shadow relative overflow-hidden">
              {/* Decorative circles */}
              <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-white/10" />

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-cyan-100 text-xs font-medium uppercase tracking-wide">
                    Estimated Salary
                  </span>
                  <TrendingUp className="w-4 h-4 text-cyan-100" />
                </div>
                <p className="text-white text-2xl font-bold animate-count">
                  {formatCurrency(salaryData?.totalSalary ?? 0)}
                </p>
                <div className="flex items-center gap-4 mt-3 text-xs text-cyan-100">
                  <span>{salaryData?.totalPayableDays?.toFixed(1) ?? '0'} payable days</span>
                  <span>·</span>
                  <span>₹{salaryData?.perDaySalary?.toFixed(0) ?? '0'}/day</span>
                </div>

                {/* Month Progress Bar */}
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-white/70">Month Progress</span>
                    <span className="text-xs text-white/70 font-medium">
                      {workingDayProgress.completed.toFixed(1)} / {workingDayProgress.total.toFixed(1)} days
                    </span>
                  </div>
                  <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white/80 rounded-full animate-progress"
                      style={{ width: `${workingDayProgress.percent}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ─── Streak + Weekly Summary Row ───────────────────────── */}
          <div className="responsive-grid-2 mb-5 animate-card-in delay-400">
            {/* Streak Card */}
            <div className="bg-card rounded-2xl p-4 signature-shadow relative overflow-hidden">
              <div className="absolute -bottom-2 -right-2 text-5xl opacity-10">
                🔥
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-1.5 mb-2">
                  <Flame className={`w-4 h-4 text-orange-500 ${streak > 3 ? 'animate-pulse' : ''}`} />
                  <span className="text-xs font-medium text-muted-foreground">Streak</span>
                </div>
                <p className="text-2xl font-bold text-foreground animate-count">
                  {streak}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  consecutive full days
                </p>
                {bestStreak > streak && (
                  <div className="flex items-center gap-1 mt-1.5">
                    <Award className="w-3 h-3 text-amber-500" />
                    <span className="text-[9px] font-medium text-amber-600">Best: {bestStreak} days</span>
                  </div>
                )}
              </div>
            </div>

            {/* Weekly Summary Card */}
            <div className="bg-card rounded-2xl p-4 signature-shadow">
              <div className="flex items-center gap-1.5 mb-3">
                <CalendarDays className="w-4 h-4 text-[#004ac6]" />
                <span className="text-xs font-medium text-muted-foreground">This Week</span>
              </div>
              <div className="flex items-center justify-between gap-1">
                {weekSummary.map((day, i) => {
                  const cfg = day.status ? statusConfig[day.status] : null
                  return (
                    <button
                      key={day.dateStr}
                      onClick={() => setEditDate(day.dateStr)}
                      className="flex flex-col items-center gap-1 cursor-pointer group/week"
                      title={`${day.dateStr} — Click to edit`}
                    >
                      <span className="text-[9px] text-muted-foreground font-medium">
                        {WEEK_DAY_LABELS[i]}
                      </span>
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center transition-all group-hover/week:ring-2 group-hover/week:ring-primary/50 group-hover/week:ring-offset-1 group-hover/week:ring-offset-card active:scale-90 ${
                          day.isToday ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''
                        }`}
                        style={{
                          backgroundColor: cfg ? cfg.bg : 'var(--muted)',
                          border: day.isToday ? '2px solid #2563eb' : 'none',
                        }}
                      >
                        {cfg && (
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: cfg.color }}
                          />
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* ─── Status Cards (Enhanced 2x2 Grid) ─────────────────── */}
          <div className="responsive-grid-4 mb-5">
            {([
              { label: 'Full Days', value: summary.full, cfg: statusConfig.FULL_DAY, key: 'full' as const },
              { label: 'Half Days', value: summary.half, cfg: statusConfig.HALF_DAY, key: 'half' as const },
              { label: 'Absent Days', value: summary.absent, cfg: statusConfig.ABSENT, key: 'absent' as const },
              { label: 'Off Days', value: summary.off, cfg: statusConfig.OFF, key: 'off' as const },
            ] as const).map((item, index) => {
              const percent = Math.round((item.value / totalDays) * 100)
              const staggerDelay = `delay-${(index + 5) * 100}`
              return (
                <div
                  key={item.label}
                  className={`animate-card-in ${staggerDelay} bg-card rounded-2xl p-4 signature-shadow relative overflow-hidden btn-press cursor-default`}
                >
                  {/* Subtle gradient background */}
                  <div
                    className="absolute inset-0 opacity-30"
                    style={{
                      background: `linear-gradient(135deg, ${item.cfg.bg} 0%, transparent 60%)`,
                    }}
                  />

                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: item.cfg.bg }}
                      >
                        <div style={{ color: item.cfg.textColor }}>{item.cfg.icon}</div>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-foreground animate-count">
                      {item.value}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <span
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                        style={{
                          backgroundColor: item.cfg.bg,
                          color: item.cfg.textColor,
                        }}
                      >
                        {percent}%
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* ─── Quick Actions (Prominent Cards) ───────────────────── */}
          <div className="responsive-grid-2 animate-card-in delay-900">
            <button
              onClick={() => setActiveTab('calendar')}
              className="glass-card rounded-2xl p-4 signature-shadow btn-press text-left group"
            >
              <div className="w-10 h-10 rounded-xl bg-[#dbe1ff] dark:bg-blue-900/30 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <CalendarDays className="w-5 h-5 text-[#004ac6]" />
              </div>
              <p className="text-sm font-semibold text-foreground">View Calendar</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">See all dates</p>
            </button>

            <button
              onClick={() => setCurrentScreen('salary')}
              className="glass-card rounded-2xl p-4 signature-shadow btn-press text-left group"
            >
              <div className="w-10 h-10 rounded-xl bg-[#d1fae5] dark:bg-emerald-900/30 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <DollarSign className="w-5 h-5 text-[#065f46]" />
              </div>
              <p className="text-sm font-semibold text-foreground">Salary Details</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">View breakdown</p>
            </button>
          </div>

          {/* ─── Monthly Insights Card ──────────────────────────────── */}
          <div className="bg-card rounded-2xl p-5 signature-shadow mb-5 animate-card-in">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" /> Monthly Insights
            </h3>
            <div className="space-y-3">
              {/* Working Hours */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 dark:bg-blue-900/30 flex items-center justify-center">
                    <Clock className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-foreground">Working Hours</p>
                    <p className="text-[10px] text-muted-foreground">Estimated total</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-foreground">{monthlyInsights.totalHours}h</span>
              </div>

              {/* Best Week */}
              {monthlyInsights.bestWeekStart && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[#d1fae5] dark:bg-emerald-900/30 flex items-center justify-center">
                      <Award className="w-4 h-4 text-[#10b981]" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-foreground">Best Week</p>
                      <p className="text-[10px] text-muted-foreground">{monthlyInsights.bestWeekCount}/5 full days</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-medium text-[#10b981]">
                    {new Date(monthlyInsights.bestWeekStart + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              )}

              {/* Deductions */}
              {monthlyInsights.deductions > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[#fee2e2] dark:bg-red-900/30 flex items-center justify-center">
                      <TrendingDown className="w-4 h-4 text-[#ef4444]" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-foreground">Deductions</p>
                      <p className="text-[10px] text-muted-foreground">Lost vs full salary</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-[#ef4444]">
                    -{formatCurrency(monthlyInsights.deductions)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ─── Attendance Heatmap Mini-Calendar ──────────────────────── */}
          <div className="bg-card rounded-2xl p-5 signature-shadow mb-5 animate-card-in">
            <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" /> Attendance Heatmap
            </h3>
            <p className="text-[10px] text-muted-foreground mb-4">Tap any day to edit attendance</p>

            {/* Month/Year label */}
            <p className="text-xs text-muted-foreground text-center mb-3 font-medium">
              {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
            </p>

            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {HEATMAP_DAY_LABELS.map((label) => (
                <div key={label} className="text-[9px] text-muted-foreground font-medium text-center">
                  {label}
                </div>
              ))}
            </div>

            {/* Heatmap grid */}
            <div className="flex flex-col gap-1">
              {buildMonthGrid(selectedYear, selectedMonth).map((row, ri) => (
                <div key={ri} className="grid grid-cols-7 gap-1">
                  {row.map((day, ci) => {
                    if (day === null) {
                      return <div key={ci} className="aspect-square rounded-sm" />
                    }
                    const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                    const record = attendanceRecords.find(r => r.date === dateStr)
                    const status = record?.status ?? null
                    const isToday = dateStr === todayStr
                    const bgColor = status ? HEATMAP_COLORS[status] : HEATMAP_NO_DATA

                    return (
                      <button
                        key={ci}
                        onClick={() => setEditDate(dateStr)}
                        className="aspect-square rounded-sm transition-all relative group cursor-pointer hover:ring-2 hover:ring-primary/50 hover:ring-offset-1 hover:ring-offset-card active:scale-90"
                        style={{ backgroundColor: bgColor }}
                        title={`${dateStr}${status ? ` — ${statusConfig[status].label}` : ' — No data'}\nClick to edit`}
                      >
                        {isToday && (
                          <div className="absolute inset-0 rounded-sm ring-2 ring-primary ring-offset-1 ring-offset-card" />
                        )}
                        {/* Tooltip on hover */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-[8px] font-bold text-white drop-shadow-md">{day}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-3 mt-3 flex-wrap">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#10b981' }} />
                <span className="text-[9px] text-muted-foreground">Full</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#f59e0b' }} />
                <span className="text-[9px] text-muted-foreground">Half</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#ef4444' }} />
                <span className="text-[9px] text-muted-foreground">Absent</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#94a3b8' }} />
                <span className="text-[9px] text-muted-foreground">Off</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: HEATMAP_NO_DATA }} />
                <span className="text-[9px] text-muted-foreground">No data</span>
              </div>
            </div>
          </div>

          {/* ─── Recent Activity ──────────────────────────────────────── */}
          <div className="bg-card rounded-2xl p-5 signature-shadow mb-5 animate-card-in">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" /> Recent Activity
            </h3>
            {(() => {
              const recentRecords = [...attendanceRecords]
                .sort((a, b) => b.date.localeCompare(a.date))
                .slice(0, 5)

              if (recentRecords.length === 0) {
                return (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    No attendance records yet
                  </p>
                )
              }

              return (
                <div className="space-y-2.5">
                  {recentRecords.map((record) => {
                    const cfg = statusConfig[record.status]
                    const dateObj = new Date(record.date + 'T00:00:00')
                    const dateLabel = dateObj.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      weekday: 'short',
                    })
                    const isToday = record.date === todayStr

                    return (
                      <button
                        key={record.id}
                        onClick={() => setEditDate(record.date)}
                        className="flex items-center justify-between py-1.5 w-full cursor-pointer group/activity rounded-lg px-1 -mx-1 hover:bg-muted/50 transition-colors"
                        title="Click to edit"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: cfg.bg }}
                          >
                            <div style={{ color: cfg.textColor }}>{cfg.icon}</div>
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-medium text-foreground">{dateLabel}</p>
                              {isToday && (
                                <span className="text-[8px] font-bold text-primary bg-primary/10 dark:bg-blue-900/30 px-1.5 py-0.5 rounded-full">
                                  TODAY
                                </span>
                              )}
                            </div>
                            {record.note && (
                              <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[140px]">
                                {record.note}
                              </p>
                            )}
                          </div>
                        </div>
                        <Badge
                          className="text-[9px] font-semibold px-2 py-0.5 border-0"
                          style={{
                            backgroundColor: cfg.bg,
                            color: cfg.textColor,
                          }}
                        >
                          {cfg.label}
                        </Badge>
                      </button>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        </>
      )}
    </div>
  )
}
