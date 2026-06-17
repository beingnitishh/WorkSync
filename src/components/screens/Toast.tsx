'use client'

import React from 'react'
import { CheckCircle2, AlertCircle, Clock, X } from 'lucide-react'
import { useAppStore } from '@/lib/store'

export function Toast() {
  const { toastMessage, toastType, clearToast } = useAppStore()
  if (!toastMessage) return null

  return (
    <div
      className="animate-toast-in fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-[100] max-w-[calc(100vw-2rem)] px-5 py-3 rounded-xl text-white text-sm font-medium shadow-lg flex items-center gap-2"
      style={{ backgroundColor: toastType === 'success' ? '#10b981' : toastType === 'error' ? '#ef4444' : '#2563eb' }}
    >
      {toastType === 'success' ? <CheckCircle2 className="w-4 h-4" /> : toastType === 'error' ? <AlertCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
      {toastMessage}
      <button onClick={clearToast} className="ml-2 hover:opacity-80"><X className="w-3.5 h-3.5" /></button>
    </div>
  )
}
