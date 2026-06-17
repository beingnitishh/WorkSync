'use client'

import React, { useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight, CircleDollarSign, Loader2, Calculator, Calendar, Briefcase, Clock } from 'lucide-react'
import { useAppStore, type AttendanceStatus } from '@/lib/store'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { formatCurrency, MONTH_NAMES, statusConfig, DonutChart, DonutLegend, type DonutSegment } from './shared'

export function SalaryScreen() {
  const { employee, selectedMonth, selectedYear, salaryData, setSelectedMonth, setSelectedYear, fetchMonthData } = useAppStore()

  useEffect(() => {
    if (employee) {
      fetchMonthData()
    }
  }, [employee, selectedMonth, selectedYear, fetchMonthData])

  const breakdown = useMemo(() => {
    if (!salaryData) return []
    const map: Record<string, { count: number; payment: number }> = {}
    for (const b of salaryData.breakdown) {
      if (!map[b.status]) map[b.status] = { count: 0, payment: 0 }
      map[b.status].count++
      map[b.status].payment += b.dailyPayment
    }
    return Object.entries(map).map(([status, data]) => ({
      status: status as AttendanceStatus,
      ...data,
      payment: Math.round(data.payment * 100) / 100,
    }))
  }, [salaryData])

  const donutSegments: DonutSegment[] = useMemo(() => {
    return breakdown.map((item) => ({
      value: item.count,
      color: statusConfig[item.status].color,
      label: statusConfig[item.status].label,
    }))
  }, [breakdown])

  const totalDays = useMemo(() => breakdown.reduce((sum, b) => sum + b.count, 0), [breakdown])

  const prevMonth = () => {
    if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear(selectedYear - 1) }
    else setSelectedMonth(selectedMonth - 1)
  }
  const nextMonth = () => {
    if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear(selectedYear + 1) }
    else setSelectedMonth(selectedMonth + 1)
  }

  const salaryMethods = [
    { key: 'CALENDAR_DAYS', label: 'Calendar Days', icon: Calendar, divisor: salaryData?.totalCalendarDays ?? 30 },
    { key: 'FIXED_30_DAYS', label: 'Fixed 30 Days', icon: Briefcase, divisor: 30 },
    { key: 'WORKING_DAYS', label: 'Working Days', icon: Clock, divisor: salaryData?.workingPayableCapacity ?? 26 },
  ]

  return (
    <div className="screen-container screen-container-wide">
      <div className="flex items-center gap-2 mb-5">
        <button onClick={() => useAppStore.getState().setActiveTab('reports')} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center"><ChevronLeft className="w-4 h-4 text-foreground" /></button>
        <h1 className="text-xl font-bold text-foreground">Salary Details</h1>
      </div>

      <div className="flex items-center justify-between mb-5">
        <button onClick={prevMonth} className="w-9 h-9 rounded-xl bg-card signature-shadow btn-press flex items-center justify-center"><ChevronLeft className="w-4 h-4 text-foreground" /></button>
        <h2 className="text-sm font-semibold text-foreground">{MONTH_NAMES[selectedMonth - 1]} {selectedYear}</h2>
        <button onClick={nextMonth} className="w-9 h-9 rounded-xl bg-card signature-shadow btn-press flex items-center justify-center"><ChevronRight className="w-4 h-4 text-foreground" /></button>
      </div>

      {!salaryData ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
      ) : salaryData ? (
        <>
          {/* Main Salary Card with gradient */}
          <div className="gradient-salary gradient-salary-overlay rounded-2xl p-5 signature-shadow mb-5 animate-card-in">
            <div className="flex items-center justify-between mb-2">
              <span className="text-cyan-100 text-xs font-medium uppercase tracking-wide">Total Estimated Payment</span>
              <CircleDollarSign className="w-5 h-5 text-cyan-100" />
            </div>
            <p className="text-white text-3xl font-bold animate-count">{formatCurrency(salaryData.totalSalary)}</p>
            <p className="text-cyan-100 text-xs mt-1">{salaryData.totalPayableDays.toFixed(1)} payable days</p>
          </div>

          {/* Donut Chart Section */}
          <div className="bg-card rounded-2xl p-5 signature-shadow mb-5 animate-card-in delay-100">
            <h3 className="text-sm font-semibold text-foreground mb-4">Attendance Breakdown</h3>
            {donutSegments.length > 0 && totalDays > 0 ? (
              <>
                <DonutChart
                  segments={donutSegments}
                  centerValue={salaryData.totalPayableDays.toFixed(1)}
                  centerLabel="payable"
                  size="md"
                />
                <DonutLegend segments={donutSegments} />
              </>
            ) : (
              <p className="text-center text-sm text-muted-foreground py-4">No attendance data</p>
            )}
          </div>

          {/* Attendance Breakdown Cards */}
          <div className="responsive-grid-4 mb-5">
            {breakdown.map((item, index) => {
              const cfg = statusConfig[item.status]
              const pct = totalDays > 0 ? (item.count / totalDays) * 100 : 0
              return (
                <div
                  key={item.status}
                  className={`glass-card rounded-2xl p-4 signature-shadow animate-card-in`}
                  style={{ animationDelay: `${0.1 + index * 0.08}s` }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: cfg.bg }}>
                      <div style={{ color: cfg.textColor }}>{cfg.icon}</div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-foreground">{cfg.label}</p>
                      <p className="text-[10px] text-muted-foreground">{item.count} day{item.count !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <div className="mb-1.5">
                    <Progress
                      value={pct}
                      className="h-1.5 rounded-full"
                      style={{ '--progress-color': cfg.color } as React.CSSProperties}
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-muted-foreground">{Math.round(pct)}%</span>
                    <span className="text-xs font-semibold text-foreground">{formatCurrency(item.payment)}</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Rate Details with visual comparison */}
          <div className="bg-card rounded-2xl p-5 signature-shadow mb-5 animate-card-in delay-300">
            <h3 className="text-sm font-semibold text-foreground mb-3">Rate Details</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#dbe1ff] dark:bg-blue-900/30 flex items-center justify-center"><Calculator className="w-4 h-4 text-[#004ac6]" /></div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Monthly Salary</p>
                  <p className="text-sm font-semibold text-foreground">{formatCurrency(employee?.monthlySalary ?? 0)}</p>
                </div>
              </div>
              <Separator className="bg-border" />
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#dbe1ff] dark:bg-blue-900/30 flex items-center justify-center"><Clock className="w-4 h-4 text-[#004ac6]" /></div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Per Day Salary</p>
                  <p className="text-sm font-bold text-primary">₹{salaryData.perDaySalary.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Salary Method Comparison */}
          <div className="bg-card rounded-2xl p-5 signature-shadow mb-5 animate-card-in delay-400">
            <h3 className="text-sm font-semibold text-foreground mb-3">Calculation Method</h3>
            <div className="space-y-2">
              {salaryMethods.map((m) => {
                const isActive = employee?.salaryCalculationMethod === m.key
                const perDay = m.divisor > 0 ? (employee?.monthlySalary ?? 0) / m.divisor : 0
                const Icon = m.icon
                return (
                  <div
                    key={m.key}
                    className={`rounded-xl p-3 border transition-all ${
                      isActive
                        ? 'border-primary bg-primary/5 dark:bg-blue-900/20'
                        : 'border-border bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isActive ? 'bg-primary' : 'bg-muted'}`}>
                        <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-muted-foreground'}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className={`text-xs font-medium ${isActive ? 'text-primary' : 'text-foreground'}`}>{m.label}</p>
                          {isActive && (
                            <span className="text-[9px] font-semibold bg-primary text-white px-1.5 py-0.5 rounded-full">Active</span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground">₹{perDay.toFixed(2)}/day ÷ {m.divisor} days</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Formula Section with code-like styling */}
          <div className="bg-[#1e1e2e] rounded-2xl p-5 signature-shadow animate-card-in delay-500">
            <h3 className="text-[10px] font-semibold text-[#cdd6f4] uppercase tracking-wider mb-3">Formula</h3>
            <div className="font-mono text-xs leading-6 overflow-x-auto custom-scrollbar">
              <p><span className="text-[#89b4fa]">Total Salary</span> <span className="text-[#f38ba8]">=</span> <span className="text-[#a6e3a1]">Per Day</span> <span className="text-[#f38ba8]">×</span> <span className="text-[#fab387]">Payable Days</span></p>
              <Separator className="bg-[#313244] my-2" />
              <p><span className="text-[#a6e3a1]">₹{salaryData.perDaySalary.toFixed(2)}</span> <span className="text-[#f38ba8]">×</span> <span className="text-[#fab387]">{salaryData.totalPayableDays.toFixed(1)}</span> <span className="text-[#f38ba8]">=</span> <span className="text-[#89b4fa] font-bold">{formatCurrency(salaryData.totalSalary)}</span></p>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-8 text-muted-foreground text-sm">No salary data available</div>
      )}
    </div>
  )
}
