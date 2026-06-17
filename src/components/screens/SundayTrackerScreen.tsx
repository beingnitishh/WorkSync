'use client'

import React, { useEffect, useState, useCallback, useMemo } from 'react'
import {
  ChevronLeft, Sun, Edit3, Save, RotateCcw, Loader2,
  CheckCircle2, Pencil, CalendarDays, TrendingUp
} from 'lucide-react'
import { useAppStore, type AttendanceStatus } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MONTH_NAMES, statusConfig } from './shared'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// ─── Helpers ─────────────────────────────────────────────────────
function getStatusColor(status: string): string {
  switch (status) {
    case 'HALF_DAY': return '#f59e0b'
    case 'OFF': return '#94a3b8'
    case 'FULL_DAY': return '#10b981'
    case 'ABSENT': return '#ef4444'
    default: return '#94a3b8'
  }
}

function getStatusPillStyle(status: string): { bg: string; text: string } {
  switch (status) {
    case 'HALF_DAY': return { bg: 'bg-amber-100', text: 'text-amber-700' }
    case 'OFF': return { bg: 'bg-slate-100', text: 'text-slate-600' }
    case 'FULL_DAY': return { bg: 'bg-emerald-100', text: 'text-emerald-700' }
    case 'ABSENT': return { bg: 'bg-red-100', text: 'text-red-700' }
    default: return { bg: 'bg-slate-100', text: 'text-slate-600' }
  }
}

/** Calculate the next N Sundays starting from the first Sunday of the given month */
function getNextNSundays(month: number, year: number, count: number): Array<{ date: string; day: number; label: string }> {
  const sundays: Array<{ date: string; day: number; label: string }> = []
  const start = new Date(year, month - 1, 1)
  // Move to first Sunday of the month
  while (start.getDay() !== 0) start.setDate(start.getDate() + 1)

  const current = new Date(start)
  while (sundays.length < count) {
    const y = current.getFullYear()
    const m = String(current.getMonth() + 1).padStart(2, '0')
    const d = String(current.getDate()).padStart(2, '0')
    const dateStr = `${y}-${m}-${d}`
    const dayNum = current.getDate()
    const label = current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    sundays.push({ date: dateStr, day: dayNum, label })
    current.setDate(current.getDate() + 7)
  }
  return sundays
}

/** Determine the expected auto status for a sunday index given the pattern */
function getAutoStatus(index: number, pattern: 'HALF_DAY' | 'FULL_OFF'): AttendanceStatus {
  if (pattern === 'HALF_DAY') {
    return index % 2 === 0 ? 'HALF_DAY' : 'OFF'
  } else {
    return index % 2 === 0 ? 'OFF' : 'HALF_DAY'
  }
}

export function SundayTrackerScreen() {
  const { employee, selectedMonth, selectedYear, showToast, fetchMonthData } = useAppStore()
  const [sundays, setSundays] = useState<Array<{
    date: string
    defaultStatus: string
    actualStatus: string
    payableValue: number
    isManualOverride: boolean
    hasRecord: boolean
  }>>([])
  const [loading, setLoading] = useState(true)
  const [resetting, setResetting] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editDate, setEditDate] = useState<string | null>(null)
  const [editStatus, setEditStatus] = useState<AttendanceStatus>('HALF_DAY')

  const loadSundays = useCallback(async () => {
    if (!employee) return
    try {
      const res = await fetch(`/api/sunday?month=${selectedMonth}&year=${selectedYear}&employeeId=${employee.id}`)
      if (res.ok) {
        const data = await res.json()
        setSundays(data.sundays || [])
      }
    } catch { /* silent */ }
    setLoading(false)
  }, [employee, selectedMonth, selectedYear])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!employee) return
      try {
        const res = await fetch(`/api/sunday?month=${selectedMonth}&year=${selectedYear}&employeeId=${employee.id}`)
        if (res.ok && !cancelled) {
          const data = await res.json()
          setSundays(data.sundays || [])
        }
      } catch { /* silent */ }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [employee, selectedMonth, selectedYear])

  const handleOverride = async (date: string, status: AttendanceStatus) => {
    if (!employee) return
    try {
      const res = await fetch('/api/sunday', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: employee.id, date, status }),
      })
      if (res.ok) {
        showToast('Sunday override saved', 'success')
        await loadSundays()
        await fetchMonthData(true)
        setDialogOpen(false)
        setEditDate(null)
      }
    } catch {
      showToast('Failed to override', 'error')
    }
  }

  const handleReset = async () => {
    if (!employee) return
    setResetting(true)
    try {
      const res = await fetch(`/api/sunday?employeeId=${employee.id}&month=${selectedMonth}&year=${selectedYear}`, { method: 'DELETE' })
      if (res.ok) {
        showToast('Sunday overrides reset', 'success')
        await loadSundays()
        await fetchMonthData(true)
      }
    } catch {
      showToast('Failed to reset', 'error')
    }
    setResetting(false)
  }

  const openEditDialog = (date: string, currentStatus: string) => {
    setEditDate(date)
    setEditStatus(currentStatus as AttendanceStatus)
    setDialogOpen(true)
  }

  const patternLabel = employee?.firstSundayPattern === 'HALF_DAY' ? 'Half Day First' : 'Full Off First'

  // Summary stats
  const stats = useMemo(() => {
    const total = sundays.length
    const halfDay = sundays.filter(s => s.actualStatus === 'HALF_DAY').length
    const fullOff = sundays.filter(s => s.actualStatus === 'OFF').length
    const manual = sundays.filter(s => s.isManualOverride).length
    return { total, halfDay, fullOff, manual }
  }, [sundays])

  // Next 8 sundays for pattern preview
  const nextSundays = useMemo(() => {
    return getNextNSundays(selectedMonth, selectedYear, 8)
  }, [selectedMonth, selectedYear])

  return (
    <div className="screen-container screen-container-medium">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1 animate-card-in">
        <button
          onClick={() => useAppStore.getState().setCurrentScreen('calendar')}
          className="w-8 h-8 rounded-lg hover:bg-card flex items-center justify-center btn-press"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h1 className="text-xl font-bold text-foreground">Sunday Tracker</h1>
      </div>
      <p className="text-muted-foreground text-sm mb-5 ml-10 animate-card-in delay-100">
        {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
      </p>

      {/* Visual Timeline Strip */}
      <div className="glass-card rounded-2xl p-4 mb-5 animate-card-in delay-200">
        <p className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
          <CalendarDays className="w-3.5 h-3.5 text-primary" /> Sunday Timeline
        </p>
        <div className="flex items-center justify-center gap-3 overflow-x-auto pb-1 custom-scrollbar">
          {sundays.map((s) => {
            const d = new Date(s.date + 'T00:00:00')
            const color = getStatusColor(s.actualStatus)
            const isOverride = s.isManualOverride
            return (
              <div key={s.date} className="flex flex-col items-center gap-1 min-w-[40px]">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm transition-transform"
                  style={{ backgroundColor: color }}
                >
                  {d.getDate()}
                </div>
                {isOverride && <Pencil className="w-2.5 h-2.5 text-amber-500" />}
              </div>
            )
          })}
        </div>
        {sundays.length === 0 && !loading && (
          <p className="text-center text-xs text-muted-foreground py-2">No Sundays this month</p>
        )}
      </div>

      {/* Summary Stats */}
      {!loading && sundays.length > 0 && (
        <div className="responsive-grid-4 mb-5 animate-card-in delay-300">
          <div className="glass-card rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-foreground animate-count">{stats.total}</p>
            <p className="text-[9px] text-muted-foreground font-medium">Total</p>
          </div>
          <div className="glass-card rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-amber-600 animate-count">{stats.halfDay}</p>
            <p className="text-[9px] text-muted-foreground font-medium">Half Day</p>
          </div>
          <div className="glass-card rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-slate-500 animate-count">{stats.fullOff}</p>
            <p className="text-[9px] text-muted-foreground font-medium">Full Off</p>
          </div>
          <div className="glass-card rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-orange-500 animate-count">{stats.manual}</p>
            <p className="text-[9px] text-muted-foreground font-medium">Manual</p>
          </div>
        </div>
      )}

      {/* Pattern Preview */}
      <div className="glass-card rounded-2xl p-4 mb-5 animate-card-in delay-400">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <p className="text-xs font-semibold text-foreground flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-primary" /> Pattern Preview
          </p>
          <p className="text-[10px] text-muted-foreground">{patternLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {nextSundays.map((s, i) => {
            const autoStatus = getAutoStatus(i, employee?.firstSundayPattern ?? 'HALF_DAY')
            const pill = getStatusPillStyle(autoStatus)
            return (
              <div
                key={s.date}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium ${pill.bg} ${pill.text}`}
              >
                <span className="font-semibold">{s.label}</span>
                <span className="opacity-70">•</span>
                <span>{autoStatus === 'HALF_DAY' ? '½ Day' : 'Off'}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Current Pattern Card */}
      <div className="glass-card rounded-2xl p-4 mb-5 animate-card-in delay-500">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Current Pattern</p>
            <p className="text-sm font-semibold text-foreground">{patternLabel}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#dbeafe] flex items-center justify-center">
            <Sun className="w-5 h-5 text-primary" />
          </div>
        </div>
      </div>

      {/* Sunday Cards */}
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : sundays.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">No Sundays in this month</div>
      ) : (
        <div className="space-y-3">
          {sundays.map((s, idx) => {
            const d = new Date(s.date + 'T00:00:00')
            const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })
            const cfg = statusConfig[s.actualStatus as AttendanceStatus]
            const isOverridden = s.isManualOverride
            const delayClass = `delay-${Math.min(idx + 1, 8) * 100}`

            return (
              <div
                key={s.date}
                className={`glass-card rounded-2xl p-4 btn-press animate-card-in ${delayClass}`}
              >
                <div className="flex items-center gap-3">
                  {/* Date circle */}
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm"
                    style={{ backgroundColor: cfg.bg }}
                  >
                    <span className="text-base font-bold" style={{ color: cfg.textColor }}>
                      {d.getDate()}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{dayLabel}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <Badge
                        className="text-[10px] px-2.5 py-0 h-5 rounded-md border-0 font-medium"
                        style={{ backgroundColor: cfg.bg, color: cfg.textColor }}
                      >
                        <span className="mr-1 inline-flex">{cfg.icon}</span>
                        {cfg.label}
                      </Badge>
                      {isOverridden ? (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-medium bg-amber-100 text-amber-700">
                          <Pencil className="w-2.5 h-2.5" /> Manual
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-medium bg-emerald-100 text-emerald-700">
                          <CheckCircle2 className="w-2.5 h-2.5" /> Auto
                        </span>
                      )}
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openEditDialog(s.date, s.actualStatus)}
                    className="h-9 w-9 p-0 text-muted-foreground btn-press rounded-lg hover:bg-muted"
                  >
                    <Edit3 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Reset Button */}
      <Button
        onClick={handleReset}
        disabled={resetting}
        variant="outline"
        className="w-full mt-5 rounded-[14px] border-border text-red-500 hover:text-red-600 hover:bg-red-50 h-11 text-xs font-medium btn-press animate-card-in delay-800"
      >
        <RotateCcw className="w-4 h-4 mr-2" />
        {resetting ? 'Resetting...' : 'Reset Auto Rule'}
      </Button>

      {/* Edit Sunday Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditDate(null) }}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sun className="w-5 h-5 text-primary" /> Edit Sunday
            </DialogTitle>
            <DialogDescription>
              {editDate && new Date(editDate + 'T00:00:00').toLocaleDateString('en-US', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
              })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <p className="text-xs font-medium text-muted-foreground mb-2">Select attendance status:</p>
            <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-2">
              {(['HALF_DAY', 'OFF', 'FULL_DAY', 'ABSENT'] as AttendanceStatus[]).map((st) => {
                const sc = statusConfig[st]
                const isSelected = editStatus === st
                return (
                  <button
                    key={st}
                    onClick={() => setEditStatus(st)}
                    className="flex items-center gap-2 p-3 rounded-xl text-xs font-medium transition-all border-2 btn-press"
                    style={{
                      borderColor: isSelected ? sc.color : '#e1e2ed',
                      backgroundColor: isSelected ? sc.bg : 'white',
                      color: isSelected ? sc.textColor : '#434655',
                    }}
                  >
                    {sc.icon}
                    <span>{sc.label}</span>
                  </button>
                )
              })}
            </div>

            {editStatus && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg mt-2" style={{ backgroundColor: statusConfig[editStatus].bg }}>
                <span style={{ color: statusConfig[editStatus].textColor }} className="text-[10px] font-medium">
                  {editStatus === 'ABSENT'
                    ? 'Absent: No pay for this day (salary deducted)'
                    : 'This counts as a full payable day (paid)'}
                </span>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => { setDialogOpen(false); setEditDate(null) }}
              className="rounded-xl btn-press"
            >
              Cancel
            </Button>
            <Button
              onClick={() => { if (editDate) handleOverride(editDate, editStatus) }}
              className="bg-primary hover:bg-primary/90 text-white rounded-xl btn-press"
            >
              <Save className="w-4 h-4 mr-1" /> Save Override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
