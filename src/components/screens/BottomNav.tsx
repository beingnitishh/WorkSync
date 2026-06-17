'use client'

import React, { useState } from 'react'
import { LayoutDashboard, CalendarDays, BarChart3, Settings, ChevronDown, DollarSign, Calendar, FileText, Sun, TrendingUp } from 'lucide-react'
import { useAppStore, type AppScreen, type NavTab } from '@/lib/store'

export function BottomNav() {
  const { activeTab, setActiveTab, currentScreen } = useAppStore()
  const [reportsOpen, setReportsOpen] = useState(false)

  const navItems: Array<{ tab: NavTab; label: string; icon: React.ReactNode }> = [
    { tab: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { tab: 'calendar', label: 'Calendar', icon: <CalendarDays className="w-5 h-5" /> },
    { tab: 'reports', label: 'Reports', icon: <BarChart3 className="w-5 h-5" /> },
    { tab: 'settings', label: 'Settings', icon: <Settings className="w-5 h-5" /> },
  ]

  const reportItems = [
    { screen: 'salary' as AppScreen, label: 'Salary', icon: <DollarSign className="w-4 h-4" /> },
    { screen: 'date-range' as AppScreen, label: 'Date Range', icon: <Calendar className="w-4 h-4" /> },
    { screen: 'monthly-report' as AppScreen, label: 'Monthly', icon: <FileText className="w-4 h-4" /> },
    { screen: 'sunday-tracker' as AppScreen, label: 'Sunday', icon: <Sun className="w-4 h-4" /> },
    { screen: 'analytics' as AppScreen, label: 'Analytics', icon: <TrendingUp className="w-4 h-4" /> },
  ]

  const reportScreens: AppScreen[] = ['salary', 'date-range', 'monthly-report', 'sunday-tracker', 'analytics']

  const handleTab = (tab: NavTab) => {
    if (tab === 'reports') { setReportsOpen(!reportsOpen); return }
    setReportsOpen(false)
    setActiveTab(tab)
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      {reportsOpen && (
        <div className="absolute bottom-[calc(4rem+env(safe-area-inset-bottom))] left-0 right-0 bg-card rounded-t-2xl signature-shadow border-t border-border px-4 sm:px-5 py-4 animate-fade-in-down">
          <div className="reports-menu-grid">
            {reportItems.map((item) => (
              <button key={item.screen} onClick={() => { useAppStore.getState().setCurrentScreen(item.screen); setReportsOpen(false) }} className="flex flex-col items-center gap-1.5 py-2 btn-press">
                <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center text-muted-foreground">{item.icon}</div>
                <span className="text-[9px] font-medium text-muted-foreground">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bg-card border-t border-border px-1.5 sm:px-2 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
          {navItems.map((item) => {
            const isActive = activeTab === item.tab || (item.tab === 'reports' && reportScreens.includes(currentScreen))
            return (
              <button
                key={item.tab}
                onClick={() => handleTab(item.tab)}
                className={`nav-item ${isActive ? 'nav-item-active' : ''}`}
              >
                {item.tab === 'reports' && reportsOpen ? <ChevronDown className={`w-5 h-5 ${isActive ? 'text-white' : ''}`} /> : item.icon}
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
