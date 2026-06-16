'use client'
import { createBrowserClient } from '@/lib/supabase-browser'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState, Suspense } from 'react'
import {
  LayoutGrid, BarChart2, Eye, Lightbulb, Pencil, FileText, Lock
} from 'lucide-react'

const NAV = [
  { href: '/clients',     label: 'Clients',          icon: LayoutGrid,  agent: null },
  { href: '/audit',       label: 'Audit',            icon: BarChart2,   agent: 'audit' },
  { href: '/competitors', label: 'Competitor Intel',  icon: Eye,         agent: 'competitor' },
  { href: '/strategy',    label: 'Strategy',         icon: Lightbulb,   agent: 'strategy' },
  { href: '/creative',    label: 'Ad Creative',      icon: Pencil,      agent: 'creative' },
  { href: '/reports',     label: 'Reports',          icon: FileText,    agent: 'reports' },
]

function SidebarInner() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const clientId = searchParams.get('client')
  const [client, setClient] = useState(null)
  const [progress, setProgress] = useState({})

  useEffect(() => {
    if (!clientId) { setClient(null); setProgress({}); return }
    const supabase = createBrowserClient()
    supabase.from('clients').select('*').eq('id', clientId).single().then(({ data }) => setClient(data))
    Promise.all([
      supabase.from('audits').select('id').eq('client_id', clientId).limit(1),
      supabase.from('market_audits').select('id').eq('client_id', clientId).limit(1),
      supabase.from('competitor_analyses').select('id').eq('client_id', clientId).limit(1),
      supabase.from('strategies').select('id').eq('client_id', clientId).limit(1),
      supabase.from('client_creatives').select('id').eq('client_id', clientId).limit(1),
    ]).then(([audit, market, comp, strat, creative]) => {
      setProgress({
        audit: (audit.data?.length > 0) || (market.data?.length > 0),
        competitor: comp.data?.length > 0,
        strategy: strat.data?.length > 0,
        creative: creative.data?.length > 0,
        reports: strat.data?.length > 0,
      })
    })
  }, [clientId])

  const stepDone = (agent) => {
    if (!clientId) return false
    return progress[agent] || false
  }

  const isLocked = (agent) => {
    if (!clientId || !agent || agent === 'audit') return false
    const order = ['audit', 'competitor', 'strategy', 'creative', 'reports']
    const idx = order.indexOf(agent)
    if (idx <= 0) return false
    const prevDone = stepDone(order[idx - 1])
    return !prevDone && Object.keys(progress).length > 0
  }

  const dotColor = (agent) => {
    if (!clientId || !agent) return 'bg-surface-border'
    if (stepDone(agent)) return 'bg-status-green'
    if (pathname.includes(agent === 'competitor' ? 'competi' : agent)) return 'bg-brand-gold'
    return 'bg-surface-border-light'
  }

  return (
    <div className="w-56 shrink-0 flex flex-col h-screen sticky top-0" style={{background:'#0d1120',borderRight:'1px solid #1a2035'}}>

      {/* Logo */}
      <div className="px-4 py-5" style={{borderBottom:'1px solid #1a2035'}}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-brand-dark" style={{background:'linear-gradient(135deg,#e8c97e,#c9a84c)'}}>P</div>
          <div>
            <div className="text-sm font-semibold text-text-primary leading-none">PerfHub</div>
            <div className="text-[10px] text-text-secondary mt-0.5 tracking-wide uppercase">AI Performance OS</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">

        {/* Clients */}
        <Link
          href="/clients"
          className={`nav-item ${pathname === '/clients' ? 'active' : ''}`}
        >
          <LayoutGrid size={15} aria-hidden />
          Clients
        </Link>

        <div className="pt-3 pb-1 px-3">
          <span className="text-[9px] font-semibold text-text-muted uppercase tracking-widest">Agents</span>
        </div>

        {NAV.slice(1).map(({ href, label, icon: Icon, agent }) => {
          const locked = isLocked(agent)
          const done = stepDone(agent)
          const active = pathname.includes(href.replace('/', ''))

          return (
            <div key={href}>
              {locked ? (
                <div className="nav-item locked flex items-center justify-between" title="Complete the previous step first">
                  <div className="flex items-center gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-surface-border flex-shrink-0"/>
                    <Icon size={15} aria-hidden className="opacity-30"/>
                    <span className="opacity-30">{label}</span>
                  </div>
                  <Lock size={10} className="opacity-20 flex-shrink-0"/>
                </div>
              ) : (
                <Link
                  href={clientId ? `${href}?client=${clientId}` : href}
                  className={`nav-item ${active ? 'active' : ''}`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor(agent)}`}/>
                  <Icon size={15} aria-hidden/>
                  {label}
                  {done && !active && (
                    <span className="ml-auto w-4 h-4 rounded-full bg-status-green-bg flex items-center justify-center flex-shrink-0">
                      <span className="text-status-green text-[8px] font-bold">✓</span>
                    </span>
                  )}
                </Link>
              )}
            </div>
          )
        })}
      </nav>

      {/* Client badge */}
      {client && (
        <div className="mx-3 mb-3 p-3 rounded-lg" style={{background:'#111827',border:'1px solid #1a2035'}}>
          <div className="text-xs font-semibold text-text-primary truncate">{client.name}</div>
          <div className="text-xs text-text-secondary mt-0.5 truncate">
            {client.industry}
            {client.monthly_budget ? ` · AED ${Number(client.monthly_budget).toLocaleString()}` : ''}
          </div>
          <div className="mt-2 flex gap-1">
            {['audit','competitor','strategy','creative','reports'].map((s) => (
              <div key={s} className={`h-1 flex-1 rounded-full ${stepDone(s) ? 'bg-status-green' : 'bg-surface-border'}`}/>
            ))}
          </div>
          <div className="text-[10px] text-text-secondary mt-1.5">
            {Object.values(progress).filter(Boolean).length} of 5 steps complete
          </div>
        </div>
      )}
    </div>
  )
}

export default function AppLayout({ children }) {
  return (
    <div className="flex min-h-screen" style={{background:'#080c18'}}>
      <Suspense fallback={
        <div className="w-56 shrink-0 h-screen" style={{background:'#0d1120',borderRight:'1px solid #1a2035'}}/>
      }>
        <SidebarInner />
      </Suspense>
      <main className="flex-1 overflow-y-auto min-h-screen" style={{background:'#080c18'}}>
        {children}
      </main>
    </div>
  )
}
