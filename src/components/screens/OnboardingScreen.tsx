'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, CalendarDays, DollarSign, ArrowRight } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel'

const features = [
  {
    icon: CheckCircle2,
    title: 'Daily Attendance',
    desc: 'Track your daily office attendance with one tap. Mark full days, half days, absences, and offs effortlessly.',
    color: '#10b981',
    gradientFrom: '#d1fae5',
    gradientTo: '#a7f3d0',
  },
  {
    icon: CalendarDays,
    title: 'Alternate Sunday Tracker',
    desc: 'Auto-track alternating Sunday patterns. Set it once and let WorkSync handle the rest.',
    color: '#f59e0b',
    gradientFrom: '#fef3c7',
    gradientTo: '#fde68a',
  },
  {
    icon: DollarSign,
    title: 'Salary Calculation',
    desc: 'Instant salary estimates based on attendance. Choose from 3 calculation methods that suit your needs.',
    color: '#2563eb',
    gradientFrom: '#dbeafe',
    gradientTo: '#bfdbfe',
  },
]

export function OnboardingScreen() {
  const { setCurrentScreen } = useAppStore()
  const [api, setApi] = useState<CarouselApi>()
  const [current, setCurrent] = useState(0)

  const onSelect = useCallback(() => {
    if (!api) return
    setCurrent(api.selectedScrollSnap())
  }, [api])

  useEffect(() => {
    if (!api) return
    api.on('select', onSelect)
    api.on('reInit', onSelect)
    return () => {
      api.off('select', onSelect)
      api.off('reInit', onSelect)
    }
  }, [api, onSelect])

  return (
    <div className="min-h-svh bg-background flex flex-col relative overflow-x-hidden">
      {/* Skip button top-right */}
      <div className="flex justify-end px-4 sm:px-6 pt-6">
        <button
          onClick={() => setCurrentScreen('profile-setup')}
          className="text-sm text-muted-foreground font-medium hover:text-primary transition-colors"
        >
          Skip
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-6">
        {/* Logo and title */}
        <div className="text-center mb-8 animate-fade-in-up">
          <div className="w-20 h-20 rounded-2xl overflow-hidden mx-auto mb-4 signature-shadow animate-pulse-soft">
            <img
              src="/worksync-logo.png"
              alt="WorkSync Logo"
              className="w-full h-full object-cover"
            />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Welcome to WorkSync</h1>
          <p className="text-muted-foreground text-sm">Your smart office attendance companion</p>
        </div>

        {/* Carousel with feature cards */}
        <div className="w-full max-w-sm sm:max-w-md mb-8">
          <Carousel
            setApi={setApi}
            opts={{ align: 'center', loop: false }}
          >
            <CarouselContent className="-ml-0">
              {features.map((f, i) => {
                const Icon = f.icon
                return (
                  <CarouselItem key={f.title} className="pl-0 basis-full">
                    <div
                      className={`glass-card rounded-2xl p-5 sm:p-6 signature-shadow border-l-4 animate-card-in ${i === current ? '' : 'opacity-60 scale-95'} transition-all duration-300`}
                      style={{ borderLeftColor: f.color }}
                    >
                      {/* Larger icon with gradient background */}
                      <div
                        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                        style={{ background: `linear-gradient(135deg, ${f.gradientFrom}, ${f.gradientTo})` }}
                      >
                        <Icon className="w-8 h-8" style={{ color: f.color }} />
                      </div>
                      <h3 className="font-semibold text-foreground text-lg mb-2">{f.title}</h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
                    </div>
                  </CarouselItem>
                )
              })}
            </CarouselContent>
          </Carousel>

          {/* Dot indicators */}
          <div className="flex items-center justify-center gap-2 mt-6">
            {features.map((_, i) => (
              <button
                key={i}
                onClick={() => api?.scrollTo(i)}
                className={`carousel-dot ${i === current ? 'carousel-dot-active' : ''}`}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Enhanced CTA button */}
        <div className="animate-fade-in-up delay-800 w-full max-w-sm">
          <Button
            onClick={() => setCurrentScreen('profile-setup')}
            className="w-full gradient-primary hover:opacity-90 text-white rounded-[14px] py-4 text-base font-semibold h-auto shadow-lg btn-press"
          >
            Get Started <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  )
}
