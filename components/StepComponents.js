'use client'
import { useRouter } from 'next/navigation'
import { Check, Lock, ArrowRight } from 'lucide-react'

const STEPS = [
  { key: 'audit',      label: 'Audit',       href: '/audit' },
  { key: 'competitor', label: 'Competitors',  href: '/competitors' },
  { key: 'strategy',   label: 'Strategy',     href: '/strategy' },
  { key: 'creative',   label: 'Creative',     href: '/creative' },
  { key: 'reports',    label: 'Report',       href: '/reports' },
]

const NEXT = {
  audit:      { label: 'Competitor intel', href: '/competitors' },
  competitor: { label: 'Strategy',         href: '/strategy' },
  strategy:   { label: 'Ad creative',      href: '/creative' },
  creative:   { label: 'Reports',          href: '/reports' },
}

export function StepTracker({ current, progress = {}, clientId }) {
  const router = useRouter()

  return (
    <div className="flex items-center gap-0 mb-6 px-6 pt-5">
      {STEPS.map((step, i) => {
        const done = progress[step.key]
        const active = step.key === current
        const locked = !done && !active && i > 0 && !progress[STEPS[i-1]?.key]

        return (
          <div key={step.key} className="flex items-center">
            <div
              className={`flex items-center gap-2 cursor-pointer ${locked ? 'opacity-30 cursor-not-allowed' : ''}`}
              onClick={() => !locked && clientId && router.push(`${step.href}?client=${clientId}`)}
            >
              <div className={`step-num ${done ? 'done' : active ? 'active' : 'pending'}`}>
                {done ? <Check size={10}/> : <span>{i + 1}</span>}
              </div>
              <span className={`text-xs font-medium hidden sm:block ${
                done ? 'text-status-green' : active ? 'text-brand-gold' : 'text-text-dim'
              }`}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-8 h-px mx-2 ${done ? 'bg-status-green/40' : 'bg-surface-border'}`}/>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function NextBar({ current, clientId, label }) {
  const router = useRouter()
  const next = NEXT[current]
  if (!next || !clientId) return null

  return (
    <div className="next-bar">
      <div>
        <p className="text-sm font-medium text-text-primary">
          {label || `${current.charAt(0).toUpperCase() + current.slice(1)} complete`}
        </p>
        <p className="text-xs text-text-dim mt-0.5">Next step: {next.label}</p>
      </div>
      <button
        className="btn-primary"
        onClick={() => router.push(`${next.href}?client=${clientId}`)}
      >
        Next: {next.label} <ArrowRight size={13}/>
      </button>
    </div>
  )
}

export function ThinkingBar({ message }) {
  return (
    <div className="thinking-bar mb-4">
      <div className="flex gap-1">
        <div className="thinking-dot"/>
        <div className="thinking-dot"/>
        <div className="thinking-dot"/>
      </div>
      <span className="text-xs text-text-secondary">
        {message || 'AI is thinking...'}
      </span>
    </div>
  )
}

export function LockedState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-12 h-12 rounded-full bg-surface-secondary border border-surface-border flex items-center justify-center mb-4">
        <Lock size={20} className="text-text-dim"/>
      </div>
      <p className="text-sm font-medium text-text-secondary mb-1">Step locked</p>
      <p className="text-xs text-text-dim max-w-xs">{message || 'Complete the previous step first to unlock this agent.'}</p>
    </div>
  )
}
