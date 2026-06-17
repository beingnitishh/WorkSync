'use client'

import React, { useMemo, useState } from 'react'
import { ChevronLeft, ChevronDown, ChevronUp, BarChart3, FileDown, FileText, Calendar, Loader2 } from 'lucide-react'
import { useAppStore, type AttendanceStatus } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency, MONTH_NAMES, statusConfig, DonutChart, DonutLegend, type DonutSegment } from './shared'

export function DateRangeReportScreen() {
  const { dateRangeFrom, dateRangeTo, setDateRangeFrom, setDateRangeTo, dateRangeSalary, employee, showToast } = useAppStore()
  const [loading, setLoading] = useState(false)
  const [expandedMonths, setExpandedMonths] = useState<Set<number>>(new Set())

  const generateReport = async () => {
    if (!dateRangeFrom || !dateRangeTo) { showToast('Please select both dates', 'error'); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/salary?fromDate=${dateRangeFrom}&toDate=${dateRangeTo}`)
      if (res.ok) {
        const data = await res.json()
        useAppStore.getState().setDateRangeSalary(data.salary)
      }
      else showToast('Failed to generate report', 'error')
    } catch { showToast('Network error', 'error') }
    setLoading(false)
  }

  const handleExportCsv = async () => {
    if (!dateRangeFrom || !dateRangeTo) return
    try {
      const res = await fetch(`/api/export?fromDate=${dateRangeFrom}&toDate=${dateRangeTo}&format=csv`)
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = `attendance-report-${dateRangeFrom}-to-${dateRangeTo}.csv`; a.click()
        URL.revokeObjectURL(url)
        showToast('CSV exported', 'success')
      }
    } catch { showToast('Export failed', 'error') }
  }

  const handleExportPdf = () => {
    if (!dateRangeFrom || !dateRangeTo) return
    window.open(`/api/export?fromDate=${dateRangeFrom}&toDate=${dateRangeTo}&format=pdf`, '_blank')
    showToast('PDF report opened in new tab', 'success')
  }

  const toggleMonth = (index: number) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const totalFull = dateRangeSalary?.months?.reduce((sum, m) => sum + m.breakdown.filter(b => b.status === 'FULL_DAY').length, 0) ?? 0
  const totalHalf = dateRangeSalary?.months?.reduce((sum, m) => sum + m.breakdown.filter(b => b.status === 'HALF_DAY').length, 0) ?? 0
  const totalAbsent = dateRangeSalary?.months?.reduce((sum, m) => sum + m.breakdown.filter(b => b.status === 'ABSENT').length, 0) ?? 0
  const totalOff = dateRangeSalary?.months?.reduce((sum, m) => sum + m.breakdown.filter(b => b.status === 'OFF').length, 0) ?? 0
  const totalAll = totalFull + totalHalf + totalAbsent + totalOff

  const summarySegments: DonutSegment[] = useMemo(() => [
    { value: totalFull, color: statusConfig.FULL_DAY.color, label: 'Full Day' },
    { value: totalHalf, color: statusConfig.HALF_DAY.color, label: 'Half Day' },
    { value: totalAbsent, color: statusConfig.ABSENT.color, label: 'Absent' },
    { value: totalOff, color: statusConfig.OFF.color, label: 'Off' },
  ], [totalFull, totalHalf, totalAbsent, totalOff])

  return (
    <div className="screen-container screen-container-wide">
      <div className="flex items-center gap-2 mb-5">
        <button onClick={() => useAppStore.getState().setActiveTab('reports')} className="w-8 h-8 rounded-lg hover:bg-card flex items-center justify-center"><ChevronLeft className="w-4 h-4" /></button>
        <h1 className="text-xl font-bold text-foreground">Date Range Report</h1>
      </div>

      {/* Date Inputs as prominent cards */}
      <div className="bg-card rounded-2xl p-5 signature-shadow mb-5 animate-card-in">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div className="rounded-xl border border-border p-3 bg-muted">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-primary" />
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">From</span>
            </div>
            <Input
              type="date"
              value={dateRangeFrom}
              onChange={(e) => setDateRangeFrom(e.target.value)}
              className="rounded-lg h-9 text-sm border-0 bg-transparent p-0 focus:ring-0 focus:outline-none"
            />
          </div>
          <div className="rounded-xl border border-border p-3 bg-muted">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-primary" />
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">To</span>
            </div>
            <Input
              type="date"
              value={dateRangeTo}
              onChange={(e) => setDateRangeTo(e.target.value)}
              className="rounded-lg h-9 text-sm border-0 bg-transparent p-0 focus:ring-0 focus:outline-none"
            />
          </div>
        </div>
        <Button onClick={generateReport} disabled={loading} className="w-full gradient-salary hover:opacity-90 text-white rounded-[14px] h-11 text-sm font-semibold btn-press">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4 mr-2" />} Generate Report
        </Button>
      </div>

      {dateRangeSalary && (
        <div className="animate-fade-in-up">
          {/* Total Salary Card */}
          <div className="gradient-salary rounded-2xl p-5 signature-shadow mb-5 animate-card-in delay-100">
            <span className="text-cyan-100 text-xs font-medium uppercase tracking-wide">Total Salary</span>
            <p className="text-white text-2xl font-bold mt-1 animate-count">{formatCurrency(dateRangeSalary.totalSalary)}</p>
            <p className="text-cyan-100 text-xs mt-1">{dateRangeSalary.totalPayableDays.toFixed(1)} payable days</p>
          </div>

          {/* Visual Summary with Donut Chart */}
          <div className="bg-card rounded-2xl p-5 signature-shadow mb-5 animate-card-in delay-200">
            <h3 className="text-sm font-semibold text-foreground mb-4">Summary</h3>
            {totalAll > 0 ? (
              <>
                <DonutChart
                  segments={summarySegments}
                  centerValue={dateRangeSalary.totalPayableDays.toFixed(1)}
                  centerLabel="payable"
                  size="md"
                />
                <DonutLegend segments={summarySegments} />
              </>
            ) : (
              <p className="text-center text-sm text-muted-foreground py-4">No data</p>
            )}
          </div>

          {/* Status Count Cards */}
          <div className="responsive-grid-4 mb-5">
            {[
              { label: 'Full Days', value: totalFull, cfg: statusConfig.FULL_DAY },
              { label: 'Half Days', value: totalHalf, cfg: statusConfig.HALF_DAY },
              { label: 'Absent', value: totalAbsent, cfg: statusConfig.ABSENT },
              { label: 'Off Days', value: totalOff, cfg: statusConfig.OFF },
            ].map((item, i) => (
              <div key={item.label} className={`glass-card rounded-2xl p-4 signature-shadow text-center animate-card-in`} style={{ animationDelay: `${0.2 + i * 0.06}s` }}>
                <div className="w-8 h-8 rounded-lg mx-auto mb-2 flex items-center justify-center" style={{ backgroundColor: item.cfg.bg }}>
                  <div style={{ color: item.cfg.textColor }}>{item.cfg.icon}</div>
                </div>
                <p className="text-xl font-bold text-foreground">{item.value}</p>
                <p className="text-[10px] text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>

          {/* Month-by-Month Expandable Cards */}
          {dateRangeSalary.months.map((m, i) => {
            const isExpanded = expandedMonths.has(i)
            const mFull = m.breakdown.filter(b => b.status === 'FULL_DAY').length
            const mHalf = m.breakdown.filter(b => b.status === 'HALF_DAY').length
            const mAbsent = m.breakdown.filter(b => b.status === 'ABSENT').length
            const mOff = m.breakdown.filter(b => b.status === 'OFF').length

            const monthSegments: DonutSegment[] = [
              { value: mFull, color: statusConfig.FULL_DAY.color, label: 'Full' },
              { value: mHalf, color: statusConfig.HALF_DAY.color, label: 'Half' },
              { value: mAbsent, color: statusConfig.ABSENT.color, label: 'Absent' },
              { value: mOff, color: statusConfig.OFF.color, label: 'Off' },
            ]

            return (
              <div key={i} className={`bg-card rounded-2xl signature-shadow mb-3 animate-card-in overflow-hidden`} style={{ animationDelay: `${0.3 + i * 0.06}s` }}>
                <button
                  onClick={() => toggleMonth(i)}
                  className="w-full p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between btn-press"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center">
                      <span className="text-xs font-bold text-primary">{MONTH_NAMES[m.month - 1].slice(0, 3)}</span>
                    </div>
                    <div className="text-left">
                      <span className="text-sm font-medium text-foreground">{MONTH_NAMES[m.month - 1]} {m.year}</span>
                      <p className="text-[10px] text-muted-foreground">{m.totalPayableDays.toFixed(1)} payable · ₹{m.perDaySalary.toFixed(0)}/day</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-primary">{formatCurrency(m.totalSalary)}</span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </button>
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-border">
                    <div className="pt-3 flex justify-center">
                      <DonutChart
                        segments={monthSegments}
                        centerValue={m.totalPayableDays.toFixed(1)}
                        centerLabel="payable"
                        size="sm"
                      />
                    </div>
                    <DonutLegend segments={monthSegments} />
                    <div className="responsive-grid-4 mt-3">
                      {[
                        { label: 'Full', value: mFull, cfg: statusConfig.FULL_DAY },
                        { label: 'Half', value: mHalf, cfg: statusConfig.HALF_DAY },
                        { label: 'Absent', value: mAbsent, cfg: statusConfig.ABSENT },
                        { label: 'Off', value: mOff, cfg: statusConfig.OFF },
                      ].map((s) => (
                        <div key={s.label} className="text-center p-1.5 rounded-lg" style={{ backgroundColor: s.cfg.bg }}>
                          <p className="text-xs font-bold" style={{ color: s.cfg.textColor }}>{s.value}</p>
                          <p className="text-[8px]" style={{ color: s.cfg.textColor }}>{s.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {/* Export Buttons */}
          <div className="responsive-actions mt-4">
            <Button onClick={handleExportCsv} className="flex-1 bg-primary hover:bg-primary/90 text-white rounded-[14px] h-11 text-xs font-medium btn-press">
              <FileDown className="w-4 h-4 mr-2" /> Export CSV
            </Button>
            <Button onClick={handleExportPdf} variant="outline" className="flex-1 border-border rounded-[14px] h-11 text-xs font-medium btn-press">
              <FileText className="w-4 h-4 mr-2" /> Export PDF
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
