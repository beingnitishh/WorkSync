'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { AlertCircle, Loader2, User, Calendar, DollarSign, Clock, Briefcase, Sun, Moon, Calculator, Check } from 'lucide-react'
import { useAppStore, type SundayPattern, type SalaryMethod } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

const STEPS = [
  { id: 1, label: 'Personal', icon: User },
  { id: 2, label: 'Work Pattern', icon: Calendar },
  { id: 3, label: 'Salary Rules', icon: Calculator },
] as const

const sundayOptions: { value: SundayPattern; label: string; desc: string; icon: React.ElementType; color: string; bgFrom: string; bgTo: string }[] = [
  {
    value: 'HALF_DAY',
    label: 'Half Day First',
    desc: '1st Sunday = Half Day, 2nd = Off, 3rd = Half Day, 4th = Off...',
    icon: Sun,
    color: '#f59e0b',
    bgFrom: '#fef3c7',
    bgTo: '#fde68a',
  },
  {
    value: 'FULL_OFF',
    label: 'Full Off First',
    desc: '1st Sunday = Off, 2nd = Half Day, 3rd = Off, 4th = Half Day...',
    icon: Moon,
    color: '#2563eb',
    bgFrom: '#dbeafe',
    bgTo: '#bfdbfe',
  },
]

const salaryOptions: { value: SalaryMethod; label: string; desc: string; formula: string; icon: React.ElementType; color: string; bgFrom: string; bgTo: string }[] = [
  {
    value: 'CALENDAR_DAYS',
    label: 'Calendar Days',
    desc: 'Most common method. Adapts to month length.',
    formula: 'Salary ÷ Total days in month',
    icon: Calendar,
    color: '#10b981',
    bgFrom: '#d1fae5',
    bgTo: '#a7f3d0',
  },
  {
    value: 'FIXED_30_DAYS',
    label: 'Fixed 30 Days',
    desc: 'Consistent per-day rate every month.',
    formula: 'Salary ÷ 30',
    icon: Calculator,
    color: '#2563eb',
    bgFrom: '#dbeafe',
    bgTo: '#bfdbfe',
  },
  {
    value: 'WORKING_DAYS',
    label: 'Working Days',
    desc: 'Based on calendar days (all days paid except absent).',
    formula: 'Salary ÷ Total calendar days',
    icon: Briefcase,
    color: '#f59e0b',
    bgFrom: '#fef3c7',
    bgTo: '#fde68a',
  },
]

function formatFriendlyDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

function formatSalaryPreview(val: string): string {
  if (!val || Number(val) <= 0) return ''
  const num = Number(val)
  return `₹${new Intl.NumberFormat('en-IN').format(num)}/month`
}

export function ProfileSetupScreen() {
  const { setCurrentScreen, fetchProfile, showToast, employee } = useAppStore()
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [monthlySalary, setMonthlySalary] = useState('')
  const [sundayPattern, setSundayPattern] = useState<SundayPattern>('HALF_DAY')
  const [salaryMethod, setSalaryMethod] = useState<SalaryMethod>('CALENDAR_DAYS')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [shakingField, setShakingField] = useState<string | null>(null)

  // Pre-fill form with existing employee data if available
  useEffect(() => {
    if (employee) {
      setName(employee.name || '')
      setStartDate(employee.startDate || '')
      setMonthlySalary(employee.monthlySalary?.toString() || '')
      setSundayPattern(employee.firstSundayPattern || 'HALF_DAY')
      setSalaryMethod(employee.salaryCalculationMethod || 'CALENDAR_DAYS')
    }
  }, [employee])

  // Determine current step based on filled data
  const currentStep = (() => {
    if (!name.trim() || !startDate) return 1
    if (!monthlySalary || Number(monthlySalary) <= 0) return 1
    return 3
  })()

  const triggerShake = useCallback((field: string) => {
    setShakingField(field)
    setTimeout(() => setShakingField(null), 500)
  }, [])

  const validate = () => {
    const e: Record<string, string> = {}
    if (!name.trim()) {
      e.name = 'Name is required'
      triggerShake('name')
    }
    if (!startDate) {
      e.startDate = 'Start date is required'
      triggerShake('startDate')
    } else {
      const d = new Date(startDate + 'T00:00:00')
      if (isNaN(d.getTime())) {
        e.startDate = 'Invalid date format'
        triggerShake('startDate')
      }
    }
    if (!monthlySalary || Number(monthlySalary) <= 0) {
      e.monthlySalary = 'Salary must be greater than 0'
      triggerShake('monthlySalary')
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      // POST is now idempotent (upsert) - no need to check if profile exists first
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          startDate,
          monthlySalary: Number(monthlySalary),
          firstSundayPattern: sundayPattern,
          salaryCalculationMethod: salaryMethod,
        }),
      })
      if (res.ok) {
        await fetchProfile()
        const data = await res.json().catch(() => ({}))
        const isUpdate = data.updated === true || employee
        showToast(isUpdate ? 'Profile updated successfully!' : 'Profile created successfully!', 'success')
        setShowSuccess(true)
        setTimeout(() => {
          setCurrentScreen('dashboard')
        }, 1200)
      } else {
        const data = await res.json().catch(() => ({ error: 'Failed to save profile' }))
        const errorMsg = data.error || data.errors?.join(', ') || 'Failed to save profile'
        showToast(errorMsg, 'error')
      }
    } catch {
      showToast('Network error', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Close error on input change
  useEffect(() => {
    if (errors.name && name.trim()) setErrors(prev => ({ ...prev, name: '' }))
  }, [name, errors.name])

  useEffect(() => {
    if (errors.startDate && startDate) setErrors(prev => ({ ...prev, startDate: '' }))
  }, [startDate, errors.startDate])

  useEffect(() => {
    if (errors.monthlySalary && monthlySalary && Number(monthlySalary) > 0) setErrors(prev => ({ ...prev, monthlySalary: '' }))
  }, [monthlySalary, errors.monthlySalary])

  if (showSuccess) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <div className="animate-check-circle flex flex-col items-center">
          <div className="w-24 h-24 rounded-2xl overflow-hidden mb-4 signature-shadow">
            <img
              src="/worksync-logo.png"
              alt="WorkSync Logo"
              className="w-full h-full object-cover"
            />
          </div>
          <h2 className="text-xl font-bold text-foreground animate-fade-in-up">Profile Created!</h2>
          <p className="text-muted-foreground text-sm mt-1 animate-fade-in-up delay-200">Welcome to WorkSync</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="screen-container screen-container-medium animate-fade-in-up">
        {/* Step Indicator */}
        <div className="flex items-center mb-8 overflow-x-auto custom-scrollbar pb-1">
          {STEPS.map((step, i) => {
            const StepIcon = step.icon
            const isActive = step.id === currentStep
            const isCompleted = step.id < currentStep
            return (
              <React.Fragment key={step.id}>
                <div className="flex flex-col items-center">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isCompleted ? 'bg-[#10b981]' : isActive ? 'bg-primary' : 'bg-border'
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="w-4 h-4 text-white" />
                    ) : (
                      <StepIcon className="w-4 h-4 text-white" />
                    )}
                  </div>
                  <span className={`text-[10px] mt-1 font-medium ${isActive ? 'text-primary' : isCompleted ? 'text-[#10b981]' : 'text-muted-foreground'}`}>
                    {step.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`step-connector mx-2 mb-4 ${step.id < currentStep ? 'step-connector-active' : ''}`} />
                )}
              </React.Fragment>
            )
          })}
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-foreground mb-1">{employee ? 'Update Profile' : 'Set Up Profile'}</h1>
        <p className="text-muted-foreground text-sm mb-6">{employee ? 'Modify your details below' : 'Enter your details to get started'}</p>

        {/* Section 1: Personal Details */}
        <div className="bg-card rounded-2xl p-6 signature-shadow mb-4 animate-card-in">
          {/* Section Header */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #dbeafe, #bfdbfe)' }}>
              <User className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground text-sm">Personal Details</h2>
              <p className="text-muted-foreground text-xs">Your basic information</p>
            </div>
          </div>

          {/* Name Input */}
          <div className="space-y-1.5 mb-5">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-foreground">Full Name</Label>
              <span className="text-[10px] text-muted-foreground">{name.length}/50</span>
            </div>
            <div className={shakingField === 'name' ? 'animate-shake' : ''}>
              <Input
                value={name}
                onChange={(e) => { const v = e.target.value.slice(0, 50); setName(v); }}
                placeholder="Enter your name"
                className={`rounded-xl h-11 ${errors.name ? 'border-red-400 focus:border-red-500' : 'border-border focus:border-primary'}`}
              />
            </div>
            {errors.name && (
              <p className="text-xs text-red-500 flex items-center gap-1 animate-error-in">
                <AlertCircle className="w-3 h-3" />{errors.name}
              </p>
            )}
          </div>

          {/* Start Date Input */}
          <div className="space-y-1.5 mb-5">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-foreground">Start Date</Label>
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <div className={shakingField === 'startDate' ? 'animate-shake' : ''}>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={`rounded-xl h-11 ${errors.startDate ? 'border-red-400 focus:border-red-500' : 'border-border focus:border-primary'}`}
              />
            </div>
            {startDate && !errors.startDate && (
              <p className="text-xs text-[#10b981] flex items-center gap-1 animate-error-in">
                <Calendar className="w-3 h-3" />{formatFriendlyDate(startDate)}
              </p>
            )}
            {errors.startDate && (
              <p className="text-xs text-red-500 flex items-center gap-1 animate-error-in">
                <AlertCircle className="w-3 h-3" />{errors.startDate}
              </p>
            )}
          </div>

          {/* Salary Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-foreground">Monthly Salary (₹)</Label>
              <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <div className={shakingField === 'monthlySalary' ? 'animate-shake' : ''}>
              <Input
                type="number"
                value={monthlySalary}
                onChange={(e) => setMonthlySalary(e.target.value)}
                placeholder="e.g. 50000"
                className={`rounded-xl h-11 ${errors.monthlySalary ? 'border-red-400 focus:border-red-500' : 'border-border focus:border-primary'}`}
              />
            </div>
            {monthlySalary && Number(monthlySalary) > 0 && !errors.monthlySalary && (
              <p className="text-xs text-[#10b981] flex items-center gap-1 animate-error-in">
                <DollarSign className="w-3 h-3" />{formatSalaryPreview(monthlySalary)}
              </p>
            )}
            {errors.monthlySalary && (
              <p className="text-xs text-red-500 flex items-center gap-1 animate-error-in">
                <AlertCircle className="w-3 h-3" />{errors.monthlySalary}
              </p>
            )}
          </div>
        </div>

        {/* Section 2: Work Pattern */}
        <div className="bg-card rounded-2xl p-6 signature-shadow mb-4 animate-card-in delay-200">
          {/* Section Header */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #fef3c7, #fde68a)' }}>
              <Calendar className="w-5 h-5 text-[#f59e0b]" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground text-sm">Work Pattern</h2>
              <p className="text-muted-foreground text-xs">How do your Sundays work?</p>
            </div>
          </div>

          <RadioGroup value={sundayPattern} onValueChange={(v) => setSundayPattern(v as SundayPattern)} className="space-y-3">
            {sundayOptions.map((opt) => {
              const OptIcon = opt.icon
              const isSelected = sundayPattern === opt.value
              return (
                <label
                  key={opt.value}
                  className={`radio-card-accent btn-press flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-l-4 bg-card shadow-sm'
                      : 'border-border bg-card hover:border-border'
                  }`}
                  style={isSelected ? { borderLeftColor: opt.color } : undefined}
                >
                  <RadioGroupItem value={opt.value} className="mt-1" />
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `linear-gradient(135deg, ${opt.bgFrom}, ${opt.bgTo})` }}
                  >
                    <OptIcon className="w-5 h-5" style={{ color: opt.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-foreground">{opt.label}</span>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{opt.desc}</p>
                  </div>
                </label>
              )
            })}
          </RadioGroup>
        </div>

        {/* Section 3: Salary Rules */}
        <div className="bg-card rounded-2xl p-6 signature-shadow mb-4 animate-card-in delay-400">
          {/* Section Header */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #d1fae5, #a7f3d0)' }}>
              <Calculator className="w-5 h-5 text-[#10b981]" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground text-sm">Salary Rules</h2>
              <p className="text-muted-foreground text-xs">How should we calculate per-day rate?</p>
            </div>
          </div>

          <RadioGroup value={salaryMethod} onValueChange={(v) => setSalaryMethod(v as SalaryMethod)} className="space-y-3">
            {salaryOptions.map((opt) => {
              const OptIcon = opt.icon
              const isSelected = salaryMethod === opt.value
              return (
                <label
                  key={opt.value}
                  className={`radio-card-accent btn-press flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-l-4 bg-card shadow-sm'
                      : 'border-border bg-card hover:border-border'
                  }`}
                  style={isSelected ? { borderLeftColor: opt.color } : undefined}
                >
                  <RadioGroupItem value={opt.value} className="mt-1" />
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `linear-gradient(135deg, ${opt.bgFrom}, ${opt.bgTo})` }}
                  >
                    <OptIcon className="w-5 h-5" style={{ color: opt.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-foreground">{opt.label}</span>
                    <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                    {isSelected && (
                      <div className="mt-2 px-2.5 py-1.5 bg-muted rounded-lg animate-error-in">
                        <code className="text-[10px] text-primary font-mono break-words">{opt.formula}</code>
                      </div>
                    )}
                  </div>
                </label>
              )
            })}
          </RadioGroup>
        </div>

        {/* Save Button */}
        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full mt-4 gradient-primary hover:opacity-90 text-white rounded-[14px] h-12 text-sm font-semibold shadow-lg btn-press"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : employee ? 'Update Profile' : 'Save & Continue'}
        </Button>
      </div>
    </div>
  )
}
