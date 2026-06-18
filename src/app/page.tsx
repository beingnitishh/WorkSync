'use client'

import React, { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { OnboardingScreen } from '@/components/screens/OnboardingScreen'
import { ProfileSetupScreen } from '@/components/screens/ProfileSetupScreen'
import { DashboardScreen } from '@/components/screens/DashboardScreen'
import { CalendarScreen } from '@/components/screens/CalendarScreen'
import { EditAttendanceSheet } from '@/components/screens/EditAttendanceSheet'
import { SundayTrackerScreen } from '@/components/screens/SundayTrackerScreen'
import { SalaryScreen } from '@/components/screens/SalaryScreen'
import { DateRangeReportScreen } from '@/components/screens/DateRangeReportScreen'
import { MonthlyReportScreen } from '@/components/screens/MonthlyReportScreen'
import { AnalyticsScreen } from '@/components/screens/AnalyticsScreen'
import { SettingsScreen } from '@/components/screens/SettingsScreen'
import { HolidayManagerScreen } from '@/components/screens/HolidayManagerScreen'
import { EmptyStateScreen } from '@/components/screens/EmptyStateScreen'
import { Toast } from '@/components/screens/Toast'
import { BottomNav } from '@/components/screens/BottomNav'
import { AuthGate } from '@/components/auth/AuthGate'

export default function WorkSyncPage() {
  return (
    <AuthGate>
      <WorkSyncApp />
    </AuthGate>
  )
}

function WorkSyncApp() {
  const { currentScreen, employee, setCurrentScreen, fetchProfile, setSelectedMonth, setSelectedYear, dateRangeFrom, dateRangeTo, setDateRangeFrom, setDateRangeTo } = useAppStore()
  const [initialized, setInitialized] = useState(false)

  // Hydrate date values on client mount
  useEffect(() => {
    const now = new Date()
    setSelectedMonth(now.getMonth() + 1)
    setSelectedYear(now.getFullYear())
    // Set date range defaults
    if (!dateRangeFrom) {
      const m = String(now.getMonth() + 1).padStart(2, '0')
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
      setDateRangeFrom(`${now.getFullYear()}-${m}-01`)
      setDateRangeTo(`${now.getFullYear()}-${m}-${String(daysInMonth).padStart(2, '0')}`)
    }
  }, [setSelectedMonth, setSelectedYear, dateRangeFrom, setDateRangeFrom, setDateRangeTo])

  useEffect(() => {
    const init = async () => {
      await fetchProfile()
      setInitialized(true)
    }
    init()
  }, [fetchProfile])

  // Once initialized, route based on profile presence
  useEffect(() => {
    if (!initialized) return
    if (!employee && currentScreen !== 'onboarding' && currentScreen !== 'profile-setup') {
      setCurrentScreen('onboarding')
    } else if (employee && (currentScreen === 'onboarding' || currentScreen === 'profile-setup')) {
      setCurrentScreen('dashboard')
    }
  }, [initialized, employee, currentScreen, setCurrentScreen])

  const showNav = !['onboarding', 'profile-setup'].includes(currentScreen)

  const renderScreen = () => {
    switch (currentScreen) {
      case 'onboarding': return <OnboardingScreen />
      case 'profile-setup': return <ProfileSetupScreen />
      case 'dashboard': return employee ? <DashboardScreen /> : <EmptyStateScreen />
      case 'calendar': return <CalendarScreen />
      case 'sunday-tracker': return <SundayTrackerScreen />
      case 'salary': return <SalaryScreen />
      case 'date-range': return <DateRangeReportScreen />
      case 'monthly-report': return <MonthlyReportScreen />
      case 'analytics': return <AnalyticsScreen />
      case 'settings': return <SettingsScreen />
      case 'holiday-manager': return <HolidayManagerScreen />
      case 'empty': return <EmptyStateScreen />
      default: return <DashboardScreen />
    }
  }

  // Lightweight loading indicator while profile is being fetched
  if (!initialized) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
        <img
          src="/worksync-logo.png"
          alt="WorkSync Logo"
          className="w-20 h-20 rounded-2xl object-cover animate-pulse-soft"
        />
        <h1 className="text-2xl font-bold text-foreground mt-4 tracking-tight">WorkSync</h1>
        <p className="text-muted-foreground text-sm mt-1">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <main className={`flex-1 ${showNav ? 'pb-[calc(5rem+env(safe-area-inset-bottom))]' : ''}`}>
        <div className="animate-page-slide-in">
          {renderScreen()}
        </div>
      </main>
      {showNav && <BottomNav />}
      <EditAttendanceSheet />
      <Toast />
    </div>
  )
}
