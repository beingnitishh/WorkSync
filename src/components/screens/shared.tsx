import React from 'react'
import { CheckCircle2, XCircle, MinusCircle, Coffee } from 'lucide-react'
import type { AttendanceStatus } from '@/lib/store'

// ─── Constants ────────────────────────────────────────────────────
export const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
export const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

// ─── Helper Functions ─────────────────────────────────────────────
export function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

export function getMonthRange(month: number, year: number) {
  const from = `${year}-${String(month).padStart(2,'0')}-01`
  const daysInMonth = new Date(year, month, 0).getDate()
  const to = `${year}-${String(month).padStart(2,'0')}-${String(daysInMonth).padStart(2,'0')}`
  return { from, to }
}

export function isDateSunday(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.getDay() === 0
}

export function formatDateDisplay(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

// ─── Status Config ────────────────────────────────────────────────
export const statusConfig: Record<AttendanceStatus, { label: string; color: string; bg: string; textColor: string; icon: React.ReactNode }> = {
  FULL_DAY: { label: 'Full Day', color: '#10b981', bg: '#d1fae5', textColor: '#065f46', icon: <CheckCircle2 className="w-4 h-4" /> },
  HALF_DAY: { label: 'Half Day', color: '#f59e0b', bg: '#fef3c7', textColor: '#92400e', icon: <MinusCircle className="w-4 h-4" /> },
  ABSENT:   { label: 'Absent',   color: '#ef4444', bg: '#fee2e2', textColor: '#991b1b', icon: <XCircle className="w-4 h-4" /> },
  OFF:      { label: 'Off',      color: '#94a3b8', bg: '#f1f5f9', textColor: '#64748b', icon: <Coffee className="w-4 h-4" /> },
}

// ─── Donut Chart Component ────────────────────────────────────────
export interface DonutSegment {
  value: number
  color: string
  label: string
}

export function DonutChart({ segments, centerLabel, centerValue, size = 'md' }: {
  segments: DonutSegment[]
  centerLabel?: string
  centerValue?: string | number
  size?: 'sm' | 'md' | 'lg'
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0)
  const cumulativeValues = segments.reduce<number[]>((acc, s, i) => {
    const prev = i === 0 ? 0 : acc[i - 1]
    acc.push(prev + (total > 0 ? (s.value / total) * 100 : 0))
    return acc
  }, [])
  const gradientStops = segments.map((s, i) => {
    const start = i === 0 ? 0 : cumulativeValues[i - 1]
    const end = cumulativeValues[i]
    return `${s.color} ${start}% ${end}%`
  })

  const sizeClasses = {
    sm: 'w-24 h-24',
    md: 'w-32 h-32',
    lg: 'w-40 h-40',
  }
  const insetClasses = {
    sm: 'inset-2',
    md: 'inset-3',
    lg: 'inset-4',
  }
  const valueSize = {
    sm: 'text-sm font-bold',
    md: 'text-lg font-bold',
    lg: 'text-xl font-bold',
  }
  const labelSize = {
    sm: 'text-[8px]',
    md: 'text-[9px]',
    lg: 'text-[10px]',
  }

  return (
    <div className={`relative ${sizeClasses[size]} mx-auto`}>
      <div
        className="w-full h-full rounded-full"
        style={{ background: `conic-gradient(${gradientStops.join(', ')})` }}
      />
      <div className={`absolute ${insetClasses[size]} bg-card rounded-full flex items-center justify-center`}>
        <div className="text-center">
          {centerValue !== undefined && <p className={`${valueSize[size]} text-foreground`}>{centerValue}</p>}
          {centerLabel && <p className={`${labelSize[size]} text-muted-foreground`}>{centerLabel}</p>}
        </div>
      </div>
    </div>
  )
}

// ─── Donut Chart Legend ───────────────────────────────────────────
export function DonutLegend({ segments }: { segments: DonutSegment[] }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0)
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
      {segments.map((s) => (
        <div key={s.label} className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
          <span className="text-[10px] text-muted-foreground">{s.label} {total > 0 ? Math.round((s.value / total) * 100) : 0}%</span>
        </div>
      ))}
    </div>
  )
}
