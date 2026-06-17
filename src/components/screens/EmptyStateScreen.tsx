'use client'

import React, { useState } from 'react'
import { CalendarDays, CheckCircle2, Loader2 } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'

export function EmptyStateScreen() {
  const { employee, generateAttendance, showToast, setCurrentScreen } = useAppStore()
  const [loading, setLoading] = useState(false)

  const handleMark = async () => {
    if (!employee) return
    setLoading(true)
    await generateAttendance()
    showToast('Attendance marked!', 'success')
    setCurrentScreen('dashboard')
    setLoading(false)
  }

  return (
    <div className="screen-container min-h-[60vh] flex flex-col items-center justify-center">
      <div className="text-center animate-fade-in-scale">
        <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4"><CalendarDays className="w-10 h-10 text-muted-foreground" /></div>
        <h2 className="text-lg font-semibold text-foreground mb-1">No attendance added yet</h2>
        <p className="text-sm text-muted-foreground mb-6">Mark today&apos;s attendance to get started</p>
        <Button onClick={handleMark} disabled={loading} className="bg-primary hover:bg-primary/90 text-white rounded-[14px] px-8 h-11 text-sm font-semibold">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />} Mark Today Attendance
        </Button>
      </div>
    </div>
  )
}
