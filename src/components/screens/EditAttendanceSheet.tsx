'use client'

import React, { useEffect, useState } from 'react'
import { Save, Sun, Loader2, FileText, Info } from 'lucide-react'
import { useAppStore, type AttendanceStatus } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { statusConfig, isDateSunday, formatDateDisplay } from './shared'

/** Payable value for each status — only ABSENT deducts salary */
const payableValues: Record<AttendanceStatus, number> = {
  FULL_DAY: 1.0,
  HALF_DAY: 1.0, // Half day is paid as full day
  ABSENT: 0,      // Only absent deducts salary
  OFF: 1.0,       // Off days are paid
}

export function EditAttendanceSheet() {
  const { editDate, setEditDate, employee, fetchMonthData, showToast } = useAppStore()
  const [selectedStatus, setSelectedStatus] = useState<AttendanceStatus>('FULL_DAY')
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState('')

  // Load note from attendance record (stored in database)
  useEffect(() => {
    if (editDate) {
      const records = useAppStore.getState().attendanceRecords
      const existing = records.find(r => r.date === editDate)
      setSelectedStatus(existing ? (existing.status as AttendanceStatus) : isDateSunday(editDate) ? 'HALF_DAY' : 'FULL_DAY')
      // Load note from database record
      if (existing?.note) {
        setNote(existing.note)
      } else {
        setNote(isDateSunday(editDate) ? 'Sunday — alternate pattern applied' : '')
      }
    }
  }, [editDate])

  const handleSave = async () => {
    if (!employee || !editDate) return
    setSaving(true)
    try {
      const res = await fetch(`/api/attendance/${editDate}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: employee.id, status: selectedStatus, isManualOverride: true, note }),
      })
      if (res.ok) {
        await fetchMonthData(true)
        showToast('Attendance updated successfully!', 'success')
        setEditDate(null)
      } else {
        const errorData = await res.json().catch(() => ({ error: 'Failed to update' }))
        const errorMsg = errorData.error || errorData.errors?.join(', ') || 'Failed to update attendance'
        showToast(errorMsg, 'error')
      }
    } catch {
      showToast('Network error. Please check your connection.', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!editDate) return null

  const currentCfg = statusConfig[selectedStatus]
  const currentPayable = payableValues[selectedStatus]

  return (
    <Sheet open={!!editDate} onOpenChange={(open) => { if (!open) setEditDate(null) }}>
      <SheetContent side="bottom" className="rounded-t-2xl border-0 px-4 sm:px-5 pb-8 pt-4 max-h-[80vh] overflow-y-auto custom-scrollbar sm:max-w-xl sm:mx-auto">
        <SheetHeader className="p-0 pb-2">
          <SheetTitle className="text-base font-semibold text-foreground">{formatDateDisplay(editDate)}</SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            {isDateSunday(editDate) ? 'Sunday — marked by alternate pattern' : 'Select attendance status for this day'}
          </SheetDescription>
        </SheetHeader>

        {/* Current Status Indicator - Large Badge */}
        <div className="animate-card-in mt-3 mb-4">
          <div
            className="flex flex-wrap items-center justify-center gap-2.5 py-3 px-3 rounded-xl"
            style={{ backgroundColor: currentCfg.bg }}
          >
            <div className="w-5 h-5" style={{ color: currentCfg.textColor }}>{currentCfg.icon}</div>
            <span className="text-base font-bold" style={{ color: currentCfg.textColor }}>{currentCfg.label}</span>
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full ml-1"
              style={{ backgroundColor: currentCfg.color, color: '#ffffff' }}
            >
              {currentPayable === 1.0 ? '1.0' : '0.0'}
            </span>
          </div>
        </div>

        {/* Status Selection Buttons */}
        <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-3 mb-4">
          {(Object.entries(statusConfig) as [AttendanceStatus, typeof statusConfig[AttendanceStatus]][]).map(([status, cfg]) => {
            const isSelected = selectedStatus === status
            const payable = payableValues[status]
            return (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={`btn-press flex flex-col items-start gap-1 p-3.5 rounded-xl border-2 transition-all text-left ${isSelected ? 'shadow-sm' : ''}`}
                style={{
                  borderColor: isSelected ? cfg.color : 'var(--border)',
                  backgroundColor: isSelected ? cfg.bg : 'var(--card)',
                }}
              >
                <div className="flex items-center gap-2 w-full">
                  <div style={{ color: isSelected ? cfg.textColor : 'var(--muted-foreground)' }}>
                    <span className="w-5 h-5 inline-flex">{cfg.icon}</span>
                  </div>
                  <span className="text-sm font-semibold flex-1" style={{ color: isSelected ? cfg.textColor : 'var(--muted-foreground)' }}>
                    {cfg.label}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 ml-7">
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                    style={{
                      backgroundColor: isSelected ? cfg.color : 'var(--border)',
                      color: isSelected ? '#ffffff' : 'var(--muted-foreground)',
                    }}
                  >
                    {payable === 1.0 ? '1.0' : '0.0'}
                  </span>
                  <span className="text-[10px] text-muted-foreground">payable</span>
                </div>
              </button>
            )
          })}
        </div>

        {/* Payable Value Display */}
        <div className="animate-fade-in-down flex items-center gap-2 px-3 py-2.5 rounded-xl bg-muted mb-4">
          <Info className="w-3.5 h-3.5 text-primary flex-shrink-0" />
          <span className="text-xs text-muted-foreground">
            {selectedStatus === 'ABSENT'
              ? 'Absent: No pay for this day (salary deducted)'
              : 'This counts as a full payable day (paid)'}
          </span>
        </div>

        {/* Sunday Note */}
        {isDateSunday(editDate) && (
          <div className="bg-primary/10 rounded-xl px-3 py-2 mb-3 flex items-center gap-2">
            <Sun className="w-3.5 h-3.5 text-primary flex-shrink-0" />
            <span className="text-xs text-primary/80">Sunday — alternate pattern applied by default</span>
          </div>
        )}

        {/* Quick Note Input */}
        <div className="mb-4">
          <div className="flex items-center gap-1.5 mb-1.5">
            <FileText className="w-3.5 h-3.5 text-muted-foreground" />
            <label className="text-xs font-medium text-muted-foreground">Quick Note</label>
          </div>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add an optional note..."
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
          />
        </div>

        {/* Action Buttons */}
        <div className="responsive-actions">
          <Button onClick={() => setEditDate(null)} variant="outline" className="btn-press flex-1 rounded-[14px] border-border h-11 text-sm">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="btn-press flex-1 bg-primary hover:bg-primary/90 text-white rounded-[14px] h-11 text-sm font-semibold">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
            {saving ? '' : 'Save'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
