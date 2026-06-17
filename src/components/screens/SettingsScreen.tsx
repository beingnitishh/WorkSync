'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Settings, Users, Bell, LogOut, Save, Loader2,
  Download, Trash2, AlertTriangle, Sun, Calendar,
  Calculator, Briefcase, Clock, Info, Heart, Moon, PartyPopper
} from 'lucide-react'
import { useAppStore, type SundayPattern, type SalaryMethod } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useTheme } from 'next-themes'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { formatCurrency } from './shared'

// ─── Helper: get initials ─────────────────────────────────────────
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return parts[0]?.[0]?.toUpperCase() ?? '?'
}

// ─── Reminder Times ───────────────────────────────────────────
const REMINDER_TIMES = [
  { value: '08:00', label: '8:00 AM' },
  { value: '08:30', label: '8:30 AM' },
  { value: '09:00', label: '9:00 AM' },
  { value: '09:30', label: '9:30 AM' },
  { value: '10:00', label: '10:00 AM' },
  { value: '10:30', label: '10:30 AM' },
  { value: '11:00', label: '11:00 AM' },
  { value: '11:30', label: '11:30 AM' },
  { value: '12:00', label: '12:00 PM' },
]

// ─── localStorage helpers ──────────────────────────────────────
function getReminderEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem('worksync-reminder-enabled') === 'true'
}

function setReminderEnabled(val: boolean) {
  if (typeof window === 'undefined') return
  localStorage.setItem('worksync-reminder-enabled', String(val))
}

function getReminderTime(): string {
  if (typeof window === 'undefined') return '09:00'
  return localStorage.getItem('worksync-reminder-time') || '09:00'
}

function setReminderTimeToStorage(val: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem('worksync-reminder-time', val)
}

export function SettingsScreen() {
  const { employee, fetchProfile, showToast, setCurrentScreen, setEmployee, setAttendanceRecords } = useAppStore()
  const { theme, setTheme } = useTheme()
  const [name, setName] = useState(employee?.name ?? '')
  const [monthlySalary, setMonthlySalary] = useState(String(employee?.monthlySalary ?? ''))
  const [sundayPattern, setSundayPattern] = useState<SundayPattern>(employee?.firstSundayPattern ?? 'HALF_DAY')
  const [salaryMethod, setSalaryMethod] = useState<SalaryMethod>(employee?.salaryCalculationMethod ?? 'CALENDAR_DAYS')
  const [reminderEnabled, setReminderEnabledState] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('worksync-reminder-enabled') === 'true'
  })
  const [reminderTime, setReminderTimeState] = useState(() => {
    if (typeof window === 'undefined') return '09:00'
    return localStorage.getItem('worksync-reminder-time') || '09:00'
  })
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'default'>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'default'
    return Notification.permission
  })
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [clearing, setClearing] = useState(false)
  const reminderIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const isDark = theme === 'dark'

  const handleSave = async () => {
    if (!employee) return
    setSaving(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          monthlySalary: Number(monthlySalary),
          firstSundayPattern: sundayPattern,
          salaryCalculationMethod: salaryMethod,
        }),
      })
      if (res.ok) {
        await fetchProfile()
        showToast('Settings saved', 'success')
      } else {
        showToast('Failed to save', 'error')
      }
    } catch {
      showToast('Network error', 'error')
    }
    setSaving(false)
  }

  const handleSignOut = () => {
    setEmployee(null)
    setCurrentScreen('onboarding')
    showToast('Signed out', 'info')
  }

  const handleExportAllData = async () => {
    if (!employee) return
    setExporting(true)
    try {
      const res = await fetch('/api/export?fromDate=2020-01-01&toDate=2030-12-31&format=json')
      if (res.ok) {
        const data = await res.json()
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `worksync-export-${new Date().toISOString().split('T')[0]}.json`
        a.click()
        URL.revokeObjectURL(url)
        showToast('Data exported successfully', 'success')
      } else {
        showToast('Failed to export data', 'error')
      }
    } catch {
      showToast('Network error', 'error')
    }
    setExporting(false)
  }

  const handleClearAllData = async () => {
    if (!employee) return
    setClearing(true)
    try {
      const res = await fetch('/api/profile', { method: 'DELETE' })
      if (res.ok) {
        setEmployee(null)
        setAttendanceRecords([])
        setCurrentScreen('onboarding')
        showToast('All data cleared', 'info')
      } else {
        showToast('Failed to clear data', 'error')
      }
    } catch {
      showToast('Network error', 'error')
    }
    setClearing(false)
  }

  // Reminder notification logic
  const scheduleReminder = useCallback((enabled: boolean, time: string) => {
    // Clear existing interval
    if (reminderIntervalRef.current) {
      clearInterval(reminderIntervalRef.current)
      reminderIntervalRef.current = null
    }

    if (!enabled) return

    // Check every minute if it's reminder time
    reminderIntervalRef.current = setInterval(() => {
      const now = new Date()
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

      if (currentTime === time) {
        // Check if today's attendance is already marked
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

        // Check localStorage for today's attendance status
        const lastNotifDate = localStorage.getItem('worksync-last-notif-date')
        if (lastNotifDate === todayStr) return // Already notified today

        // Show notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('WorkSync Reminder 📋', {
            body: "Don't forget to mark your attendance!",
            icon: '/favicon.ico',
          })
          localStorage.setItem('worksync-last-notif-date', todayStr)
        }
      }
    }, 60000) // Check every minute
  }, [])

  // Update reminder when settings change
  useEffect(() => {
    scheduleReminder(reminderEnabled, reminderTime)
    return () => {
      if (reminderIntervalRef.current) {
        clearInterval(reminderIntervalRef.current)
      }
    }
  }, [reminderEnabled, reminderTime, scheduleReminder])

  const handleReminderToggle = async (enabled: boolean) => {
    if (enabled && typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission !== 'granted') {
        const permission = await Notification.requestPermission()
        setNotifPermission(permission)
        if (permission !== 'granted') {
          showToast('Notification permission denied. Please enable it in browser settings.', 'error')
          return
        }
      }
    }
    setReminderEnabledState(enabled)
    setReminderEnabled(enabled)
    showToast(enabled ? 'Daily reminder enabled' : 'Daily reminder disabled', 'info')
  }

  const handleReminderTimeChange = (time: string) => {
    setReminderTimeState(time)
    setReminderTimeToStorage(time)
  }

  const initials = getInitials(employee?.name ?? '')

  return (
    <div className="screen-container screen-container-medium">
      {/* Header */}
      <h1 className="text-xl font-bold text-foreground mb-5 animate-card-in">Settings</h1>

      {/* Profile Avatar + Info Card */}
      <div className="glass-card rounded-2xl p-6 mb-5 animate-card-in delay-100">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center flex-shrink-0 shadow-lg">
            <span className="text-xl font-bold text-white">{initials}</span>
          </div>
          <div className="min-w-0">
            <p className="text-lg font-semibold text-foreground truncate">{employee?.name ?? 'User'}</p>
            <p className="text-xs text-muted-foreground">Since {employee?.startDate ?? '—'}</p>
            {employee?.monthlySalary && (
              <p className="text-xs text-muted-foreground mt-0.5">{formatCurrency(employee.monthlySalary)}/month</p>
            )}
          </div>
        </div>

        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" /> Profile
        </h3>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Full Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl h-10 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Monthly Salary (₹)</Label>
            <Input type="number" value={monthlySalary} onChange={(e) => setMonthlySalary(e.target.value)} className="rounded-xl h-10 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Start Date</Label>
            <Input type="date" value={employee?.startDate ?? ''} disabled className="rounded-xl h-10 text-sm bg-muted" />
          </div>
        </div>
      </div>

      {/* Calculation Rules */}
      <div className="glass-card rounded-2xl p-5 mb-5 animate-card-in delay-200">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Calculator className="w-4 h-4 text-primary" /> Calculation Rules
        </h3>
        <div className="space-y-5">
          {/* Sunday Pattern - Visual Radio Group */}
          <div className="space-y-2.5">
            <Label className="text-xs font-medium text-muted-foreground">Sunday Pattern</Label>
            <RadioGroup value={sundayPattern} onValueChange={(v) => setSundayPattern(v as SundayPattern)}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className="flex items-start gap-3 p-3 rounded-xl border border-border cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-blue-50/50 dark:has-[:checked]:bg-blue-900/20 transition-all btn-press">
                  <RadioGroupItem value="HALF_DAY" className="mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Sun className="w-4 h-4 text-amber-500" />
                      <span className="text-sm font-medium text-foreground">Half Day First</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-tight">1st, 3rd, 5th Sundays are half days</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 p-3 rounded-xl border border-border cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-blue-50/50 dark:has-[:checked]:bg-blue-900/20 transition-all btn-press">
                  <RadioGroupItem value="FULL_OFF" className="mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Sun className="w-4 h-4 text-slate-400" />
                      <span className="text-sm font-medium text-foreground">Full Off First</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-tight">1st, 3rd, 5th Sundays are full off</p>
                  </div>
                </label>
              </div>
            </RadioGroup>
          </div>

          {/* Salary Method - Visual Radio Group */}
          <div className="space-y-2.5">
            <Label className="text-xs font-medium text-muted-foreground">Salary Method</Label>
            <RadioGroup value={salaryMethod} onValueChange={(v) => setSalaryMethod(v as SalaryMethod)}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className="flex items-start gap-3 p-3 rounded-xl border border-border cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-blue-50/50 dark:has-[:checked]:bg-blue-900/20 transition-all btn-press">
                  <RadioGroupItem value="CALENDAR_DAYS" className="mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="w-4 h-4 text-blue-500" />
                      <span className="text-sm font-medium text-foreground">Calendar Days</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-tight">Salary ÷ days in month</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 p-3 rounded-xl border border-border cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-blue-50/50 dark:has-[:checked]:bg-blue-900/20 transition-all btn-press">
                  <RadioGroupItem value="FIXED_30_DAYS" className="mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Briefcase className="w-4 h-4 text-emerald-500" />
                      <span className="text-sm font-medium text-foreground">Fixed 30 Days</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-tight">Salary ÷ 30 always</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 p-3 rounded-xl border border-border cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-blue-50/50 dark:has-[:checked]:bg-blue-900/20 transition-all btn-press sm:col-span-2">
                  <RadioGroupItem value="WORKING_DAYS" className="mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="w-4 h-4 text-violet-500" />
                      <span className="text-sm font-medium text-foreground">Working Days</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-tight">Salary ÷ total calendar days (only absent is unpaid)</p>
                  </div>
                </label>
              </div>
            </RadioGroup>
          </div>
        </div>
      </div>

      {/* Preferences */}
      <div className="glass-card rounded-2xl p-5 mb-5 animate-card-in delay-300">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Settings className="w-4 h-4 text-primary" /> Preferences
        </h3>
        <div className="space-y-4">
          {/* Dark Mode Toggle */}
          <div className="flex flex-col gap-3 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
            <div className="flex items-center gap-3">
              {isDark ? (
                <Moon className="w-4 h-4 text-muted-foreground" />
              ) : (
                <Sun className="w-4 h-4 text-muted-foreground" />
              )}
              <div>
                <p className="text-sm font-medium text-foreground">Dark Mode</p>
                <p className="text-xs text-muted-foreground">{isDark ? 'Dark theme active' : 'Light theme active'}</p>
              </div>
            </div>
            <Switch
              checked={isDark}
              onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
            />
          </div>

          {/* Divider */}
          <div className="h-px bg-border" />

          {/* Daily Attendance Reminder */}
          <div className="flex flex-col gap-3 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
            <div className="flex items-center gap-3">
              <Bell className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">Daily Reminder</p>
                <p className="text-xs text-muted-foreground">
                  {reminderEnabled
                    ? `At ${REMINDER_TIMES.find(t => t.value === reminderTime)?.label || '9:00 AM'}`
                    : 'Attendance reminder off'}
                </p>
              </div>
            </div>
            <Switch checked={reminderEnabled} onCheckedChange={handleReminderToggle} />
          </div>

          {/* Reminder Time Picker */}
          {reminderEnabled && (
            <div className="flex flex-col gap-3 pl-7 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
              <div>
                <p className="text-xs font-medium text-foreground">Reminder Time</p>
                {notifPermission !== 'granted' && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400">Notifications not permitted — enable in browser</p>
                )}
              </div>
              <select
                value={reminderTime}
                onChange={(e) => handleReminderTimeChange(e.target.value)}
                className="rounded-lg border border-border bg-card text-sm text-foreground px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {REMINDER_TIMES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Data Management */}
      <div className="glass-card rounded-2xl p-5 mb-5 animate-card-in delay-400">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Download className="w-4 h-4 text-primary" /> Data
        </h3>
        <Button
          onClick={() => setCurrentScreen('holiday-manager')}
          variant="outline"
          className="w-full rounded-xl h-10 text-sm font-medium border-border btn-press mb-3"
        >
          <PartyPopper className="w-4 h-4 mr-2 text-amber-500" />
          Manage Holidays
        </Button>
        <Button
          onClick={handleExportAllData}
          disabled={exporting}
          variant="outline"
          className="w-full rounded-xl h-10 text-sm font-medium border-border btn-press mb-3"
        >
          {exporting ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Download className="w-4 h-4 mr-2" />
          )}
          {exporting ? 'Exporting...' : 'Export All Data'}
        </Button>
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-blue-50/60 dark:bg-blue-900/20">
          <Info className="w-3.5 h-3.5 text-primary flex-shrink-0" />
          <p className="text-[10px] text-muted-foreground leading-tight">Holidays are auto-marked as OFF in attendance. Export includes all records.</p>
        </div>
      </div>

      {/* Save Button */}
      <Button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-primary hover:bg-primary/90 text-white rounded-[14px] h-11 text-sm font-semibold mb-5 btn-press animate-card-in delay-500"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
        {saving ? '' : 'Save Changes'}
      </Button>

      {/* Danger Zone */}
      <div className="rounded-2xl p-5 mb-5 border-2 border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-950/20 animate-card-in delay-600">
        <h3 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> Danger Zone
        </h3>
        <div className="space-y-3">
          <Button
            onClick={handleSignOut}
            variant="outline"
            className="w-full rounded-[14px] border-red-200 dark:border-red-800 text-red-500 dark:text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 h-10 text-sm font-medium btn-press"
          >
            <LogOut className="w-4 h-4 mr-2" /> Sign Out
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="w-full rounded-[14px] border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 h-10 text-sm font-medium btn-press"
              >
                <Trash2 className="w-4 h-4 mr-2" /> Clear All Data
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-red-600 dark:text-red-400 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" /> Delete All Data?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete your employee profile and all attendance records. This action cannot be undone. You will need to set up your profile again.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleClearAllData}
                  disabled={clearing}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {clearing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" /> Deleting...
                    </>
                  ) : (
                    'Delete Everything'
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* About Section */}
      <div className="glass-card rounded-2xl p-5 mb-2 animate-card-in delay-700">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden shadow-md flex-shrink-0">
            <img
              src="/worksync-logo.png"
              alt="WorkSync Logo"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">WorkSync</p>
            <p className="text-[10px] text-muted-foreground">Office Attendance Tracker</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border">
          <p className="text-[10px] text-muted-foreground">Version 1.0.0</p>
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            Made with <Heart className="w-3 h-3 text-red-400 fill-red-400" /> for office workers
          </p>
        </div>
      </div>
    </div>
  )
}
