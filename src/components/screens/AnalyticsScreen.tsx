'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronLeft, ChevronRight, TrendingUp, TrendingDown,
  Clock, Target, Zap, ArrowUpRight, ArrowDownRight, Loader2,
  Calendar
} from 'lucide-react'
import { useAppStore, type AttendanceStatus } from '@/lib/store'
import { formatCurrency, getMonthRange, MONTH_NAMES, statusConfig, DonutChart, DonutLegend, type DonutSegment } from './shared'

// ─── Types ────────────────────────────────────────────────────────────
interface MonthlyStats {
  full: number
  half: number
  absent: number
  off: number
  totalCalendar: number
  workingCapacity: number
  totalPayable: number
  totalSalary: number
  perDaySalary: number
}

interface MonthData {
  month: number
  year: number
  stats: MonthlyStats
}

// ─── Helpers ──────────────────────────────────────────────────────────
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function computeStats(records: Array<{ status: string; payableValue: number }>, salaryData: { totalCalendarDays: number; workingPayableCapacity: number; totalPayableDays: number; totalSalary: number; perDaySalary: number } | null): MonthlyStats {
  const counts = { full: 0, half: 0, absent: 0, off: 0 }
  for (const r of records) {
    if (r.status === 'FULL_DAY') counts.full++
    else if (r.status === 'HALF_DAY') counts.half++
    else if (r.status === 'ABSENT') counts.absent++
    else if (r.status === 'OFF') counts.off++
  }
  return {
    ...counts,
    totalCalendar: salaryData?.totalCalendarDays ?? 0,
    workingCapacity: salaryData?.workingPayableCapacity ?? 0,
    totalPayable: salaryData?.totalPayableDays ?? 0,
    totalSalary: salaryData?.totalSalary ?? 0,
    perDaySalary: salaryData?.perDaySalary ?? 0,
  }
}

export function AnalyticsScreen() {
  const {
    employee, selectedMonth, selectedYear, setSelectedMonth, setSelectedYear,
    attendanceRecords, salaryData, dataLoading, fetchMonthData, showToast,
  } = useAppStore()
  const hasLoadedRef = useRef(false)

  // Month navigation
  const prevMonth = () => {
    if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear(selectedYear - 1) }
    else setSelectedMonth(selectedMonth - 1)
  }
  const nextMonth = () => {
    if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear(selectedYear + 1) }
    else setSelectedMonth(selectedMonth + 1)
  }

  // Load current month data
  useEffect(() => {
    if (employee && !hasLoadedRef.current) {
      hasLoadedRef.current = true
      fetchMonthData()
    }
  }, [employee, fetchMonthData])

  useEffect(() => {
    if (hasLoadedRef.current && employee) {
      fetchMonthData()
    }
  }, [selectedMonth, selectedYear, employee, fetchMonthData])

  // Fetch 6-month trend data
  const [trendData, setTrendData] = useState<MonthData[]>([])
  const [prevMonthData, setPrevMonthData] = useState<MonthData | null>(null)
  const [trendLoading, setTrendLoading] = useState(false)

  useEffect(() => {
    if (!employee) return
    let cancelled = false
    const fetchTrend = async () => {
      if (cancelled) return
      setTrendLoading(true)
      const months: MonthData[] = []
      // Fetch 6 months ending with selected month
      for (let i = 5; i >= 0; i--) {
        const d = new Date(selectedYear, selectedMonth - 1 - i, 1)
        const m = d.getMonth() + 1
        const y = d.getFullYear()
        try {
          const { from, to } = getMonthRange(m, y)
          const [attRes, salRes] = await Promise.all([
            fetch(`/api/attendance?from=${from}&to=${to}&employeeId=${employee.id}`),
            fetch(`/api/salary?month=${m}&year=${y}`),
          ])
          let records: Array<{ status: string; payableValue: number }> = []
          let salData: MonthlyStats = { full: 0, half: 0, absent: 0, off: 0, totalCalendar: 0, workingCapacity: 0, totalPayable: 0, totalSalary: 0, perDaySalary: 0 }

          if (attRes.ok) {
            const data = await attRes.json()
            records = data.records || []
          }
          if (salRes.ok) {
            const data = await salRes.json()
            salData = computeStats(records, data.salary)
          } else {
            salData = computeStats(records, null)
          }

          months.push({ month: m, year: y, stats: salData })
        } catch {
          months.push({ month: m, year: y, stats: { full: 0, half: 0, absent: 0, off: 0, totalCalendar: 0, workingCapacity: 0, totalPayable: 0, totalSalary: 0, perDaySalary: 0 } })
        }
      }

      // Previous month for comparison
      const pd = new Date(selectedYear, selectedMonth - 2, 1)
      const pm = pd.getMonth() + 1
      const py = pd.getFullYear()
      try {
        const { from, to } = getMonthRange(pm, py)
        const [attRes, salRes] = await Promise.all([
          fetch(`/api/attendance?from=${from}&to=${to}&employeeId=${employee.id}`),
          fetch(`/api/salary?month=${pm}&year=${py}`),
        ])
        let records: Array<{ status: string; payableValue: number }> = []
        if (attRes.ok) { const data = await attRes.json(); records = data.records || [] }
        let prevStats: MonthlyStats = { full: 0, half: 0, absent: 0, off: 0, totalCalendar: 0, workingCapacity: 0, totalPayable: 0, totalSalary: 0, perDaySalary: 0 }
        if (salRes.ok) {
          const data = await salRes.json()
          prevStats = computeStats(records, data.salary)
        } else {
          prevStats = computeStats(records, null)
        }
        setPrevMonthData({ month: pm, year: py, stats: prevStats })
      } catch {
        setPrevMonthData(null)
      }

      if (!cancelled) {
        setTrendData(months)
        setTrendLoading(false)
      }
    }
    fetchTrend()
    return () => { cancelled = true }
  }, [selectedMonth, selectedYear, employee])

  // Current month stats
  const currentStats = useMemo(() => computeStats(
    attendanceRecords.map(r => ({ status: r.status, payableValue: r.payableValue })),
    salaryData
  ), [attendanceRecords, salaryData])

  // ─── Attendance Rate ─────────────────────────────────────────────
  const attendanceRate = useMemo(() => {
    const working = currentStats.workingCapacity
    if (working === 0) return 0
    // HALF_DAY and OFF are paid as full day (1.0), only ABSENT (0) is unpaid
    const effective = currentStats.full + currentStats.half + currentStats.off
    return (effective / working) * 100
  }, [currentStats])

  // ─── Punctuality Score ───────────────────────────────────────────
  const punctualityScore = useMemo(() => {
    const total = currentStats.full + currentStats.half + currentStats.absent
    if (total === 0) return 0
    return (currentStats.full / total) * 100
  }, [currentStats])

  // ─── Average Weekly Hours ────────────────────────────────────────
  const avgWeeklyHours = useMemo(() => {
    if (currentStats.workingCapacity === 0) return 0
    const totalHours = currentStats.full * 8 + currentStats.half * 4
    const weeksInMonth = currentStats.workingCapacity / 6 // ~6 working days per week
    if (weeksInMonth === 0) return 0
    return totalHours / weeksInMonth
  }, [currentStats])

  // ─── Salary Efficiency ──────────────────────────────────────────
  const salaryEfficiency = useMemo(() => {
    if (!salaryData || !employee) return 0
    const maxPossible = employee.monthlySalary
    if (maxPossible === 0) return 0
    return (salaryData.totalSalary / maxPossible) * 100
  }, [salaryData, employee])

  // ─── Day-of-Week Analysis ───────────────────────────────────────
  const dayOfWeekAnalysis = useMemo(() => {
    const days: Record<number, { total: number; absent: number; half: number }> = {}
    for (let d = 1; d <= 6; d++) days[d] = { total: 0, absent: 0, half: 0 }

    for (const r of attendanceRecords) {
      const date = new Date(r.date + 'T00:00:00')
      const dow = date.getDay() // 0=Sun, 1=Mon...6=Sat
      if (dow === 0) continue // skip Sundays (OFF)
      if (days[dow]) {
        days[dow].total++
        if (r.status === 'ABSENT') days[dow].absent++
        else if (r.status === 'HALF_DAY') days[dow].half++
      }
    }

    return DAY_LABELS.map((label, i) => {
      const dayNum = i + 1 // Mon=1..Sat=6
      const data = days[dayNum] || { total: 0, absent: 0, half: 0 }
      const absenceRate = data.total > 0 ? ((data.absent + data.half) / data.total) * 100 : 0
      return { label, ...data, absenceRate }
    })
  }, [attendanceRecords])

  // ─── Donut Segments ─────────────────────────────────────────────
  const donutSegments: DonutSegment[] = useMemo(() => [
    { value: currentStats.full, color: statusConfig.FULL_DAY.color, label: 'Full Day' },
    { value: currentStats.half, color: statusConfig.HALF_DAY.color, label: 'Half Day' },
    { value: currentStats.absent, color: statusConfig.ABSENT.color, label: 'Absent' },
    { value: currentStats.off, color: statusConfig.OFF.color, label: 'Off' },
  ], [currentStats])

  const totalSummary = currentStats.full + currentStats.half + currentStats.absent + currentStats.off

  // ─── Trend chart data (6 months, full day %) ────────────────────
  const trendBars = useMemo(() => {
    return trendData.map(m => {
      const total = m.stats.full + m.stats.half + m.stats.absent
      const rate = total > 0 ? (m.stats.full / total) * 100 : 0
      return { month: m.month, year: m.year, rate, isCurrent: m.month === selectedMonth && m.year === selectedYear }
    })
  }, [trendData, selectedMonth, selectedYear])

  const maxTrendRate = useMemo(() => Math.max(...trendBars.map(b => b.rate), 1), [trendBars])

  // ─── Month comparison ───────────────────────────────────────────
  const monthComparison = useMemo(() => {
    if (!prevMonthData) return null
    const currRate = attendanceRate
    const prevRate = (() => {
      const working = prevMonthData.stats.workingCapacity
      if (working === 0) return 0
      const effective = prevMonthData.stats.full + prevMonthData.stats.half + prevMonthData.stats.off
      return (effective / working) * 100
    })()
    const diff = currRate - prevRate
    return { currRate, prevRate, diff, isUp: diff >= 0 }
  }, [attendanceRate, prevMonthData])

  // ─── Key Metrics Data ───────────────────────────────────────────
  const keyMetrics = useMemo(() => [
    {
      label: 'Attendance Rate',
      value: `${attendanceRate.toFixed(1)}%`,
      icon: <Target className="w-4 h-4" />,
      color: '#10b981',
      bg: '#d1fae5',
      description: `${(currentStats.full + currentStats.half + currentStats.off).toFixed(1)} of ${currentStats.workingCapacity} days`,
    },
    {
      label: 'Punctuality Score',
      value: `${punctualityScore.toFixed(1)}%`,
      icon: <Zap className="w-4 h-4" />,
      color: '#f59e0b',
      bg: '#fef3c7',
      description: `${currentStats.full} full of ${currentStats.full + currentStats.half + currentStats.absent} working`,
    },
    {
      label: 'Avg Weekly Hours',
      value: `${avgWeeklyHours.toFixed(1)}h`,
      icon: <Clock className="w-4 h-4" />,
      color: '#2563eb',
      bg: '#dbeafe',
      description: `~${(avgWeeklyHours / 8).toFixed(1)} full days/week`,
    },
    {
      label: 'Salary Efficiency',
      value: `${salaryEfficiency.toFixed(1)}%`,
      icon: <TrendingUp className="w-4 h-4" />,
      color: '#8b5cf6',
      bg: '#ede9fe',
      description: formatCurrency(salaryData?.totalSalary ?? 0),
    },
  ], [attendanceRate, punctualityScore, avgWeeklyHours, salaryEfficiency, currentStats, salaryData])

  return (
    <div className="screen-container screen-container-wide">
      {/* Header */}
      <div className="flex items-center gap-2 mb-5 animate-card-in">
        <button onClick={() => useAppStore.getState().setActiveTab('reports')} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center">
          <ChevronLeft className="w-4 h-4 text-foreground" />
        </button>
        <h1 className="text-xl font-bold text-foreground">Analytics</h1>
      </div>

      {/* Month Selector */}
      <div className="flex items-center justify-between mb-5 animate-card-in delay-100">
        <button onClick={prevMonth} className="w-9 h-9 rounded-xl bg-card signature-shadow btn-press flex items-center justify-center">
          <ChevronLeft className="w-4 h-4 text-foreground" />
        </button>
        <h2 className="text-sm font-semibold text-foreground">{MONTH_NAMES[selectedMonth - 1]} {selectedYear}</h2>
        <button onClick={nextMonth} className="w-9 h-9 rounded-xl bg-card signature-shadow btn-press flex items-center justify-center">
          <ChevronRight className="w-4 h-4 text-foreground" />
        </button>
      </div>

      {dataLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : (
        <>
          {/* Attendance Overview Card with Donut Chart */}
          <div className="bg-card rounded-2xl p-5 signature-shadow mb-5 animate-card-in delay-200">
            <h3 className="text-sm font-semibold text-foreground mb-4">Attendance Overview</h3>
            {totalSummary > 0 ? (
              <>
                <DonutChart
                  segments={donutSegments}
                  centerValue={`${attendanceRate.toFixed(0)}%`}
                  centerLabel="rate"
                  size="lg"
                />
                <DonutLegend segments={donutSegments} />
              </>
            ) : (
              <p className="text-center text-sm text-muted-foreground py-4">No attendance data for this month</p>
            )}
          </div>

          {/* Key Metrics Grid (2x2) */}
          <div className="responsive-grid-4 mb-5">
            {keyMetrics.map((metric, i) => (
              <div
                key={metric.label}
                className="bg-card rounded-2xl p-4 signature-shadow animate-card-in btn-press cursor-default"
                style={{ animationDelay: `${0.2 + i * 0.06}s` }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: metric.bg }}>
                    <div style={{ color: metric.color }}>{metric.icon}</div>
                  </div>
                </div>
                <p className="text-xl font-bold text-foreground animate-count">{metric.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{metric.label}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{metric.description}</p>
              </div>
            ))}
          </div>

          {/* Trend Chart - 6 months attendance rate */}
          <div className="bg-card rounded-2xl p-5 signature-shadow mb-5 animate-card-in delay-400">
            <h3 className="text-sm font-semibold text-foreground mb-4">6-Month Trend</h3>
            {trendLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
              </div>
            ) : (
              <div className="flex items-end justify-between gap-2 h-32">
                {trendBars.map((bar, i) => (
                  <div key={`${bar.month}-${bar.year}`} className="flex flex-col items-center flex-1">
                    <span className="text-[10px] font-medium text-muted-foreground mb-1">
                      {bar.rate.toFixed(0)}%
                    </span>
                    <div className="w-full relative" style={{ height: '100px' }}>
                      <div
                        className={`absolute bottom-0 w-full rounded-t-lg transition-all duration-500 ${
                          bar.isCurrent ? 'bg-primary' : 'bg-primary/15 dark:bg-blue-900/30'
                        }`}
                        style={{
                          height: `${Math.max((bar.rate / maxTrendRate) * 100, 4)}%`,
                          minHeight: '4px',
                        }}
                      />
                    </div>
                    <span className={`text-[9px] mt-1.5 font-medium ${bar.isCurrent ? 'text-primary' : 'text-muted-foreground'}`}>
                      {MONTH_ABBR[bar.month - 1]}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Day-of-Week Analysis */}
          <div className="bg-card rounded-2xl p-5 signature-shadow mb-5 animate-card-in delay-500">
            <h3 className="text-sm font-semibold text-foreground mb-4">Day-of-Week Analysis</h3>
            <p className="text-[10px] text-muted-foreground mb-3">Absence rate by weekday (absent + half days)</p>
            <div className="space-y-2.5">
              {dayOfWeekAnalysis.map((day) => (
                <div key={day.label} className="flex items-center gap-3">
                  <span className="text-xs font-medium text-muted-foreground w-8">{day.label}</span>
                  <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden relative">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.max(day.absenceRate, 0)}%`,
                        backgroundColor: day.absenceRate > 30 ? '#ef4444' : day.absenceRate > 15 ? '#f59e0b' : '#10b981',
                        minWidth: day.absenceRate > 0 ? '4px' : '0px',
                      }}
                    />
                  </div>
                  <span className={`text-[10px] font-semibold w-10 text-right ${
                    day.absenceRate > 30 ? 'text-[#ef4444]' : day.absenceRate > 15 ? 'text-[#f59e0b]' : 'text-[#10b981]'
                  }`}>
                    {day.absenceRate.toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Monthly Comparison */}
          {monthComparison && (
            <div className="bg-card rounded-2xl p-5 signature-shadow mb-5 animate-card-in delay-600">
              <h3 className="text-sm font-semibold text-foreground mb-4">Monthly Comparison</h3>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <div className="text-center flex-1">
                  <p className="text-[10px] text-muted-foreground mb-1">{MONTH_NAMES[selectedMonth - 1].slice(0, 3)}</p>
                  <p className="text-lg font-bold text-foreground">{monthComparison.currRate.toFixed(1)}%</p>
                  <p className="text-[10px] text-muted-foreground">attendance</p>
                </div>

                <div className={`flex items-center gap-1 px-3 py-1.5 rounded-full ${
                  monthComparison.isUp ? 'bg-[#d1fae5]' : 'bg-[#fee2e2]'
                }`}>
                  {monthComparison.isUp ? (
                    <ArrowUpRight className="w-4 h-4 text-[#10b981]" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4 text-[#ef4444]" />
                  )}
                  <span className={`text-xs font-semibold ${
                    monthComparison.isUp ? 'text-[#10b981]' : 'text-[#ef4444]'
                  }`}>
                    {Math.abs(monthComparison.diff).toFixed(1)}%
                  </span>
                </div>

                <div className="text-center flex-1">
                  <p className="text-[10px] text-muted-foreground mb-1">{MONTH_ABBR[prevMonthData!.month - 1]}</p>
                  <p className="text-lg font-bold text-muted-foreground">{monthComparison.prevRate.toFixed(1)}%</p>
                  <p className="text-[10px] text-muted-foreground">attendance</p>
                </div>
              </div>

              {/* Salary comparison row */}
              <div className="mt-4 pt-4 border-t border-border flex flex-col gap-2 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
                <span className="text-xs text-muted-foreground">Salary Change</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{formatCurrency(salaryData?.totalSalary ?? 0)}</span>
                  {salaryData && prevMonthData && (() => {
                    const diff = salaryData.totalSalary - prevMonthData.stats.totalSalary
                    const isUp = diff >= 0
                    return (
                      <span className={`text-[10px] font-medium flex items-center gap-0.5 ${isUp ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                        {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {isUp ? '+' : ''}{formatCurrency(diff)}
                      </span>
                    )
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* Yearly Summary - 12 month grid */}
          <div className="bg-card rounded-2xl p-5 signature-shadow mb-5 animate-card-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" /> Yearly Summary
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const y = selectedYear - 1
                    setSelectedYear(y)
                  }}
                  className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center btn-press"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs font-semibold text-foreground min-w-[40px] text-center">{selectedYear}</span>
                <button
                  onClick={() => {
                    const y = selectedYear + 1
                    setSelectedYear(y)
                  }}
                  className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center btn-press"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {trendLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
              </div>
            ) : (
              <div className="responsive-grid-4">
                {MONTH_ABBR.map((monthName, i) => {
                  const m = i + 1
                  const monthData = trendData.find(t => t.month === m && t.year === selectedYear)
                  const total = monthData ? monthData.stats.full + monthData.stats.half + monthData.stats.absent : 0
                  const rate = total > 0 ? (monthData?.stats.full ?? 0) / total * 100 : 0
                  const salary = monthData?.stats.totalSalary ?? 0
                  const isCurrentMonth = m === selectedMonth
                  const rateColor = rate > 80 ? '#10b981' : rate > 60 ? '#f59e0b' : rate > 0 ? '#ef4444' : '#c3c6d7'
                  const rateBg = rate > 80 ? '#d1fae5' : rate > 60 ? '#fef3c7' : rate > 0 ? '#fee2e2' : '#f1f5f9'

                  return (
                    <button
                      key={m}
                      onClick={() => { setSelectedMonth(m) }}
                      className={`rounded-xl p-2.5 text-center btn-press transition-all ${
                        isCurrentMonth ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''
                      }`}
                      style={{ backgroundColor: rateBg }}
                    >
                      <p className="text-[10px] font-semibold text-foreground">{monthName}</p>
                      <p className="text-lg font-bold mt-0.5" style={{ color: rateColor }}>
                        {rate > 0 ? `${rate.toFixed(0)}%` : '—'}
                      </p>
                      {salary > 0 && (
                        <p className="text-[8px] text-muted-foreground font-medium">
                          {formatCurrency(salary).replace('₹', '₹')}
                        </p>
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Color legend */}
            <div className="flex items-center justify-center gap-4 mt-3">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-[#10b981]" />
                <span className="text-[9px] text-muted-foreground">&gt;80%</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-[#f59e0b]" />
                <span className="text-[9px] text-muted-foreground">60-80%</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-[#ef4444]" />
                <span className="text-[9px] text-muted-foreground">&lt;60%</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
