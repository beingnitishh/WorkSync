'use client'

import React, { useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight, FileDown, FileText, Loader2 } from 'lucide-react'
import { useAppStore, type AttendanceStatus } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { formatCurrency, getMonthRange, MONTH_NAMES, statusConfig, DonutChart, DonutLegend, type DonutSegment } from './shared'

export function MonthlyReportScreen() {
  const { employee, selectedMonth, selectedYear, setSelectedMonth, setSelectedYear, salaryData, attendanceRecords, showToast, dataLoading, fetchMonthData } = useAppStore()

  useEffect(() => {
    if (employee) {
      fetchMonthData()
    }
  }, [employee, selectedMonth, selectedYear, fetchMonthData])

  const prevMonth = () => {
    if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear(selectedYear - 1) }
    else setSelectedMonth(selectedMonth - 1)
  }
  const nextMonth = () => {
    if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear(selectedYear + 1) }
    else setSelectedMonth(selectedMonth + 1)
  }

  const handleExportCsv = async () => {
    const { from, to } = getMonthRange(selectedMonth, selectedYear)
    try {
      const res = await fetch(`/api/export?fromDate=${from}&toDate=${to}&format=csv`)
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = `attendance-${from}-to-${to}.csv`; a.click()
        URL.revokeObjectURL(url)
        showToast('CSV exported', 'success')
      }
    } catch { showToast('Export failed', 'error') }
  }

  const handleExportPdf = () => {
    const { from, to } = getMonthRange(selectedMonth, selectedYear)
    window.open(`/api/export?fromDate=${from}&toDate=${to}&format=pdf`, '_blank')
    showToast('PDF report opened in new tab', 'success')
  }

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

  const totalSummary = summary.full + summary.half + summary.absent + summary.off

  const donutSegments: DonutSegment[] = useMemo(() => [
    { value: summary.full, color: statusConfig.FULL_DAY.color, label: 'Full Day' },
    { value: summary.half, color: statusConfig.HALF_DAY.color, label: 'Half Day' },
    { value: summary.absent, color: statusConfig.ABSENT.color, label: 'Absent' },
    { value: summary.off, color: statusConfig.OFF.color, label: 'Off' },
  ], [summary])

  const payablePercent = useMemo(() => {
    if (!salaryData || salaryData.workingPayableCapacity === 0) return 0
    return Math.min(100, (salaryData.totalPayableDays / salaryData.workingPayableCapacity) * 100)
  }, [salaryData])

  // Weekly subtotal calculation
  const weeklySubtotals = useMemo(() => {
    if (!salaryData) return new Map<number, { payable: number; payment: number }>()
    const map = new Map<number, { payable: number; payment: number }>()
    for (const day of salaryData.breakdown) {
      const d = new Date(day.date + 'T00:00:00')
      const weekNum = Math.ceil((d.getDate()) / 7)
      if (!map.has(weekNum)) map.set(weekNum, { payable: 0, payment: 0 })
      const entry = map.get(weekNum)!
      entry.payable += day.payableValue
      entry.payment += day.dailyPayment
    }
    return map
  }, [salaryData])

  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  return (
    <div className="screen-container screen-container-wide">
      <div className="flex items-center gap-2 mb-5">
        <button onClick={() => useAppStore.getState().setActiveTab('reports')} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center"><ChevronLeft className="w-4 h-4 text-foreground" /></button>
        <h1 className="text-xl font-bold text-foreground">Monthly Report</h1>
      </div>

      <div className="flex items-center justify-between mb-5">
        <button onClick={prevMonth} className="w-9 h-9 rounded-xl bg-card signature-shadow btn-press flex items-center justify-center"><ChevronLeft className="w-4 h-4 text-foreground" /></button>
        <h2 className="text-sm font-semibold text-foreground">{MONTH_NAMES[selectedMonth - 1]} {selectedYear}</h2>
        <button onClick={nextMonth} className="w-9 h-9 rounded-xl bg-card signature-shadow btn-press flex items-center justify-center"><ChevronRight className="w-4 h-4 text-foreground" /></button>
      </div>

      {dataLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
      ) : (
        <>
          {/* Salary Card with gradient */}
          <div className="gradient-salary gradient-salary-overlay rounded-2xl p-5 signature-shadow mb-5 animate-card-in">
            <span className="text-cyan-100 text-xs font-medium uppercase tracking-wide">Estimated Salary</span>
            <p className="text-white text-2xl font-bold mt-1 animate-count">{formatCurrency(salaryData?.totalSalary ?? 0)}</p>
          </div>

          {/* Visual Summary with Donut Chart */}
          <div className="bg-card rounded-2xl p-5 signature-shadow mb-5 animate-card-in delay-100">
            <h3 className="text-sm font-semibold text-foreground mb-4">Attendance Summary</h3>
            {totalSummary > 0 ? (
              <>
                <DonutChart
                  segments={donutSegments}
                  centerValue={salaryData?.totalPayableDays.toFixed(1) ?? '0'}
                  centerLabel="payable"
                  size="md"
                />
                <DonutLegend segments={donutSegments} />
              </>
            ) : (
              <p className="text-center text-sm text-muted-foreground py-4">No attendance data</p>
            )}
          </div>

          {/* Payable Progress Bar */}
          <div className="bg-card rounded-2xl p-5 signature-shadow mb-5 animate-card-in delay-200">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-medium text-muted-foreground">Payable Progress</span>
              <span className="text-xs font-semibold text-primary">{payablePercent.toFixed(0)}%</span>
            </div>
            <Progress value={payablePercent} className="h-2 rounded-full animate-progress" />
            <div className="flex justify-between mt-1.5">
              <span className="text-[10px] text-muted-foreground">{salaryData?.totalPayableDays.toFixed(1) ?? 0} payable days</span>
              <span className="text-[10px] text-muted-foreground">of {salaryData?.workingPayableCapacity ?? 0} capacity</span>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="responsive-grid-4 mb-5">
            {[
              { label: 'Full', value: summary.full, cfg: statusConfig.FULL_DAY },
              { label: 'Half', value: summary.half, cfg: statusConfig.HALF_DAY },
              { label: 'Absent', value: summary.absent, cfg: statusConfig.ABSENT },
              { label: 'Off', value: summary.off, cfg: statusConfig.OFF },
            ].map((item, i) => (
              <div key={item.label} className="bg-card rounded-xl p-3 signature-shadow text-center animate-card-in" style={{ animationDelay: `${0.2 + i * 0.05}s` }}>
                <div className="w-6 h-6 rounded-md mx-auto mb-1 flex items-center justify-center" style={{ backgroundColor: item.cfg.bg }}>
                  <div style={{ color: item.cfg.textColor, transform: 'scale(0.7)' }}>{item.cfg.icon}</div>
                </div>
                <p className="text-lg font-bold" style={{ color: item.cfg.color }}>{item.value}</p>
                <p className="text-[9px] text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>

          {/* Daily Breakdown with alternating rows, weekend highlight, today indicator, weekly subtotals */}
          <div className="bg-card rounded-2xl signature-shadow overflow-hidden animate-card-in delay-300">
            <div className="p-4 border-b border-border sticky top-0 bg-card z-10">
              <h3 className="text-sm font-semibold text-foreground">Daily Breakdown</h3>
            </div>
            <div className="max-h-96 overflow-y-auto custom-scrollbar">
              {salaryData?.breakdown.map((day, idx) => {
                const cfg = statusConfig[day.status as AttendanceStatus]
                const d = new Date(day.date + 'T00:00:00')
                const dayName = d.toLocaleDateString('en-US', { weekday: 'short' })
                const isSun = d.getDay() === 0
                const isSat = d.getDay() === 6
                const isWeekend = isSun || isSat
                const isToday = day.date === todayStr
                const weekNum = Math.ceil(d.getDate() / 7)

                // Check if we need a weekly subtotal row before this day
                const prevDay = idx > 0 ? salaryData.breakdown[idx - 1] : null
                const prevWeekNum = prevDay ? Math.ceil(new Date(prevDay.date + 'T00:00:00').getDate() / 7) : 0
                const showSubtotal = prevWeekNum > 0 && weekNum !== prevWeekNum
                const subtotal = showSubtotal ? weeklySubtotals.get(prevWeekNum) : null

                return (
                  <React.Fragment key={day.date}>
                    {/* Weekly Subtotal Row */}
                    {showSubtotal && subtotal && (
                      <div className="flex flex-col gap-1 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between px-4 py-2 bg-primary/5 dark:bg-blue-900/15 border-y border-primary/20 dark:border-blue-800/30">
                        <span className="text-[10px] font-semibold text-primary">Week {prevWeekNum} Subtotal</span>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-muted-foreground">{subtotal.payable.toFixed(1)} payable</span>
                          <span className="text-[10px] font-semibold text-primary">₹{subtotal.payment.toFixed(0)}</span>
                        </div>
                      </div>
                    )}
                    {/* Day Row */}
                    <div
                      className={`flex flex-col gap-2 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between px-4 py-2.5 border-b border-border/50 last:border-0 transition-colors ${
                        isToday
                          ? 'bg-primary/5 dark:bg-blue-900/20 border-l-2 border-l-primary'
                          : isSun
                            ? 'bg-primary/10 dark:bg-blue-900/10'
                            : isSat
                              ? 'bg-primary/5 dark:bg-blue-900/5'
                              : idx % 2 === 1
                                ? 'bg-muted/30'
                                : ''
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <span className={`text-xs w-8 ${isWeekend ? 'font-semibold text-primary' : 'text-muted-foreground'}`}>{dayName}</span>
                        <span className={`text-xs font-medium text-foreground ${isToday ? 'underline decoration-primary underline-offset-2' : ''}`}>{d.getDate()}</span>
                        {isToday && <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className="text-[10px] px-2 py-0 h-5 rounded-md border-0 font-medium" style={{ backgroundColor: cfg.bg, color: cfg.textColor }}>{cfg.label}</Badge>
                        <span className="text-xs font-medium text-foreground w-16 text-right">₹{day.dailyPayment.toFixed(0)}</span>
                      </div>
                    </div>
                  </React.Fragment>
                )
              })}

              {/* Final week subtotal */}
              {salaryData && salaryData.breakdown.length > 0 && (() => {
                const lastDay = salaryData.breakdown[salaryData.breakdown.length - 1]
                const lastWeekNum = Math.ceil(new Date(lastDay.date + 'T00:00:00').getDate() / 7)
                const finalSubtotal = weeklySubtotals.get(lastWeekNum)
                if (!finalSubtotal) return null
                return (
                  <div className="flex flex-col gap-1 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between px-4 py-2 bg-primary/5 dark:bg-blue-900/15 border-t border-primary/20 dark:border-blue-800/30">
                    <span className="text-[10px] font-semibold text-primary">Week {lastWeekNum} Subtotal</span>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-muted-foreground">{finalSubtotal.payable.toFixed(1)} payable</span>
                      <span className="text-[10px] font-semibold text-primary">₹{finalSubtotal.payment.toFixed(0)}</span>
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>

          {/* Export Buttons */}
          <div className="responsive-actions mt-4">
            <Button onClick={handleExportCsv} className="flex-1 bg-primary hover:bg-primary/90 text-white rounded-[14px] h-11 text-xs font-medium btn-press">
              <FileDown className="w-4 h-4 mr-2" /> Export CSV
            </Button>
            <Button onClick={handleExportPdf} variant="outline" className="flex-1 border-border rounded-[14px] h-11 text-xs font-medium btn-press">
              <FileText className="w-4 h-4 mr-2" /> Export PDF
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
